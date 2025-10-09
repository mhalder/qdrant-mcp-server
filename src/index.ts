#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { QdrantManager } from "./qdrant/client.js";
import { EmbeddingProviderFactory } from "./embeddings/factory.js";
import { z } from "zod";

// Validate environment variables
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const EMBEDDING_PROVIDER = (
  process.env.EMBEDDING_PROVIDER || "openai"
).toLowerCase();

// Check for required API keys based on provider
if (EMBEDDING_PROVIDER !== "ollama") {
  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.COHERE_API_KEY ||
    process.env.VOYAGE_API_KEY;

  if (!apiKey) {
    console.error(
      `Error: API key is required for ${EMBEDDING_PROVIDER} provider. Set OPENAI_API_KEY, COHERE_API_KEY, or VOYAGE_API_KEY.`,
    );
    process.exit(1);
  }
}

// Initialize clients
const qdrant = new QdrantManager(QDRANT_URL);
const embeddings = EmbeddingProviderFactory.createFromEnv();

// Create MCP server
const server = new Server(
  {
    name: "qdrant-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

// Tool schemas
const CreateCollectionSchema = z.object({
  name: z.string().describe("Name of the collection"),
  distance: z
    .enum(["Cosine", "Euclid", "Dot"])
    .optional()
    .describe("Distance metric (default: Cosine)"),
});

const AddDocumentsSchema = z.object({
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
});

const SemanticSearchSchema = z.object({
  collection: z.string().describe("Name of the collection to search"),
  query: z.string().describe("Search query text"),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of results (default: 5)"),
  filter: z.record(z.any()).optional().describe("Optional metadata filter"),
});

const DeleteCollectionSchema = z.object({
  name: z.string().describe("Name of the collection to delete"),
});

const GetCollectionInfoSchema = z.object({
  name: z.string().describe("Name of the collection"),
});

const DeleteDocumentsSchema = z.object({
  collection: z.string().describe("Name of the collection"),
  ids: z
    .array(z.union([z.string(), z.number()]))
    .describe("Array of document IDs to delete"),
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_collection",
        description:
          "Create a new vector collection in Qdrant. The collection will be configured with the embedding provider's dimensions automatically.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the collection",
            },
            distance: {
              type: "string",
              enum: ["Cosine", "Euclid", "Dot"],
              description: "Distance metric (default: Cosine)",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "add_documents",
        description:
          "Add documents to a collection. Documents will be automatically embedded using the configured embedding provider.",
        inputSchema: {
          type: "object",
          properties: {
            collection: {
              type: "string",
              description: "Name of the collection",
            },
            documents: {
              type: "array",
              description: "Array of documents to add",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: ["string", "number"],
                    description: "Unique identifier for the document",
                  },
                  text: {
                    type: "string",
                    description: "Text content to embed and store",
                  },
                  metadata: {
                    type: "object",
                    description: "Optional metadata to store with the document",
                  },
                },
                required: ["id", "text"],
              },
            },
          },
          required: ["collection", "documents"],
        },
      },
      {
        name: "semantic_search",
        description:
          "Search for documents using natural language queries. Returns the most semantically similar documents.",
        inputSchema: {
          type: "object",
          properties: {
            collection: {
              type: "string",
              description: "Name of the collection to search",
            },
            query: {
              type: "string",
              description: "Search query text",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 5)",
            },
            filter: {
              type: "object",
              description: "Optional metadata filter",
            },
          },
          required: ["collection", "query"],
        },
      },
      {
        name: "list_collections",
        description: "List all available collections in Qdrant.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "delete_collection",
        description: "Delete a collection and all its documents.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the collection to delete",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "get_collection_info",
        description:
          "Get detailed information about a collection including vector size, point count, and distance metric.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the collection",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "delete_documents",
        description:
          "Delete specific documents from a collection by their IDs.",
        inputSchema: {
          type: "object",
          properties: {
            collection: {
              type: "string",
              description: "Name of the collection",
            },
            ids: {
              type: "array",
              description: "Array of document IDs to delete",
              items: {
                type: ["string", "number"],
              },
            },
          },
          required: ["collection", "ids"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_collection": {
        const { name, distance } = CreateCollectionSchema.parse(args);
        const vectorSize = embeddings.getDimensions();
        await qdrant.createCollection(name, vectorSize, distance);
        return {
          content: [
            {
              type: "text",
              text: `Collection "${name}" created successfully with ${vectorSize} dimensions and ${distance || "Cosine"} distance metric.`,
            },
          ],
        };
      }

      case "add_documents": {
        const { collection, documents } = AddDocumentsSchema.parse(args);

        // Check if collection exists
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

        // Generate embeddings for all documents
        const texts = documents.map((doc) => doc.text);
        const embeddingResults = await embeddings.embedBatch(texts);

        // Prepare points for insertion
        const points = documents.map((doc, index) => ({
          id: doc.id,
          vector: embeddingResults[index].embedding,
          payload: {
            text: doc.text,
            ...doc.metadata,
          },
        }));

        await qdrant.addPoints(collection, points);

        return {
          content: [
            {
              type: "text",
              text: `Successfully added ${documents.length} document(s) to collection "${collection}".`,
            },
          ],
        };
      }

      case "semantic_search": {
        const { collection, query, limit, filter } =
          SemanticSearchSchema.parse(args);

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
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case "list_collections": {
        const collections = await qdrant.listCollections();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(collections, null, 2),
            },
          ],
        };
      }

      case "delete_collection": {
        const { name } = DeleteCollectionSchema.parse(args);
        await qdrant.deleteCollection(name);
        return {
          content: [
            {
              type: "text",
              text: `Collection "${name}" deleted successfully.`,
            },
          ],
        };
      }

      case "get_collection_info": {
        const { name } = GetCollectionInfoSchema.parse(args);
        const info = await qdrant.getCollectionInfo(name);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(info, null, 2),
            },
          ],
        };
      }

      case "delete_documents": {
        const { collection, ids } = DeleteDocumentsSchema.parse(args);
        await qdrant.deletePoints(collection, ids);
        return {
          content: [
            {
              type: "text",
              text: `Successfully deleted ${ids.length} document(s) from collection "${collection}".`,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error: any) {
    // Enhanced error details for debugging
    const errorDetails =
      error instanceof Error ? error.message : JSON.stringify(error, null, 2);

    console.error("Tool execution error:", {
      tool: name,
      error: errorDetails,
      stack: error?.stack,
      data: error?.data,
    });

    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorDetails}`,
        },
      ],
      isError: true,
    };
  }
});

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const collections = await qdrant.listCollections();

  return {
    resources: [
      {
        uri: "qdrant://collections",
        name: "All Collections",
        description: "List of all vector collections in Qdrant",
        mimeType: "application/json",
      },
      ...collections.map((name) => ({
        uri: `qdrant://collection/${name}`,
        name: `Collection: ${name}`,
        description: `Details and statistics for collection "${name}"`,
        mimeType: "application/json",
      })),
    ],
  };
});

// Read resource content
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === "qdrant://collections") {
    const collections = await qdrant.listCollections();
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(collections, null, 2),
        },
      ],
    };
  }

  const collectionMatch = uri.match(/^qdrant:\/\/collection\/(.+)$/);
  if (collectionMatch) {
    const name = collectionMatch[1];
    const info = await qdrant.getCollectionInfo(name);
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(info, null, 2),
        },
      ],
    };
  }

  return {
    contents: [
      {
        uri,
        mimeType: "text/plain",
        text: `Unknown resource: ${uri}`,
      },
    ],
  };
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Qdrant MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
