/**
 * Federated and contextual search tools registration
 *
 * Provides advanced search capabilities:
 * - contextual_search: Combined git + code search for a single repository
 * - federated_search: Search across multiple indexed repositories
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CodeIndexer } from "../code/indexer.js";
import type { CodeSearchResult } from "../code/types.js";
import type { GitHistoryIndexer } from "../git/indexer.js";
import type { GitSearchResult } from "../git/types.js";
import * as schemas from "./schemas.js";

// ============================================================================
// Types
// ============================================================================

export interface FederatedToolDependencies {
  codeIndexer: CodeIndexer;
  gitHistoryIndexer: GitHistoryIndexer;
}

/**
 * Links a code chunk to commits that modified the file
 */
export interface CodeCommitCorrelation {
  codeResult: CodeSearchResult;
  relatedCommits: Array<{
    shortHash: string;
    subject: string;
    author: string;
    date: string;
  }>;
}

/**
 * Combined code + git search results with correlations
 */
export interface ContextualSearchResult {
  codeResults: CodeSearchResult[];
  gitResults: GitSearchResult[];
  correlations: CodeCommitCorrelation[];
  metadata: {
    path: string;
    query: string;
    codeResultCount: number;
    gitResultCount: number;
    correlationCount: number;
  };
}

/**
 * Result with repository attribution
 */
export type FederatedResult =
  | (CodeSearchResult & { resultType: "code"; repoPath: string })
  | (GitSearchResult & { resultType: "git"; repoPath: string });

/**
 * Federated search response with results and metadata
 */
