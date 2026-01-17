#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import Bottleneck from "bottleneck";
import express from "express";
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_CHUNK_OVERLAP,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CODE_EXTENSIONS,
  DEFAULT_IGNORE_PATTERNS,
  DEFAULT_SEARCH_LIMIT,
} from "./code/config.js";
import { CodeIndexer } from "./code/indexer.js";
import type { CodeConfig } from "./code/types.js";
import { EmbeddingProviderFactory } from "./embeddings/factory.js";
import { loadPromptsConfig, type PromptsConfig } from "./prompts/index.js";
import { registerAllPrompts } from "./prompts/register.js";
import { QdrantManager } from "./qdrant/client.js";
import { registerAllResources } from "./resources/index.js";
import { registerAllTools } from "./tools/index.js";

// Read package.json for version
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf-8"),
);

// Validate environment variables
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const EMBEDDING_PROVIDER = (
  process.env.EMBEDDING_PROVIDER || "ollama"
).toLowerCase();
const TRANSPORT_MODE = (process.env.TRANSPORT_MODE || "stdio").toLowerCase();
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "3000", 10);
const PROMPTS_CONFIG_FILE =
  process.env.PROMPTS_CONFIG_FILE || join(__dirname, "../prompts.json");

// Validate HTTP_PORT when HTTP mode is selected
if (TRANSPORT_MODE === "http") {
  if (Number.isNaN(HTTP_PORT) || HTTP_PORT < 1 || HTTP_PORT > 65535) {
    console.error(
      `Error: Invalid HTTP_PORT "${process.env.HTTP_PORT}". Must be a number between 1 and 65535.`,
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
        `Error: Unknown embedding provider "${EMBEDDING_PROVIDER}". Supported providers: openai, cohere, voyage, ollama.`,
      );
      process.exit(1);
  }

  if (!apiKey) {
    console.error(
      `Error: ${requiredKeyName} is required for ${EMBEDDING_PROVIDER} provider.`,
    );
    process.exit(1);
  }
}

