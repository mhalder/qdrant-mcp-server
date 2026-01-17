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
          .record(z.any())
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
  filter: z.record(z.any()).optional().describe("Optional metadata filter"),
};

export const HybridSearchSchema = {
  collection: z.string().describe("Name of the collection to search"),
  query: z.string().describe("Search query text"),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of results (default: 5)"),
  filter: z.record(z.any()).optional().describe("Optional metadata filter"),
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
