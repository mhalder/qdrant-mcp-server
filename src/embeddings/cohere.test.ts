import { describe, it, expect, vi, beforeEach } from "vitest";
import { CohereEmbeddings } from "./cohere.js";
import { CohereClient } from "cohere-ai";

const mockClient = {
  embed: vi.fn().mockResolvedValue({ embeddings: [[]] }),
};

vi.mock("cohere-ai", () => ({
  CohereClient: vi.fn().mockImplementation(function () {
    return mockClient;
  }),
}));

vi.mock("../logger.js", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

describe("CohereEmbeddings", () => {
  let embeddings: CohereEmbeddings;

  beforeEach(() => {
    mockClient.embed.mockReset().mockResolvedValue({ embeddings: [[]] });
    vi.mocked(CohereClient).mockClear();
    embeddings = new CohereEmbeddings("test-api-key");
  });

  describe("constructor", () => {
    it("should use default model and dimensions", () => {
      expect(embeddings.getModel()).toBe("embed-english-v3.0");
      expect(embeddings.getDimensions()).toBe(1024);
    });

    it("should use custom model", () => {
      const customEmbeddings = new CohereEmbeddings(
        "test-api-key",
        "embed-multilingual-v3.0",
      );
      expect(customEmbeddings.getModel()).toBe("embed-multilingual-v3.0");
      expect(customEmbeddings.getDimensions()).toBe(1024);
    });

    it("should use custom dimensions", () => {
      const customEmbeddings = new CohereEmbeddings(
        "test-api-key",
        "embed-english-v3.0",
        512,
      );
      expect(customEmbeddings.getDimensions()).toBe(512);
    });

    it("should use default dimensions for light models", () => {
      const lightEmbeddings = new CohereEmbeddings(
        "test-api-key",
        "embed-english-light-v3.0",
      );
      expect(lightEmbeddings.getDimensions()).toBe(384);
    });

    it("should default to 1024 for unknown models", () => {
      const unknownEmbeddings = new CohereEmbeddings(
        "test-api-key",
        "custom-model",
      );
      expect(unknownEmbeddings.getDimensions()).toBe(1024);
    });

    it("should accept custom input type", () => {
      const searchQueryEmbeddings = new CohereEmbeddings(
        "test-api-key",
        "embed-english-v3.0",
        undefined,
        undefined,
        "search_query",
      );
      expect(searchQueryEmbeddings).toBeInstanceOf(CohereEmbeddings);
    });
  });

  describe("embed", () => {
    it("should generate embedding for single text", async () => {
      const mockEmbedding = Array(1024)
        .fill(0)
        .map((_, i) => i * 0.001);
      mockClient.embed.mockResolvedValue({
        embeddings: [mockEmbedding],
      });

      const result = await embeddings.embed("test text");

      expect(result).toEqual({
        embedding: mockEmbedding,
        dimensions: 1024,
      });
      expect(mockClient.embed).toHaveBeenCalledWith({
        texts: ["test text"],
        model: "embed-english-v3.0",
        inputType: "search_document",
        embeddingTypes: ["float"],
      });
    });

    it("should handle long text", async () => {
      const longText = "word ".repeat(1000);
      const mockEmbedding = Array(1024).fill(0.5);
      mockClient.embed.mockResolvedValue({
        embeddings: [mockEmbedding],
      });

      const result = await embeddings.embed(longText);

      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockClient.embed).toHaveBeenCalledWith({
        texts: [longText],
        model: "embed-english-v3.0",
        inputType: "search_document",
        embeddingTypes: ["float"],
      });
    });

    it("should use custom model configuration", async () => {
      const customEmbeddings = new CohereEmbeddings(
        "test-api-key",
        "embed-multilingual-v3.0",
        1024,
      );
      const mockEmbedding = Array(1024).fill(0.1);
      mockClient.embed.mockResolvedValue({
        embeddings: [mockEmbedding],
      });

      await customEmbeddings.embed("test");

      expect(mockClient.embed).toHaveBeenCalledWith({
        texts: ["test"],
        model: "embed-multilingual-v3.0",
        inputType: "search_document",
        embeddingTypes: ["float"],
      });
    });

    it("should throw error if no embedding returned", async () => {
      mockClient.embed.mockResolvedValue({
        embeddings: [],
      });

      await expect(embeddings.embed("test")).rejects.toThrow(
        "No embedding returned from Cohere API",
      );
    });

    it("should propagate errors", async () => {
      mockClient.embed.mockRejectedValue(new Error("API Error"));

      await expect(embeddings.embed("test")).rejects.toThrow("API Error");
    });
  });

  describe("embedBatch", () => {
    it("should generate embeddings for multiple texts", async () => {
      const mockEmbeddings = [
        Array(1024).fill(0.1),
        Array(1024).fill(0.2),
        Array(1024).fill(0.3),
      ];
      mockClient.embed.mockResolvedValue({
        embeddings: mockEmbeddings,
      });

      const texts = ["text1", "text2", "text3"];
      const results = await embeddings.embedBatch(texts);

      expect(results).toEqual([
        { embedding: mockEmbeddings[0], dimensions: 1024 },
        { embedding: mockEmbeddings[1], dimensions: 1024 },
        { embedding: mockEmbeddings[2], dimensions: 1024 },
      ]);
      expect(mockClient.embed).toHaveBeenCalledWith({
        texts,
        model: "embed-english-v3.0",
        inputType: "search_document",
        embeddingTypes: ["float"],
      });
    });

    it("should handle empty batch", async () => {
      mockClient.embed.mockResolvedValue({
        embeddings: [],
      });

      const results = await embeddings.embedBatch([]);

      expect(results).toEqual([]);
    });

    it("should handle single item in batch", async () => {
      const mockEmbedding = Array(1024).fill(0.5);
      mockClient.embed.mockResolvedValue({
        embeddings: [mockEmbedding],
      });

      const results = await embeddings.embedBatch(["single text"]);

      expect(results).toHaveLength(1);
      expect(results[0].embedding).toEqual(mockEmbedding);
    });

    it("should handle large batches", async () => {
      const batchSize = 100;
      const mockEmbeddings = Array(batchSize)
        .fill(null)
        .map(() => Array(1024).fill(Math.random()));

      mockClient.embed.mockResolvedValue({
        embeddings: mockEmbeddings,
      });

      const texts = Array(batchSize)
        .fill(null)
        .map((_, i) => `text ${i}`);
      const results = await embeddings.embedBatch(texts);

      expect(results).toHaveLength(batchSize);
    });

    it("should throw error if no embeddings returned", async () => {
      mockClient.embed.mockResolvedValue({});

      await expect(embeddings.embedBatch(["text1"])).rejects.toThrow(
        "No embeddings returned from Cohere API",
      );
    });

    it("should propagate errors in batch", async () => {
      mockClient.embed.mockRejectedValue(new Error("Batch API Error"));

      await expect(embeddings.embedBatch(["text1", "text2"])).rejects.toThrow(
        "Batch API Error",
      );
    });
  });

  describe("getDimensions", () => {
    it("should return configured dimensions", () => {
      expect(embeddings.getDimensions()).toBe(1024);
    });

    it("should return custom dimensions", () => {
      const customEmbeddings = new CohereEmbeddings(
        "test-api-key",
        "embed-english-v3.0",
        512,
      );
      expect(customEmbeddings.getDimensions()).toBe(512);
    });
  });

  describe("getModel", () => {
    it("should return configured model", () => {
      expect(embeddings.getModel()).toBe("embed-english-v3.0");
    });

    it("should return custom model", () => {
      const customEmbeddings = new CohereEmbeddings(
        "test-api-key",
        "embed-multilingual-v3.0",
      );
      expect(customEmbeddings.getModel()).toBe("embed-multilingual-v3.0");
    });
  });

  describe("rate limiting", () => {
    it("should retry on rate limit error (status 429)", async () => {
      const mockEmbedding = Array(1024).fill(0.5);

      mockClient.embed
        .mockRejectedValueOnce({ status: 429, message: "Rate limit exceeded" })
        .mockRejectedValueOnce({ status: 429, message: "Rate limit exceeded" })
        .mockResolvedValue({ embeddings: [mockEmbedding] });

      const result = await embeddings.embed("test text");

      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockClient.embed).toHaveBeenCalledTimes(3);
    });

    it("should retry on rate limit error (statusCode 429)", async () => {
      const mockEmbedding = Array(1024).fill(0.5);

      mockClient.embed
        .mockRejectedValueOnce({
          statusCode: 429,
          message: "Rate limit exceeded",
        })
        .mockResolvedValue({ embeddings: [mockEmbedding] });

      const result = await embeddings.embed("test text");

      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockClient.embed).toHaveBeenCalledTimes(2);
    });

    it("should retry on rate limit message", async () => {
      const mockEmbedding = Array(1024).fill(0.5);

      mockClient.embed
        .mockRejectedValueOnce({
          message: "You have exceeded the rate limit",
        })
        .mockResolvedValue({ embeddings: [mockEmbedding] });

      const result = await embeddings.embed("test text");

      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockClient.embed).toHaveBeenCalledTimes(2);
    });

    it("should use exponential backoff", async () => {
      const rateLimitEmbeddings = new CohereEmbeddings(
        "test-api-key",
        "embed-english-v3.0",
        undefined,
        {
          retryAttempts: 3,
          retryDelayMs: 100,
        },
      );

      const mockEmbedding = Array(1024).fill(0.5);
      const rateLimitError = {
        status: 429,
        message: "Rate limit exceeded",
      };

      mockClient.embed
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ embeddings: [mockEmbedding] });

      const startTime = Date.now();
      await rateLimitEmbeddings.embed("test text");
      const duration = Date.now() - startTime;

      // Should wait: 100ms (first retry) + 200ms (second retry) = 300ms
      expect(duration).toBeGreaterThanOrEqual(250);
    });

    it("should throw error after max retries exceeded", async () => {
      const rateLimitEmbeddings = new CohereEmbeddings(
        "test-api-key",
        "embed-english-v3.0",
        undefined,
        {
          retryAttempts: 2,
          retryDelayMs: 100,
        },
      );

      const rateLimitError = {
        status: 429,
        message: "Rate limit exceeded",
      };

      mockClient.embed.mockRejectedValue(rateLimitError);

      await expect(rateLimitEmbeddings.embed("test text")).rejects.toThrow(
        "Cohere API rate limit exceeded after 2 retry attempts",
      );

      expect(mockClient.embed).toHaveBeenCalledTimes(3);
    });

    it("should handle rate limit errors in batch operations", async () => {
      const mockEmbeddings = [Array(1024).fill(0.1), Array(1024).fill(0.2)];

      mockClient.embed
        .mockRejectedValueOnce({ status: 429, message: "Rate limit exceeded" })
        .mockResolvedValue({
          embeddings: mockEmbeddings,
        });

      const results = await embeddings.embedBatch(["text1", "text2"]);

      expect(results).toHaveLength(2);
      expect(mockClient.embed).toHaveBeenCalledTimes(2);
    });

    it("should not retry on non-rate-limit errors", async () => {
      const apiError = new Error("Invalid API key");
      mockClient.embed.mockRejectedValue(apiError);

      await expect(embeddings.embed("test text")).rejects.toThrow(
        "Invalid API key",
      );
      expect(mockClient.embed).toHaveBeenCalledTimes(1);
    });

    it("should accept custom rate limit configuration", () => {
      const customEmbeddings = new CohereEmbeddings(
        "test-api-key",
        "embed-english-v3.0",
        undefined,
        {
          maxRequestsPerMinute: 200,
          retryAttempts: 5,
          retryDelayMs: 2000,
        },
      );

      expect(customEmbeddings).toBeDefined();
    });
  });
});
