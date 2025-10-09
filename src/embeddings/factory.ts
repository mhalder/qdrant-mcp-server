import { EmbeddingProvider, ProviderConfig } from "./base.js";
import { OpenAIEmbeddings } from "./openai.js";
import { CohereEmbeddings } from "./cohere.js";
import { VoyageEmbeddings } from "./voyage.js";
import { OllamaEmbeddings } from "./ollama.js";

export type EmbeddingProviderType = "openai" | "cohere" | "voyage" | "ollama";

export interface FactoryConfig extends ProviderConfig {
  provider: EmbeddingProviderType;
}

export class EmbeddingProviderFactory {
  static create(config: FactoryConfig): EmbeddingProvider {
    const { provider, model, dimensions, rateLimitConfig, apiKey, baseUrl } =
      config;

    switch (provider) {
      case "openai":
        if (!apiKey) {
          throw new Error("API key is required for OpenAI provider");
        }
        return new OpenAIEmbeddings(
          apiKey,
          model || "text-embedding-3-small",
          dimensions,
          rateLimitConfig,
        );

      case "cohere":
        if (!apiKey) {
          throw new Error("API key is required for Cohere provider");
        }
        return new CohereEmbeddings(
          apiKey,
          model || "embed-english-v3.0",
          dimensions,
          rateLimitConfig,
        );

      case "voyage":
        if (!apiKey) {
          throw new Error("API key is required for Voyage AI provider");
        }
        return new VoyageEmbeddings(
          apiKey,
          model || "voyage-2",
          dimensions,
          rateLimitConfig,
          baseUrl || "https://api.voyageai.com/v1",
        );

      case "ollama":
        return new OllamaEmbeddings(
          model || "nomic-embed-text",
          dimensions,
          rateLimitConfig,
          baseUrl || "http://localhost:11434",
        );

      default:
        throw new Error(
          `Unknown embedding provider: ${provider}. Supported providers: openai, cohere, voyage, ollama`,
        );
    }
  }

  static createFromEnv(): EmbeddingProvider {
    const provider = (
      process.env.EMBEDDING_PROVIDER || "openai"
    ).toLowerCase() as EmbeddingProviderType;

    // Select API key based on provider
    let apiKey: string | undefined;
    switch (provider) {
      case "openai":
        apiKey = process.env.OPENAI_API_KEY;
        break;
      case "cohere":
        apiKey = process.env.COHERE_API_KEY;
        break;
      case "voyage":
        apiKey = process.env.VOYAGE_API_KEY;
        break;
      case "ollama":
        // No API key needed for local Ollama
        break;
    }

    // Common configuration
    const model = process.env.EMBEDDING_MODEL;
    const dimensions = process.env.EMBEDDING_DIMENSIONS
      ? parseInt(process.env.EMBEDDING_DIMENSIONS)
      : undefined;

    const baseUrl = process.env.EMBEDDING_BASE_URL;

    // Rate limiting configuration
    const maxRequestsPerMinute = process.env.EMBEDDING_MAX_REQUESTS_PER_MINUTE
      ? parseInt(process.env.EMBEDDING_MAX_REQUESTS_PER_MINUTE)
      : undefined;
    const retryAttempts = process.env.EMBEDDING_RETRY_ATTEMPTS
      ? parseInt(process.env.EMBEDDING_RETRY_ATTEMPTS)
      : undefined;
    const retryDelayMs = process.env.EMBEDDING_RETRY_DELAY
      ? parseInt(process.env.EMBEDDING_RETRY_DELAY)
      : undefined;

    const rateLimitConfig = {
      maxRequestsPerMinute,
      retryAttempts,
      retryDelayMs,
    };

    return this.create({
      provider,
      model,
      dimensions,
      rateLimitConfig,
      apiKey,
      baseUrl,
    });
  }
}
