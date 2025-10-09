import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EmbeddingProviderFactory, type FactoryConfig } from "./factory.js";
import { OpenAIEmbeddings } from "./openai.js";
import { CohereEmbeddings } from "./cohere.js";
import { VoyageEmbeddings } from "./voyage.js";
import { OllamaEmbeddings } from "./ollama.js";

describe("EmbeddingProviderFactory", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("create", () => {
    describe("Unknown provider", () => {
      it("should throw error for unknown provider", () => {
        expect(() =>
          EmbeddingProviderFactory.create({
            provider: "unknown" as any,
          }),
        ).toThrow("Unknown embedding provider: unknown");
      });

      it("should list supported providers in error message", () => {
        expect(() =>
          EmbeddingProviderFactory.create({
            provider: "invalid" as any,
          }),
        ).toThrow("openai, cohere, voyage, ollama");
      });
    });

    describe("OpenAI provider", () => {
      it("should throw error if API key is missing", () => {
        expect(() =>
          EmbeddingProviderFactory.create({
            provider: "openai",
          }),
        ).toThrow("API key is required for OpenAI provider");
      });

      it("should create OpenAI provider with API key", () => {
        const provider = EmbeddingProviderFactory.create({
          provider: "openai",
          apiKey: "test-key",
        });

        expect(provider).toBeInstanceOf(OpenAIEmbeddings);
        expect(provider.getModel()).toBe("text-embedding-3-small");
        expect(provider.getDimensions()).toBe(1536);
      });

      it("should use custom model", () => {
        const provider = EmbeddingProviderFactory.create({
          provider: "openai",
          apiKey: "test-key",
          model: "text-embedding-3-large",
        });

        expect(provider.getModel()).toBe("text-embedding-3-large");
        expect(provider.getDimensions()).toBe(3072);
      });

      it("should use custom dimensions", () => {
        const provider = EmbeddingProviderFactory.create({
          provider: "openai",
          apiKey: "test-key",
          dimensions: 512,
        });

        expect(provider.getDimensions()).toBe(512);
      });

      it("should pass rate limit config", () => {
        const provider = EmbeddingProviderFactory.create({
          provider: "openai",
          apiKey: "test-key",
          rateLimitConfig: {
            maxRequestsPerMinute: 1000,
            retryAttempts: 5,
            retryDelayMs: 2000,
          },
        });

        expect(provider).toBeInstanceOf(OpenAIEmbeddings);
      });
    });

    describe("Cohere provider", () => {
      it("should throw error if API key is missing", () => {
        expect(() =>
          EmbeddingProviderFactory.create({
            provider: "cohere",
          }),
        ).toThrow("API key is required for Cohere provider");
      });

      it("should create Cohere provider with API key", () => {
        const provider = EmbeddingProviderFactory.create({
          provider: "cohere",
          apiKey: "test-key",
        });

        expect(provider).toBeInstanceOf(CohereEmbeddings);
        expect(provider.getModel()).toBe("embed-english-v3.0");
        expect(provider.getDimensions()).toBe(1024);
      });

      it("should use custom model", () => {
        const provider = EmbeddingProviderFactory.create({
          provider: "cohere",
          apiKey: "test-key",
          model: "embed-multilingual-v3.0",
        });

        expect(provider.getModel()).toBe("embed-multilingual-v3.0");
      });

      it("should use custom dimensions", () => {
        const provider = EmbeddingProviderFactory.create({
          provider: "cohere",
          apiKey: "test-key",
          dimensions: 384,
        });

        expect(provider.getDimensions()).toBe(384);
      });
    });

    describe("Voyage provider", () => {
      it("should throw error if API key is missing", () => {
        expect(() =>
          EmbeddingProviderFactory.create({
            provider: "voyage",
          }),
        ).toThrow("API key is required for Voyage AI provider");
      });

      it("should create Voyage provider with API key", () => {
        const provider = EmbeddingProviderFactory.create({
          provider: "voyage",
          apiKey: "test-key",
        });

        expect(provider).toBeInstanceOf(VoyageEmbeddings);
        expect(provider.getModel()).toBe("voyage-2");
        expect(provider.getDimensions()).toBe(1024);
      });

      it("should use custom model", () => {
        const provider = EmbeddingProviderFactory.create({
          provider: "voyage",
          apiKey: "test-key",
          model: "voyage-large-2",
        });

        expect(provider.getModel()).toBe("voyage-large-2");
        expect(provider.getDimensions()).toBe(1536);
      });

      it("should use default base URL", () => {
        const provider = EmbeddingProviderFactory.create({
          provider: "voyage",
          apiKey: "test-key",
        });

        expect(provider).toBeInstanceOf(VoyageEmbeddings);
      });

      it("should use custom base URL", () => {
        const provider = EmbeddingProviderFactory.create({
          provider: "voyage",
          apiKey: "test-key",
          baseUrl: "https://custom.voyageai.com/v1",
        });

        expect(provider).toBeInstanceOf(VoyageEmbeddings);
      });
    });

    describe("Ollama provider", () => {
      it("should not require API key", () => {
        const provider = EmbeddingProviderFactory.create({
          provider: "ollama",
        });

        expect(provider).toBeInstanceOf(OllamaEmbeddings);
        expect(provider.getModel()).toBe("nomic-embed-text");
        expect(provider.getDimensions()).toBe(768);
      });

      it("should use custom model", () => {
        const provider = EmbeddingProviderFactory.create({
          provider: "ollama",
          model: "mxbai-embed-large",
        });

        expect(provider.getModel()).toBe("mxbai-embed-large");
        expect(provider.getDimensions()).toBe(1024);
      });

      it("should use default base URL", () => {
        const provider = EmbeddingProviderFactory.create({
          provider: "ollama",
        });

        expect(provider).toBeInstanceOf(OllamaEmbeddings);
      });

      it("should use custom base URL", () => {
        const provider = EmbeddingProviderFactory.create({
          provider: "ollama",
          baseUrl: "http://custom:11434",
        });

        expect(provider).toBeInstanceOf(OllamaEmbeddings);
      });
    });
  });

  describe("createFromEnv", () => {
    it("should default to OpenAI provider", () => {
      process.env.OPENAI_API_KEY = "test-key";

      const provider = EmbeddingProviderFactory.createFromEnv();

      expect(provider).toBeInstanceOf(OpenAIEmbeddings);
    });

    it("should create OpenAI provider from environment", () => {
      process.env.EMBEDDING_PROVIDER = "openai";
      process.env.OPENAI_API_KEY = "test-openai-key";

      const provider = EmbeddingProviderFactory.createFromEnv();

      expect(provider).toBeInstanceOf(OpenAIEmbeddings);
    });

    it("should create Cohere provider from environment", () => {
      process.env.EMBEDDING_PROVIDER = "cohere";
      process.env.COHERE_API_KEY = "test-cohere-key";

      const provider = EmbeddingProviderFactory.createFromEnv();

      expect(provider).toBeInstanceOf(CohereEmbeddings);
    });

    it("should create Voyage provider from environment", () => {
      process.env.EMBEDDING_PROVIDER = "voyage";
      process.env.VOYAGE_API_KEY = "test-voyage-key";

      const provider = EmbeddingProviderFactory.createFromEnv();

      expect(provider).toBeInstanceOf(VoyageEmbeddings);
    });

    it("should create Ollama provider from environment", () => {
      process.env.EMBEDDING_PROVIDER = "ollama";

      const provider = EmbeddingProviderFactory.createFromEnv();

      expect(provider).toBeInstanceOf(OllamaEmbeddings);
    });

    it("should be case insensitive for provider name", () => {
      process.env.EMBEDDING_PROVIDER = "OpenAI";
      process.env.OPENAI_API_KEY = "test-key";

      const provider = EmbeddingProviderFactory.createFromEnv();

      expect(provider).toBeInstanceOf(OpenAIEmbeddings);
    });

    it("should use custom model from environment", () => {
      process.env.EMBEDDING_PROVIDER = "openai";
      process.env.OPENAI_API_KEY = "test-key";
      process.env.EMBEDDING_MODEL = "text-embedding-3-large";

      const provider = EmbeddingProviderFactory.createFromEnv();

      expect(provider.getModel()).toBe("text-embedding-3-large");
    });

    it("should use custom dimensions from environment", () => {
      process.env.EMBEDDING_PROVIDER = "openai";
      process.env.OPENAI_API_KEY = "test-key";
      process.env.EMBEDDING_DIMENSIONS = "512";

      const provider = EmbeddingProviderFactory.createFromEnv();

      expect(provider.getDimensions()).toBe(512);
    });

    it("should use custom base URL from environment", () => {
      process.env.EMBEDDING_PROVIDER = "voyage";
      process.env.VOYAGE_API_KEY = "test-key";
      process.env.EMBEDDING_BASE_URL = "https://custom.voyage.com";

      const provider = EmbeddingProviderFactory.createFromEnv();

      expect(provider).toBeInstanceOf(VoyageEmbeddings);
    });

    it("should use rate limit config from environment", () => {
      process.env.EMBEDDING_PROVIDER = "openai";
      process.env.OPENAI_API_KEY = "test-key";
      process.env.EMBEDDING_MAX_REQUESTS_PER_MINUTE = "1000";
      process.env.EMBEDDING_RETRY_ATTEMPTS = "5";
      process.env.EMBEDDING_RETRY_DELAY = "2000";

      const provider = EmbeddingProviderFactory.createFromEnv();

      expect(provider).toBeInstanceOf(OpenAIEmbeddings);
    });

    it("should select correct API key based on provider", () => {
      process.env.EMBEDDING_PROVIDER = "cohere";
      process.env.OPENAI_API_KEY = "openai-key";
      process.env.COHERE_API_KEY = "cohere-key";
      process.env.VOYAGE_API_KEY = "voyage-key";

      const provider = EmbeddingProviderFactory.createFromEnv();

      expect(provider).toBeInstanceOf(CohereEmbeddings);
    });

    it("should handle Ollama without API key", () => {
      process.env.EMBEDDING_PROVIDER = "ollama";
      process.env.OPENAI_API_KEY = "openai-key"; // Should not use this

      const provider = EmbeddingProviderFactory.createFromEnv();

      expect(provider).toBeInstanceOf(OllamaEmbeddings);
    });
  });
});