// Check if Ollama is running when using Ollama provider
async function checkOllamaAvailability() {
  if (EMBEDDING_PROVIDER === "ollama") {
    const baseUrl = process.env.EMBEDDING_BASE_URL || "http://localhost:11434";
    const isLocalhost =
      baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

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
        (m: any) => m.name === modelName || m.name.startsWith(`${modelName}:`),
      );

      if (!modelExists) {
        let errorMessage = `Error: Model '${modelName}' not found in Ollama.\n`;

        if (isLocalhost) {
          errorMessage +=
            `Pull it with:\n` +
            `  - Using Podman: podman exec ollama ollama pull ${modelName}\n` +
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
          `  - Using Podman: podman compose up -d\n` +
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
const qdrant = new QdrantManager(QDRANT_URL, QDRANT_API_KEY);
const embeddings = EmbeddingProviderFactory.createFromEnv();

// Initialize code indexer
const codeConfig: CodeConfig = {
  chunkSize: parseInt(
    process.env.CODE_CHUNK_SIZE || String(DEFAULT_CHUNK_SIZE),
    10,
  ),
  chunkOverlap: parseInt(
    process.env.CODE_CHUNK_OVERLAP || String(DEFAULT_CHUNK_OVERLAP),
    10,
  ),
  enableASTChunking: process.env.CODE_ENABLE_AST !== "false",
  supportedExtensions: DEFAULT_CODE_EXTENSIONS,
  ignorePatterns: DEFAULT_IGNORE_PATTERNS,
  batchSize: parseInt(
    process.env.CODE_BATCH_SIZE || String(DEFAULT_BATCH_SIZE),
    10,
  ),
  defaultSearchLimit: parseInt(
    process.env.CODE_SEARCH_LIMIT || String(DEFAULT_SEARCH_LIMIT),
    10,
  ),
  enableHybridSearch: process.env.CODE_ENABLE_HYBRID === "true",
};

const codeIndexer = new CodeIndexer(qdrant, embeddings, codeConfig);

// Load prompts configuration if file exists
let promptsConfig: PromptsConfig | null = null;
if (existsSync(PROMPTS_CONFIG_FILE)) {
  try {
    promptsConfig = loadPromptsConfig(PROMPTS_CONFIG_FILE);
    console.error(
      `Loaded ${promptsConfig.prompts.length} prompts from ${PROMPTS_CONFIG_FILE}`,
    );
  } catch (error) {
    console.error(
      `Failed to load prompts configuration from ${PROMPTS_CONFIG_FILE}:`,
      error,
    );
    process.exit(1);
  }
}

// Function to create and configure a new MCP server instance
function createAndConfigureServer(): McpServer {
  try {
    const server = new McpServer({
      name: pkg.name,
      version: pkg.version,
    });

    // Register all tools
    registerAllTools(server, {
      qdrant,
      embeddings,
      codeIndexer,
    });

    // Register all resources
    registerAllResources(server, qdrant);

    // Register all prompts (if configured)
    registerAllPrompts(server, promptsConfig);

    return server;
  } catch (error) {
    console.error("Failed to configure MCP server:", error);
    throw error;
  }
}

// Create a shared MCP server for stdio mode
const server = createAndConfigureServer();

// Start server with stdio transport
async function startStdioServer() {
  await checkOllamaAvailability();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Qdrant MCP server running on stdio");
}

// Constants for HTTP server configuration
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_CONCURRENT = 10; // Max concurrent requests per IP
const RATE_LIMITER_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const REQUEST_TIMEOUT_MS = parseInt(
  process.env.HTTP_REQUEST_TIMEOUT_MS || "300000",
  10,
);
const SHUTDOWN_GRACE_PERIOD_MS = 10 * 1000; // 10 seconds

// Validate REQUEST_TIMEOUT_MS
if (Number.isNaN(REQUEST_TIMEOUT_MS) || REQUEST_TIMEOUT_MS <= 0) {
  console.error(
    `Error: Invalid HTTP_REQUEST_TIMEOUT_MS "${process.env.HTTP_REQUEST_TIMEOUT_MS}". Must be a positive integer.`,
  );
  process.exit(1);
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
    reservoir: RATE_LIMIT_MAX_REQUESTS,
    reservoirRefreshAmount: RATE_LIMIT_MAX_REQUESTS,
    reservoirRefreshInterval: RATE_LIMIT_WINDOW_MS,
    maxConcurrent: RATE_LIMIT_MAX_CONCURRENT,
  });

  // Helper function to send JSON-RPC error responses
  const sendErrorResponse = (
    res: express.Response,
    code: number,
    message: string,
    httpStatus: number = 500,
  ) => {
    if (!res.headersSent) {
      res.status(httpStatus).json({
        jsonrpc: "2.0",
        error: { code, message },
        id: null,
      });
    }
  };

  // Periodic cleanup of inactive rate limiters to prevent memory leaks
  // Track last access time for each IP
  const ipLastAccess = new Map<string, number>();

  const cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    const keysToDelete: string[] = [];

    ipLastAccess.forEach((lastAccess, ip) => {
      if (now - lastAccess > RATE_LIMITER_CLEANUP_INTERVAL_MS) {
        keysToDelete.push(ip);
      }
    });

    keysToDelete.forEach((ip) => {
      rateLimiterGroup.deleteKey(ip);
      ipLastAccess.delete(ip);
    });

    if (keysToDelete.length > 0) {
      console.error(`Cleaned up ${keysToDelete.length} inactive rate limiters`);
    }
  }, RATE_LIMITER_CLEANUP_INTERVAL_MS);

  // Rate limiting middleware
  const rateLimitMiddleware = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";

    try {
      // Update last access time for this IP
      ipLastAccess.set(clientIp, Date.now());

      // Get or create a limiter for this specific IP
      const limiter = rateLimiterGroup.key(clientIp);
      await limiter.schedule(() => Promise.resolve());
      next();
    } catch (error) {
      // Differentiate between rate limit errors and unexpected errors
      if (error instanceof Bottleneck.BottleneckError) {
        console.error(`Rate limit exceeded for IP ${clientIp}:`, error.message);
      } else {
        console.error("Unexpected rate limiting error:", error);
      }
      sendErrorResponse(res, -32000, "Too many requests", 429);
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
    // Create a new server for each request
    const requestServer = createAndConfigureServer();

    // Create transport with enableJsonResponse
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    // Track cleanup state to prevent double cleanup
    let cleanedUp = false;
    const cleanup = async () => {
      if (cleanedUp) return;
      cleanedUp = true;
      await transport.close().catch(() => {});
      await requestServer.close().catch(() => {});
    };

    // Set a timeout for the request to prevent hanging
    const timeoutId = setTimeout(() => {
      sendErrorResponse(res, -32000, "Request timeout", 504);
      cleanup().catch((err) => {
        console.error("Error during timeout cleanup:", err);
      });
    }, REQUEST_TIMEOUT_MS);

    try {
      // Connect server to transport
      await requestServer.connect(transport);

      // Handle the request - this triggers message processing
      // The response will be sent asynchronously when the server calls transport.send()
      await transport.handleRequest(req, res, req.body);

      // Clean up AFTER the response finishes
      // Listen to multiple events to ensure cleanup happens in all scenarios
      const cleanupHandler = () => {
        clearTimeout(timeoutId);
        cleanup().catch((err) => {
          console.error("Error during response cleanup:", err);
        });
      };

      res.on("finish", cleanupHandler);
      res.on("close", cleanupHandler);
      res.on("error", (err) => {
        console.error("Response stream error:", err);
        cleanupHandler();
      });
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Error handling MCP request:", error);
      sendErrorResponse(res, -32603, "Internal server error");
      await cleanup();
    }
  });

  const httpServer = app
    .listen(HTTP_PORT, () => {
      console.error(
        `Qdrant MCP server running on http://localhost:${HTTP_PORT}/mcp`,
      );
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

    console.error(
      "Shutdown signal received, closing HTTP server gracefully...",
    );

    // Clear the cleanup interval to allow graceful shutdown
    clearInterval(cleanupIntervalId);

    // Force shutdown after grace period
    const forceTimeout = setTimeout(() => {
      console.error("Forcing shutdown after timeout");
      process.exit(1);
    }, SHUTDOWN_GRACE_PERIOD_MS);

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
      `Error: Invalid TRANSPORT_MODE "${TRANSPORT_MODE}". Supported modes: stdio, http.`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
