/**
 * Git history indexing tools registration
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GitHistoryIndexer } from "../git/indexer.js";
import * as schemas from "./schemas.js";

export interface GitHistoryToolDependencies {
  gitHistoryIndexer: GitHistoryIndexer;
}

export function registerGitHistoryTools(
  server: McpServer,
  deps: GitHistoryToolDependencies,
): void {
  const { gitHistoryIndexer } = deps;

  // index_git_history
  server.registerTool(
    "index_git_history",
    {
      title: "Index Git History",
      description:
        "Index a repository's git commit history for semantic search. Extracts commit messages, metadata, and optionally diffs to enable finding relevant past commits. Useful for finding similar fixes, understanding change patterns, or learning from past work.",
      inputSchema: schemas.IndexGitHistorySchema,
    },
    async ({ path, forceReindex, sinceDate, maxCommits }) => {
      const stats = await gitHistoryIndexer.indexHistory(
        path,
        { forceReindex, sinceDate, maxCommits },
        (progress) => {
          console.error(
            `[${progress.phase}] ${progress.percentage}% - ${progress.message}`,
          );
        },
      );

      let statusMessage = `Indexed ${stats.commitsIndexed}/${stats.commitsScanned} commits (${stats.chunksCreated} chunks) in ${(stats.durationMs / 1000).toFixed(1)}s`;

      if (stats.status === "partial") {
        statusMessage += `\n\nWarnings:\n${stats.errors?.join("\n")}`;
      } else if (stats.status === "failed") {
        statusMessage = `Indexing failed:\n${stats.errors?.join("\n")}`;
      }

      return {
        content: [{ type: "text", text: statusMessage }],
        isError: stats.status === "failed",
      };
    },
  );

  // search_git_history
  server.registerTool(
    "search_git_history",
    {
      title: "Search Git History",
      description:
        "Search indexed git history using natural language queries. Returns semantically relevant commits with metadata. Useful for finding past fixes, similar changes, or understanding how problems were solved before.",
      inputSchema: schemas.SearchGitHistorySchema,
    },
    async ({ path, query, limit, commitTypes, authors, dateFrom, dateTo }) => {
      const results = await gitHistoryIndexer.searchHistory(path, query, {
        limit,
        commitTypes,
        authors,
        dateFrom,
        dateTo,
      });

      if (results.length === 0) {
        return {
          content: [
            { type: "text", text: `No results found for query: "${query}"` },
          ],
        };
      }

      // Format results
      const formattedResults = results
        .map(
          (r, idx) =>
            `\n--- Result ${idx + 1} (score: ${r.score.toFixed(3)}) ---\n` +
            `Commit: ${r.shortHash}\n` +
            `Type: ${r.commitType}\n` +
            `Author: ${r.author}\n` +
            `Date: ${r.date.split("T")[0]}\n` +
            `Subject: ${r.subject}\n` +
            `Files: ${r.files.slice(0, 5).join(", ")}${r.files.length > 5 ? ` (+${r.files.length - 5} more)` : ""}\n\n` +
            `${r.content.substring(0, 500)}${r.content.length > 500 ? "..." : ""}\n`,
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} result(s):\n${formattedResults}`,
          },
        ],
      };
    },
  );

  // index_new_commits
  server.registerTool(
    "index_new_commits",
    {
      title: "Index New Commits",
      description:
        "Incrementally index only new commits since the last indexing. Much faster than full re-indexing when keeping the index up to date with recent changes.",
      inputSchema: schemas.IndexNewCommitsSchema,
    },
    async ({ path }) => {
      const stats = await gitHistoryIndexer.indexNewCommits(
        path,
        (progress) => {
          console.error(
            `[${progress.phase}] ${progress.percentage}% - ${progress.message}`,
          );
        },
      );

      let message: string;
      if (stats.newCommits === 0) {
        message = "No new commits found. Git history index is up to date.";
      } else {
        message =
          `Indexed ${stats.newCommits} new commits (${stats.chunksAdded} chunks) ` +
          `in ${(stats.durationMs / 1000).toFixed(1)}s`;
      }

      return {
        content: [{ type: "text", text: message }],
      };
    },
  );

  // get_git_index_status
  server.registerTool(
    "get_git_index_status",
    {
      title: "Get Git Index Status",
      description:
        "Get the indexing status and statistics for a repository's git history index.",
      inputSchema: schemas.GetGitIndexStatusSchema,
    },
    async ({ path }) => {
      const status = await gitHistoryIndexer.getIndexStatus(path);

      if (status.status === "not_indexed") {
        return {
          content: [
            {
              type: "text",
              text: `Git history at "${path}" is not indexed. Use index_git_history to index it first.`,
            },
          ],
        };
      }

      if (status.status === "indexing") {
        return {
          content: [
            {
              type: "text",
              text: `Git history at "${path}" is currently being indexed. ${status.chunksCount || 0} chunks processed so far.`,
            },
          ],
        };
      }

      // Format status information
      const statusInfo = {
        status: status.status,
        collectionName: status.collectionName,
        commitsIndexed: status.commitsCount,
        chunksCount: status.chunksCount,
        lastCommitHash: status.lastCommitHash,
        lastIndexedAt: status.lastIndexedAt?.toISOString(),
      };

      return {
        content: [{ type: "text", text: JSON.stringify(statusInfo, null, 2) }],
      };
    },
  );

  // clear_git_index
  server.registerTool(
    "clear_git_index",
    {
      title: "Clear Git Index",
      description:
        "Delete all indexed git history data for a repository. This is irreversible and will remove the entire git history index.",
      inputSchema: schemas.ClearGitIndexSchema,
    },
    async ({ path }) => {
      await gitHistoryIndexer.clearIndex(path);
      return {
        content: [
          { type: "text", text: `Git history index cleared for "${path}".` },
        ],
      };
    },
  );
}
