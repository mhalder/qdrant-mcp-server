/**
 * Document operation tools registration
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EmbeddingProvider } from "../embeddings/base.js";
import { BM25SparseVectorGenerator } from "../embeddings/sparse.js";
import type { QdrantManager } from "../qdrant/client.js";
import * as schemas from "./schemas.js";

export interface DocumentToolDependencies {
  qdrant: QdrantManager;
  embeddings: EmbeddingProvider;
}

export function registerDocumentTools(
  server: McpServer,
  deps: DocumentToolDependencies,
): void {
  const { qdrant, embeddings } = deps;

  // add_documents
  server.registerTool(
    "add_documents",
    {
      title: "Add Documents",
      description:
        "Add documents to a collection. Documents will be automatically embedded using the configured embedding provider.",
      inputSchema: schemas.AddDocumentsSchema,
    },
    async ({ collection, documents }) => {
      // Check if collection exists and get info
      const exists = await qdrant.collectionExists(collection);
      if (!exists) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Collection "${collection}" does not exist. Create it first using create_collection.`,
            },
          ],
          isError: true,
        };
      }

      const collectionInfo = await qdrant.getCollectionInfo(collection);

      // Generate embeddings for all documents
      const texts = documents.map((doc) => doc.text);
      const embeddingResults = await embeddings.embedBatch(texts);

      // If hybrid search is enabled, generate sparse vectors and use appropriate method
      if (collectionInfo.hybridEnabled) {
        const sparseGenerator = new BM25SparseVectorGenerator();

        // Prepare points with both dense and sparse vectors
        const points = documents.map((doc, index) => ({
          id: doc.id,
          vector: embeddingResults[index].embedding,
          sparseVector: sparseGenerator.generate(doc.text),
          payload: {
            text: doc.text,
            ...doc.metadata,
          },
        }));

        await qdrant.addPointsWithSparse(collection, points);
      } else {
        // Standard dense-only vectors
        const points = documents.map((doc, index) => ({
          id: doc.id,
          vector: embeddingResults[index].embedding,
          payload: {
            text: doc.text,
            ...doc.metadata,
          },
        }));

        await qdrant.addPoints(collection, points);
      }

      return {
        content: [
          {
            type: "text",
            text: `Successfully added ${documents.length} document(s) to collection "${collection}".`,
          },
        ],
      };
    },
  );

  // delete_documents
  server.registerTool(
    "delete_documents",
    {
      title: "Delete Documents",
      description: "Delete specific documents from a collection by their IDs.",
      inputSchema: schemas.DeleteDocumentsSchema,
    },
    async ({ collection, ids }) => {
      await qdrant.deletePoints(collection, ids);
      return {
        content: [
          {
            type: "text",
            text: `Successfully deleted ${ids.length} document(s) from collection "${collection}".`,
          },
        ],
      };
    },
  );
}
