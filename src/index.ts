#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Bottleneck from "bottleneck";
import express from "express";
import { z } from "zod";
import { EmbeddingProviderFactory } from "./embeddings/factory.js";
import { BM25SparseVectorGenerator } from "./embeddings/sparse.js";
import { QdrantManager } from "./qdrant/client.js";

// Read package.json for version
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));

// Validate environment variables
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const EMBEDDING_PROVIDER = (process.env.EMBEDDING_PROVIDER || "ollama").toLowerCase();
const TRANSPORT_MODE = (process.env.TRANSPORT_MODE || "stdio").toLowerCase();
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "3000", 10);

// Validate HTTP_PORT when HTTP mode is selected
if (TRANSPORT_MODE === "http") {
  if (Number.isNaN(HTTP_PORT) || HTTP_PORT < 1 || HTTP_PORT > 65535) {
    console.error(
      `Error: Invalid HTTP_PORT "${process.env.HTTP_PORT || "3000"}". Must be a number between 1 and 65535.`
    );
    process.exit(1);
  }
}

// Check for required API keys based on provider
if (EMBEDDING_PROVIDER !== "ollama") {
  let apiKey: string | undefined;
  let requiredKeyName: string;

  switch (EMBEDDING_PROVIDER) {
    case "openai":
      apiKey = process.env.OPENAI_API_KEY;
      requiredKeyName = "OPENAI_API_KEY";
      break;
    case "cohere":
      apiKey = process.env.COHERE_API_KEY;
      requiredKeyName = "COHERE_API_KEY";
      break;
    case "voyage":
      apiKey = process.env.VOYAGE_API_KEY;
      requiredKeyName = "VOYAGE_API_KEY";
      break;
    default:
      console.error(
        `Error: Unknown embedding provider "${EMBEDDING_PROVIDER}". Supported providers: openai, cohere, voyage, ollama.`
      );
      process.exit(1);
  }

  if (!apiKey) {
    console.error(`Error: ${requiredKeyName} is required for ${EMBEDDING_PROVIDER} provider.`);
    process.exit(1);
  }
}

// Check if Ollama is running when using Ollama provider
async function checkOllamaAvailability() {
  if (EMBEDDING_PROVIDER === "ollama") {
    const baseUrl = process.env.EMBEDDING_BASE_URL || "http://localhost:11434";
    const isLocalhost = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

    try {
      const response = await fetch(`${baseUrl}/api/version`);
      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}`);
      }

      // Check if the required embedding model exists
      const tagsResponse = await fetch(`${baseUrl}/api/tags`);
      const { models } = await tagsResponse.json();
      const modelName = process.env.EMBEDDING_MODEL || "nomic-embed-text";
      const modelExists = models.some(
        (m: any) => m.name === modelName || m.name.startsWith(`${modelName}:`)
      );

      if (!modelExists) {
        let errorMessage = `Error: Model '${modelName}' not found in Ollama.\n`;

        if (isLocalhost) {
          errorMessage +=
            `Pull it with:\n` +
            `  - Using Docker: docker exec ollama ollama pull ${modelName}\n` +
            `  - Or locally: ollama pull ${modelName}`;
        } else {
          errorMessage +=
            `Please ensure the model is available on your Ollama instance:\n` +
            `  ollama pull ${modelName}`;
        }

        console.error(errorMessage);
        process.exit(1);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? `Error: ${error.message}`
          : `Error: Ollama is not running at ${baseUrl}.\n`;

      let helpText = "";
      if (isLocalhost) {
        helpText =
          `Please start Ollama:\n` +
          `  - Using Docker: docker compose up -d\n` +
          `  - Or install locally: curl -fsSL https://ollama.ai/install.sh | sh\n` +
          `\nThen pull the embedding model:\n` +
          `  ollama pull nomic-embed-text`;
      } else {
        helpText =
          `Please ensure:\n` +
          `  - Ollama is running at the specified URL\n` +
          `  - The URL is accessible from this machine\n` +
          `  - The embedding model is available (e.g., nomic-embed-text)`;
      }

      console.error(`${errorMessage}\n${helpText}`);
      process.exit(1);
    }
  }
}

// Initialize clients
const qdrant = new QdrantManager(QDRANT_URL);
const embeddings = EmbeddingProviderFactory.createFromEnv();

// Create MCP server
const server = new Server(
  {
    name: pkg.name,
    version: pkg.version,
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Tool schemas
const CreateCollectionSchema = z.object({
  name: z.string().describe("Name of the collection"),
  distance: z
    .enum(["Cosine", "Euclid", "Dot"])
    .optional()
    .describe("Distance metric (default: Cosine)"),
  enableHybrid: z
    .boolean()
    .optional()
    .describe("Enable hybrid search with sparse vectors (default: false)"),
});

const AddDocumentsSchema = z.object({
  collection: z.string().describe("Name of the collection"),
  documents: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]).describe("Unique identifier for the document"),
        text: z.string().describe("Text content to embed and store"),
        metadata: z
          .record(z.any())
          .optional()
          .describe("Optional metadata to store with the document"),
      })
    )
    .describe("Array of documents to add"),
});

const SemanticSearchSchema = z.object({
  collection: z.string().describe("Name of the collection to search"),
  query: z.string().describe("Search query text"),
  limit: z.number().optional().describe("Maximum number of results (default: 5)"),
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
  ids: z.array(z.union([z.string(), z.number()])).describe("Array of document IDs to delete"),
});