export interface FederatedSearchResponse {
  results: FederatedResult[];
  metadata: {
    query: string;
    searchType: "code" | "git" | "both";
    repositoriesSearched: string[];
    totalResults: number;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build correlations between code results and git history
 * Links code chunks to commits that modified the same file
 */
export function buildCorrelations(
  codeResults: CodeSearchResult[],
  gitResults: GitSearchResult[],
): CodeCommitCorrelation[] {
  const correlations: CodeCommitCorrelation[] = [];

  for (const codeResult of codeResults) {
    const relatedCommits: CodeCommitCorrelation["relatedCommits"] = [];

    // Find commits that modified this file
    for (const gitResult of gitResults) {
      // Check if any file in the commit matches the code result's file path
      const normalizedCodePath = normalizePath(codeResult.filePath);
      const matchesFile = gitResult.files.some((file) => {
        const normalizedGitFile = normalizePath(file);
        // Match if the paths end the same way (handles relative vs absolute paths)
        return (
          normalizedCodePath.endsWith(normalizedGitFile) ||
          normalizedGitFile.endsWith(normalizedCodePath)
        );
      });

      if (matchesFile) {
        relatedCommits.push({
          shortHash: gitResult.shortHash,
          subject: gitResult.subject,
          author: gitResult.author,
          date: gitResult.date,
        });
      }
    }

    if (relatedCommits.length > 0) {
      correlations.push({
        codeResult,
        relatedCommits,
      });
    }
  }

  return correlations;
}

/**
 * Normalize a file path for comparison
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").toLowerCase();
}

/**
 * Normalize scores to [0, 1] range using min-max normalization
 */
export function normalizeScores<T extends { score: number }>(
  results: T[],
): T[] {
  if (results.length === 0) return [];
  if (results.length === 1) return results.map((r) => ({ ...r, score: 1 }));

  const scores = results.map((r) => r.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  // If all scores are identical, normalize to 1
  if (maxScore === minScore) {
    return results.map((r) => ({ ...r, score: 1 }));
  }

  return results.map((r) => ({
    ...r,
    score: (r.score - minScore) / (maxScore - minScore),
  }));
}

/**
 * Calculate Reciprocal Rank Fusion score
 * RRF formula: sum(1 / (k + rank)) where k=60 prevents high ranks from dominating
 */
export function calculateRRFScore(ranks: number[]): number {
  const k = 60;
  return ranks.reduce((sum, rank) => sum + 1 / (k + rank), 0);
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Perform contextual search across code and git history
 */
async function performContextualSearch(
  codeIndexer: CodeIndexer,
  gitHistoryIndexer: GitHistoryIndexer,
  params: {
    path: string;
    query: string;
    codeLimit?: number;
    gitLimit?: number;
    correlate?: boolean;
  },
): Promise<ContextualSearchResult> {
  const { path, query, codeLimit = 5, gitLimit = 5, correlate = true } = params;

  // Validate both indexes exist
  const [codeStatus, gitStatus] = await Promise.all([
    codeIndexer.getIndexStatus(path),
    gitHistoryIndexer.getIndexStatus(path),
  ]);

  if (codeStatus.status !== "indexed") {
    throw new Error(
      `Code index not found for "${path}". Run index_codebase first.`,
    );
  }

  if (gitStatus.status !== "indexed") {
    throw new Error(
      `Git history index not found for "${path}". Run index_git_history first.`,
    );
  }

  // Execute searches in parallel
  const [codeResults, gitResults] = await Promise.all([
    codeIndexer.searchCode(path, query, { limit: codeLimit }),
    gitHistoryIndexer.searchHistory(path, query, { limit: gitLimit }),
  ]);

  // Build correlations if requested
  const correlations = correlate
    ? buildCorrelations(codeResults, gitResults)
    : [];

  return {
    codeResults,
    gitResults,
    correlations,
    metadata: {
      path,
      query,
      codeResultCount: codeResults.length,
      gitResultCount: gitResults.length,
      correlationCount: correlations.length,
    },
  };
}

/**
 * Perform federated search across multiple repositories
 */
async function performFederatedSearch(
  codeIndexer: CodeIndexer,
  gitHistoryIndexer: GitHistoryIndexer,
  params: {
    paths: string[];
    query: string;
    searchType?: "code" | "git" | "both";
    limit?: number;
  },
): Promise<FederatedSearchResponse> {
  const { paths, query, searchType = "both", limit = 20 } = params;

  // Fail-fast validation: check all paths are indexed
  const validationPromises = paths.map(async (path) => {
    const errors: string[] = [];

    if (searchType === "code" || searchType === "both") {
      const codeStatus = await codeIndexer.getIndexStatus(path);
      if (codeStatus.status !== "indexed") {
        errors.push(`Code index not found for "${path}"`);
      }
    }

    if (searchType === "git" || searchType === "both") {
      const gitStatus = await gitHistoryIndexer.getIndexStatus(path);
      if (gitStatus.status !== "indexed") {
        errors.push(`Git history index not found for "${path}"`);
      }
    }

    return { path, errors };
  });

  const validationResults = await Promise.all(validationPromises);
  const allErrors = validationResults.flatMap((v) => v.errors);

  if (allErrors.length > 0) {
    throw new Error(`Index validation failed:\n${allErrors.join("\n")}`);
  }

  // Parallel search across all repositories
  const searchPromises: Promise<FederatedResult[]>[] = [];

  for (const path of paths) {
    if (searchType === "code" || searchType === "both") {
      searchPromises.push(
        codeIndexer
          .searchCode(path, query, { limit: Math.ceil(limit / paths.length) })
          .then((results) =>
            results.map((r) => ({
              ...r,
              resultType: "code" as const,
              repoPath: path,
            })),
          ),
      );
    }

    if (searchType === "git" || searchType === "both") {
      searchPromises.push(
        gitHistoryIndexer
          .searchHistory(path, query, {
            limit: Math.ceil(limit / paths.length),
          })
          .then((results) =>
            results.map((r) => ({
              ...r,
              resultType: "git" as const,
              repoPath: path,
            })),
          ),
      );
    }
  }

  const searchResults = await Promise.all(searchPromises);
  const allResults = searchResults.flat();

  // Normalize scores per result type to ensure fair comparison
  const codeResults = allResults.filter(
    (r): r is FederatedResult & { resultType: "code" } =>
      r.resultType === "code",
  );
  const gitResults = allResults.filter(
    (r): r is FederatedResult & { resultType: "git" } => r.resultType === "git",
  );

  const normalizedCode = normalizeScores(codeResults);
  const normalizedGit = normalizeScores(gitResults);
  const normalizedResults = [...normalizedCode, ...normalizedGit];

  // Apply RRF ranking
  // Rank within each repo+type group for fair cross-repo interleaving
  // This ensures top results from each repo get similar RRF scores
  const groupedResults = new Map<string, FederatedResult[]>();
  for (const result of normalizedResults) {
    const key = `${result.repoPath}:${result.resultType}`;
    if (!groupedResults.has(key)) {
      groupedResults.set(key, []);
    }
    groupedResults.get(key)!.push(result);
  }

  // Sort each group by score and create rank lookup
  const rankLookup = new Map<FederatedResult, number>();
  for (const group of groupedResults.values()) {
    group.sort((a, b) => b.score - a.score);
    group.forEach((result, index) => {
      rankLookup.set(result, index + 1);
    });
  }

  // Calculate RRF scores based on per-repo ranks
  const rankedResults = normalizedResults.map((result) => {
    const rank = rankLookup.get(result) ?? 1;
    return {
      result,
      rank,
      rrfScore: calculateRRFScore([rank]),
    };
  });

  // Sort by RRF score (higher is better)
  rankedResults.sort((a, b) => b.rrfScore - a.rrfScore);

  // Return top results up to limit
  const topResults = rankedResults.slice(0, limit).map((r) => r.result);

  return {
    results: topResults,
    metadata: {
      query,
      searchType,
      repositoriesSearched: paths,
      totalResults: topResults.length,
    },
  };
}

// ============================================================================
// Tool Registration
// ============================================================================

/**
 * Register federated search tools on the MCP server
 */
export function registerFederatedTools(
  server: McpServer,
  deps: FederatedToolDependencies,
): void {
  const { codeIndexer, gitHistoryIndexer } = deps;

  // contextual_search
  server.registerTool(
    "contextual_search",
    {
      title: "Contextual Search",
      description:
        "Combined semantic search across code and git history for a single repository. " +
        "Returns code chunks, relevant commits, and correlations showing which commits " +
        "modified which files. Useful for understanding code evolution and finding related changes.",
      inputSchema: schemas.ContextualSearchSchema,
    },
    async ({ path, query, codeLimit, gitLimit, correlate }) => {
      try {
        const result = await performContextualSearch(
          codeIndexer,
          gitHistoryIndexer,
          { path, query, codeLimit, gitLimit, correlate },
        );

        // Format output
        const sections: string[] = [];

        // Code results section
        if (result.codeResults.length > 0) {
          sections.push("## Code Results\n");
          result.codeResults.forEach((r, idx) => {
            sections.push(
              `### ${idx + 1}. ${r.filePath}:${r.startLine}-${r.endLine} (score: ${r.score.toFixed(3)})\n` +
                `Language: ${r.language}\n` +
                "```" +
                r.language +
                "\n" +
                r.content +
                "\n```\n",
            );
          });
        }

        // Git results section
        if (result.gitResults.length > 0) {
          sections.push("\n## Git History Results\n");
          result.gitResults.forEach((r, idx) => {
            sections.push(
              `### ${idx + 1}. ${r.shortHash} - ${r.subject} (score: ${r.score.toFixed(3)})\n` +
                `Author: ${r.author} | Date: ${r.date} | Type: ${r.commitType}\n` +
                `Files: ${r.files.slice(0, 5).join(", ")}${r.files.length > 5 ? ` (+${r.files.length - 5} more)` : ""}\n`,
            );
          });
        }

        // Correlations section
        if (result.correlations.length > 0) {
          sections.push("\n## Correlations (Code ↔ Commits)\n");
          result.correlations.forEach((c) => {
            const commits = c.relatedCommits
              .slice(0, 3)
              .map((commit) => `  - ${commit.shortHash}: ${commit.subject}`)
              .join("\n");
            sections.push(
              `**${c.codeResult.filePath}:${c.codeResult.startLine}** modified by:\n${commits}\n`,
            );
          });
        }

        // Summary
        const summary =
          `\n---\nFound ${result.metadata.codeResultCount} code result(s), ` +
          `${result.metadata.gitResultCount} git result(s), ` +
          `${result.metadata.correlationCount} correlation(s).`;
        sections.push(summary);

        return {
          content: [{ type: "text", text: sections.join("\n") }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // federated_search
  server.registerTool(
    "federated_search",
    {
      title: "Federated Search",
      description:
        "Search across multiple indexed repositories simultaneously. " +
        "Combines and ranks results using Reciprocal Rank Fusion (RRF) for fair cross-repository comparison. " +
        "Supports code-only, git-only, or combined search modes.",
      inputSchema: schemas.FederatedSearchSchema,
    },
    async ({ paths, query, searchType, limit }) => {
      try {
        const response = await performFederatedSearch(
          codeIndexer,
          gitHistoryIndexer,
          { paths, query, searchType, limit },
        );

        if (response.results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No results found for query "${query}" across ${paths.length} repository(ies).`,
              },
            ],
          };
        }

        // Format results
        const sections: string[] = [
          `# Federated Search Results\n` +
            `Query: "${query}" | Type: ${response.metadata.searchType} | ` +
            `Repositories: ${response.metadata.repositoriesSearched.length}\n`,
        ];

        response.results.forEach((r, idx) => {
          if (r.resultType === "code") {
            sections.push(
              `## ${idx + 1}. [CODE] ${r.filePath}:${r.startLine}-${r.endLine}\n` +
                `Repository: ${r.repoPath} | Language: ${r.language} | Score: ${r.score.toFixed(3)}\n` +
                "```" +
                r.language +
                "\n" +
                r.content +
                "\n```\n",
            );
          } else {
            sections.push(
              `## ${idx + 1}. [GIT] ${r.shortHash} - ${r.subject}\n` +
                `Repository: ${r.repoPath} | Author: ${r.author} | Date: ${r.date} | Score: ${r.score.toFixed(3)}\n` +
                `Type: ${r.commitType} | Files: ${r.files.slice(0, 3).join(", ")}${r.files.length > 3 ? ` (+${r.files.length - 3} more)` : ""}\n`,
            );
          }
        });

        sections.push(
          `\n---\nTotal: ${response.metadata.totalResults} result(s) from ${response.metadata.repositoriesSearched.length} repository(ies).`,
        );

        return {
          content: [{ type: "text", text: sections.join("\n") }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
