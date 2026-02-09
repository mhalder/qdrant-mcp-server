/**
 * Consolidated Zod schemas for all MCP tools
 *
 * Note: Schemas are exported as plain objects (not wrapped in z.object()) because
 * McpServer.registerTool() expects schemas in this format. The SDK internally
 * converts these to JSON Schema for the MCP protocol. Each property is a Zod
 * field definition that gets composed into the final schema by the SDK.
 */

import { z } from "zod";

// Collection management schemas
export const CreateCollectionSchema = {
  name: z.string().describe("Name of the collection"),
  distance: z
    .enum(["Cosine", "Euclid", "Dot"])
    .optional()
    .describe("Distance metric (default: Cosine)"),
  enableHybrid: z
    .boolean()
    .optional()
    .describe("Enable hybrid search with sparse vectors (default: false)"),
};

export const DeleteCollectionSchema = {
  name: z.string().describe("Name of the collection to delete"),
};

export const GetCollectionInfoSchema = {
  name: z.string().describe("Name of the collection"),
};

// Document operation schemas
export const AddDocumentsSchema = {
  collection: z.string().describe("Name of the collection"),
  documents: z
    .array(
      z.object({
        id: z
          .union([z.string(), z.number()])
          .describe("Unique identifier for the document"),
        text: z.string().describe("Text content to embed and store"),
        metadata: z
          .record(z.string(), z.any())
          .optional()
          .describe("Optional metadata to store with the document"),
      }),
    )
    .describe("Array of documents to add"),
};

export const DeleteDocumentsSchema = {
  collection: z.string().describe("Name of the collection"),
  ids: z
    .array(z.union([z.string(), z.number()]))
    .describe("Array of document IDs to delete"),
};

// Search schemas
export const SemanticSearchSchema = {
  collection: z.string().describe("Name of the collection to search"),
  query: z.string().describe("Search query text"),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of results (default: 5)"),
  filter: z
    .record(z.string(), z.any())
    .optional()
    .describe("Optional metadata filter"),
};

export const HybridSearchSchema = {
  collection: z.string().describe("Name of the collection to search"),
  query: z.string().describe("Search query text"),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of results (default: 5)"),
  filter: z
    .record(z.string(), z.any())
    .optional()
    .describe("Optional metadata filter"),
};

// Code indexing schemas
export const IndexCodebaseSchema = {
  path: z
    .string()
    .describe("Absolute or relative path to codebase root directory"),
  forceReindex: z
    .boolean()
    .optional()
    .describe("Force full re-index even if already indexed (default: false)"),
  extensions: z
    .array(z.string())
    .optional()
    .describe("Custom file extensions to index (e.g., ['.proto', '.graphql'])"),
  ignorePatterns: z
    .array(z.string())
    .optional()
    .describe(
      "Additional patterns to ignore (e.g., ['**/test/**', '**/*.test.ts'])",
    ),
};

export const SearchCodeSchema = {
  path: z.string().describe("Path to codebase (must be indexed first)"),
  query: z
    .string()
    .describe("Natural language search query (e.g., 'authentication logic')"),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of results (default: 5, max: 100)"),
  fileTypes: z
    .array(z.string())
    .optional()
    .describe("Filter by file extensions (e.g., ['.ts', '.py'])"),
  pathPattern: z
    .string()
    .optional()
    .describe("Filter by path glob pattern (e.g., 'src/services/**')"),
};

export const ReindexChangesSchema = {
  path: z.string().describe("Path to codebase"),
};

export const GetIndexStatusSchema = {
  path: z.string().describe("Path to codebase"),
};

export const ClearIndexSchema = {
  path: z.string().describe("Path to codebase"),
};

// Git history indexing schemas
export const IndexGitHistorySchema = {
  path: z.string().describe("Path to git repository"),
  forceReindex: z
    .boolean()
    .optional()
    .describe("Force full re-index even if already indexed (default: false)"),
  sinceDate: z
    .string()
    .optional()
    .describe(
      "Only index commits after this date (ISO format, e.g., '2024-01-01')",
    ),
  maxCommits: z
    .number()
    .optional()
    .describe("Maximum number of commits to index (default: 5000)"),
};

export const SearchGitHistorySchema = {
  path: z.string().describe("Path to git repository (must be indexed first)"),
  query: z
    .string()
    .describe(
      "Natural language search query (e.g., 'fix null pointer in authentication')",
    ),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of results (default: 10, max: 100)"),
  commitTypes: z
    .array(
      z.enum([
        "feat",
        "fix",
        "refactor",
        "docs",
        "test",
        "chore",
        "style",
        "perf",
        "build",
        "ci",
        "revert",
        "other",
      ]),
    )
    .optional()
    .describe("Filter by commit type (e.g., ['fix', 'feat'])"),
  authors: z
    .array(z.string())
    .optional()
    .describe("Filter by author name or email"),
  dateFrom: z
    .string()
    .optional()
    .describe("Only commits after this date (ISO format)"),
  dateTo: z
    .string()
    .optional()
    .describe("Only commits before this date (ISO format)"),
};

export const IndexNewCommitsSchema = {
  path: z.string().describe("Path to git repository"),
};

export const GetGitIndexStatusSchema = {
  path: z.string().describe("Path to git repository"),
};

export const ClearGitIndexSchema = {
  path: z.string().describe("Path to git repository"),
};

// Contextual Search - Combined git + code search
export const ContextualSearchSchema = {
  path: z
    .string()
    .describe(
      "Path to git repository (must be indexed for both code and git history)",
    ),
  query: z.string().describe("Natural language search query"),
  codeLimit: z
    .number()
    .optional()
    .describe("Maximum number of code results (default: 5)"),
  gitLimit: z
    .number()
    .optional()
    .describe("Maximum number of git history results (default: 5)"),
  correlate: z
    .boolean()
    .optional()
    .describe("Link code chunks to commits that modified them (default: true)"),
};

// Federated Search - Multi-repository search
export const FederatedSearchSchema = {
  paths: z
    .array(z.string())
    .min(1)
    .describe("Array of repository paths to search (must all be indexed)"),
  query: z.string().describe("Natural language search query"),
  searchType: z
    .enum(["code", "git", "both"])
    .optional()
    .describe("Type of search (default: both)"),
  limit: z
    .number()
    .optional()
    .describe("Total maximum results across all repositories (default: 20)"),
};
