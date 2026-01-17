/**
 * Tool registration orchestrator
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CodeIndexer } from "../code/indexer.js";
import type { EmbeddingProvider } from "../embeddings/base.js";
import type { QdrantManager } from "../qdrant/client.js";
import { registerCodeTools } from "./code.js";
import { registerCollectionTools } from "./collection.js";
import { registerDocumentTools } from "./document.js";
import { registerSearchTools } from "./search.js";

export interface ToolDependencies {
  qdrant: QdrantManager;
  embeddings: EmbeddingProvider;
  codeIndexer: CodeIndexer;
}

/**
 * Register all MCP tools on the server
 */
export function registerAllTools(
  server: McpServer,
  deps: ToolDependencies,
): void {
  registerCollectionTools(server, {
    qdrant: deps.qdrant,
    embeddings: deps.embeddings,
  });

  registerDocumentTools(server, {
    qdrant: deps.qdrant,
    embeddings: deps.embeddings,
  });

  registerSearchTools(server, {
    qdrant: deps.qdrant,
    embeddings: deps.embeddings,
  });

  registerCodeTools(server, {
    codeIndexer: deps.codeIndexer,
  });
}

// Re-export schemas for external use
export * from "./schemas.js";