const HybridSearchSchema = z.object({
  collection: z.string().describe("Name of the collection to search"),
  query: z.string().describe("Search query text"),
  limit: z.number().optional().describe("Maximum number of results (default: 5)"),
  filter: z.record(z.any()).optional().describe("Optional metadata filter"),
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_collection",
        description:
          "Create a new vector collection in Qdrant. The collection will be configured with the embedding provider's dimensions automatically. Set enableHybrid to true to enable hybrid search combining semantic and keyword search.",
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
            enableHybrid: {
              type: "boolean",
              description: "Enable hybrid search with sparse vectors (default: false)",
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
        description: "Delete specific documents from a collection by their IDs.",
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
      {
        name: "hybrid_search",
        description:
          "Perform hybrid search combining semantic vector search with keyword search using BM25. This provides better results by combining the strengths of both approaches. The collection must be created with enableHybrid set to true.",
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
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_collection": {
        const { name, distance, enableHybrid } = CreateCollectionSchema.parse(args);
        const vectorSize = embeddings.getDimensions();
        await qdrant.createCollection(name, vectorSize, distance, enableHybrid || false);

        let message = `Collection "${name}" created successfully with ${vectorSize} dimensions and ${distance || "Cosine"} distance metric.`;
        if (enableHybrid) {
          message += " Hybrid search is enabled for this collection.";
        }

        return {
          content: [
            {
              type: "text",
              text: message,
            },
          ],
        };
      }

      case "add_documents": {
        const { collection, documents } = AddDocumentsSchema.parse(args);

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
      }

      case "semantic_search": {
        const { collection, query, limit, filter } = SemanticSearchSchema.parse(args);

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
        const results = await qdrant.search(collection, embedding, limit || 5, filter);

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

      case "hybrid_search": {
        const { collection, query, limit, filter } = HybridSearchSchema.parse(args);

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
          filter
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
    const errorDetails = error instanceof Error ? error.message : JSON.stringify(error, null, 2);

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

// Start server with stdio transport
async function startStdioServer() {
  await checkOllamaAvailability();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Qdrant MCP server running on stdio");
}

// Start server with HTTP transport
async function startHttpServer() {
  await checkOllamaAvailability();

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  // Configure Express to trust proxy for correct IP detection
  app.set("trust proxy", true);

  // Rate limiter group: max 100 requests per 15 minutes per IP, max 10 concurrent per IP
  const rateLimiterGroup = new Bottleneck.Group({
    reservoir: 100, // initial capacity per IP
    reservoirRefreshAmount: 100, // refresh back to 100
    reservoirRefreshInterval: 15 * 60 * 1000, // every 15 minutes
    maxConcurrent: 10, // max concurrent requests per IP
  });

  // Rate limiting middleware
  const rateLimitMiddleware = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";

    try {
      // Get or create a limiter for this specific IP
      const limiter = rateLimiterGroup.key(clientIp);
      await limiter.schedule(() => Promise.resolve());
      next();
    } catch (error) {
      console.error("Rate limiting error:", error);
      res.status(429).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Too many requests",
        },
        id: null,
      });
    }
  };

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      mode: TRANSPORT_MODE,
      version: pkg.version,
      embedding_provider: EMBEDDING_PROVIDER,
    });
  });

  app.post("/mcp", rateLimitMiddleware, async (req, res) => {
    const REQUEST_TIMEOUT = 60000; // 60 seconds
    let timeoutId: NodeJS.Timeout | undefined;
    let isTimedOut = false;

    // Create a new transport for each request in stateless mode.
    // This prevents request ID collisions when different clients use the same JSON-RPC request IDs.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
      enableJsonResponse: true,
    });

    try {
      // Set request timeout
      timeoutId = setTimeout(() => {
        isTimedOut = true;
        // Close transport on timeout to prevent resource leaks
        transport.close().catch((e) => console.error("Error closing transport on timeout:", e));
        if (!res.headersSent) {
          res.status(408).json({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Request timeout",
            },
            id: null,
          });
        }
      }, REQUEST_TIMEOUT);

      // Clean up transport when response closes
      res.on("close", () => {
        transport.close();
        if (timeoutId) clearTimeout(timeoutId);
      });

      // Connect the transport to the shared server instance.
      // In stateless mode, each request gets a new transport connection.
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

      // Clear timeout immediately on success to prevent race condition
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent && !isTimedOut) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      // Ensure transport is closed even if an error occurs
      await transport.close();
    }
  });

  const httpServer = app
    .listen(HTTP_PORT, () => {
      console.error(`Qdrant MCP server running on http://localhost:${HTTP_PORT}/mcp`);
    })
    .on("error", (error) => {
      console.error("HTTP server error:", error);
      process.exit(1);
    });

  // Graceful shutdown handling
  let isShuttingDown = false;

  const shutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.error("Shutdown signal received, closing HTTP server gracefully...");

    // Force shutdown after 10 seconds
    const forceTimeout = setTimeout(() => {
      console.error("Forcing shutdown after timeout");
      process.exit(1);
    }, 10000);

    httpServer.close(() => {
      clearTimeout(forceTimeout);
      console.error("HTTP server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

// Main entry point
async function main() {
  if (TRANSPORT_MODE === "http") {
    await startHttpServer();
  } else if (TRANSPORT_MODE === "stdio") {
    await startStdioServer();
  } else {
    console.error(
      `Error: Invalid TRANSPORT_MODE "${TRANSPORT_MODE}". Supported modes: stdio, http.`
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
