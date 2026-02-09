/**
 * Search tools registration
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import logger from "../logger.js";
import type { EmbeddingProvider } from "../embeddings/base.js";
import { BM25SparseVectorGenerator } from "../embeddings/sparse.js";
import type { QdrantManager } from "../qdrant/client.js";
import { withToolLogging } from "./logging.js";
import * as schemas from "./schemas.js";

const log = logger.child({ component: "tools" });

export interface SearchToolDependencies {
  qdrant: QdrantManager;
  embeddings: EmbeddingProvider;
}

export function registerSearchTools(
  server: McpServer,
  deps: SearchToolDependencies,
): void {
  const { qdrant, embeddings } = deps;

  // semantic_search
  server.registerTool(
    "semantic_search",
    {
      title: "Semantic Search",
      description:
        "Search for documents using natural language queries. Returns the most semantically similar documents.",
      inputSchema: schemas.SemanticSearchSchema,
    },
    withToolLogging(
      "semantic_search",
      async ({ collection, query, limit, filter }) => {
        log.info(
          {
            tool: "semantic_search",
            collection,
            query: query.substring(0, 80),
          },
          "Tool called",
        );
        // Check if collection exists
        const exists = await qdrant.collectionExists(collection);
        if (!exists) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Collection "${collection}" does not exist.`,
              },
            ],
            isError: true,
          };
        }

        // Generate embedding for query
        const { embedding } = await embeddings.embed(query);

        // Search
        const results = await qdrant.search(
          collection,
          embedding,
          limit || 5,
          filter,
        );

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      },
    ),
  );

  // hybrid_search
  server.registerTool(
    "hybrid_search",
    {
      title: "Hybrid Search",
      description:
        "Perform hybrid search combining semantic vector search with keyword search using BM25. This provides better results by combining the strengths of both approaches. The collection must be created with enableHybrid set to true.",
      inputSchema: schemas.HybridSearchSchema,
    },
    withToolLogging(
      "hybrid_search",
      async ({ collection, query, limit, filter }) => {
        log.info(
          { tool: "hybrid_search", collection, query: query.substring(0, 80) },
          "Tool called",
        );
        // Check if collection exists
        const exists = await qdrant.collectionExists(collection);
        if (!exists) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Collection "${collection}" does not exist.`,
              },
            ],
            isError: true,
          };
        }

        // Check if collection has hybrid search enabled
        const collectionInfo = await qdrant.getCollectionInfo(collection);
        if (!collectionInfo.hybridEnabled) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Collection "${collection}" does not have hybrid search enabled. Create a new collection with enableHybrid set to true.`,
              },
            ],
            isError: true,
          };
        }

        // Generate dense embedding for query
        const { embedding } = await embeddings.embed(query);

        // Generate sparse vector for query
        const sparseGenerator = new BM25SparseVectorGenerator();
        const sparseVector = sparseGenerator.generate(query);

        // Perform hybrid search
        const results = await qdrant.hybridSearch(
          collection,
          embedding,
          sparseVector,
          limit || 5,
          filter,
        );

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      },
    ),
  );
}
