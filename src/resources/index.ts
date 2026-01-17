/**
 * Resource registration module
 */

import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { QdrantManager } from "../qdrant/client.js";

/**
 * Register all MCP resources on the server
 */
export function registerAllResources(
  server: McpServer,
  qdrant: QdrantManager,
): void {
  // Static resource: list all collections
  server.registerResource(
    "collections",
    "qdrant://collections",
    {
      title: "All Collections",
      description: "List of all vector collections in Qdrant",
      mimeType: "application/json",
    },
    async (uri) => {
      const collections = await qdrant.listCollections();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(collections, null, 2),
          },
        ],
      };
    },
  );

  // Dynamic resource: individual collection info
  server.registerResource(
    "collection-info",
    new ResourceTemplate("qdrant://collection/{name}", {
      list: async () => {
        const collections = await qdrant.listCollections();
        return {
          resources: collections.map((name) => ({
            uri: `qdrant://collection/${name}`,
            name: `Collection: ${name}`,
            description: `Details and statistics for collection "${name}"`,
            mimeType: "application/json",
          })),
        };
      },
    }),
    {
      title: "Collection Details",
      description: "Detailed information about a specific collection",
      mimeType: "application/json",
    },
    async (uri, { name }) => {
      const info = await qdrant.getCollectionInfo(name as string);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    },
  );
}
