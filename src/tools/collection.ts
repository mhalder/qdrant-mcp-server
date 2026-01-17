/**
 * Collection management tools registration
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EmbeddingProvider } from "../embeddings/base.js";
import type { QdrantManager } from "../qdrant/client.js";
import * as schemas from "./schemas.js";

export interface CollectionToolDependencies {
  qdrant: QdrantManager;
  embeddings: EmbeddingProvider;
}

export function registerCollectionTools(
  server: McpServer,
  deps: CollectionToolDependencies,
): void {
  const { qdrant, embeddings } = deps;

  // create_collection
  server.registerTool(
    "create_collection",
    {
      title: "Create Collection",
      description:
        "Create a new vector collection in Qdrant. The collection will be configured with the embedding provider's dimensions automatically. Set enableHybrid to true to enable hybrid search combining semantic and keyword search.",
      inputSchema: schemas.CreateCollectionSchema,
    },
    async ({ name, distance, enableHybrid }) => {
      const vectorSize = embeddings.getDimensions();
      await qdrant.createCollection(
        name,
        vectorSize,
        distance,
        enableHybrid || false,
      );

      let message = `Collection "${name}" created successfully with ${vectorSize} dimensions and ${distance || "Cosine"} distance metric.`;
      if (enableHybrid) {
        message += " Hybrid search is enabled for this collection.";
      }

      return {
        content: [{ type: "text", text: message }],
      };
    },
  );

  // list_collections
  server.registerTool(
    "list_collections",
    {
      title: "List Collections",
      description: "List all available collections in Qdrant.",
      inputSchema: {},
    },
    async () => {
      const collections = await qdrant.listCollections();
      return {
        content: [{ type: "text", text: JSON.stringify(collections, null, 2) }],
      };
    },
  );

  // get_collection_info
  server.registerTool(
    "get_collection_info",
    {
      title: "Get Collection Info",
      description:
        "Get detailed information about a collection including vector size, point count, and distance metric.",
      inputSchema: schemas.GetCollectionInfoSchema,
    },
    async ({ name }) => {
      const info = await qdrant.getCollectionInfo(name);
      return {
        content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      };
    },
  );

  // delete_collection
  server.registerTool(
    "delete_collection",
    {
      title: "Delete Collection",
      description: "Delete a collection and all its documents.",
      inputSchema: schemas.DeleteCollectionSchema,
    },
    async ({ name }) => {
      await qdrant.deleteCollection(name);
      return {
        content: [
          { type: "text", text: `Collection "${name}" deleted successfully.` },
        ],
      };
    },
  );
}
