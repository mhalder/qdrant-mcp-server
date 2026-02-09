import { describe, it, expect, vi, beforeEach } from "vitest";
import { VoyageEmbeddings } from "./voyage.js";

// Mock fetch globally
global.fetch = vi.fn();

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

describe("VoyageEmbeddings", () => {
  let embeddings: VoyageEmbeddings;
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = global.fetch as any;
    mockFetch.mockReset();

    embeddings = new VoyageEmbeddings("test-api-key");
  });

  describe("constructor", () => {
    it("should use default model and dimensions", () => {
      expect(embeddings.getModel()).toBe("voyage-2");
      expect(embeddings.getDimensions()).toBe(1024);
    });

    it("should use custom model", () => {
      const customEmbeddings = new VoyageEmbeddings(
        "test-api-key",
        "voyage-large-2",
      );
      expect(customEmbeddings.getModel()).toBe("voyage-large-2");
      expect(customEmbeddings.getDimensions()).toBe(1536);
    });

    it("should use custom dimensions", () => {
      const customEmbeddings = new VoyageEmbeddings(
        "test-api-key",
        "voyage-2",
        512,
      );
      expect(customEmbeddings.getDimensions()).toBe(512);
    });

    it("should use default base URL", () => {
      const defaultEmbeddings = new VoyageEmbeddings("test-api-key");
      expect(defaultEmbeddings).toBeDefined();
    });

    it("should use custom base URL", () => {
      const customEmbeddings = new VoyageEmbeddings(
        "test-api-key",
        "voyage-2",
        undefined,
        undefined,
        "https://custom.voyage.com",
      );
      expect(customEmbeddings).toBeDefined();
    });

    it("should default to 1024 for unknown models", () => {
      const unknownEmbeddings = new VoyageEmbeddings(
        "test-api-key",
        "custom-model",
      );
      expect(unknownEmbeddings.getDimensions()).toBe(1024);
    });

    it("should accept custom input type", () => {
      const queryEmbeddings = new VoyageEmbeddings(
        "test-api-key",
        "voyage-2",
        undefined,
        undefined,
        undefined,
        "query",
      );
      expect(queryEmbeddings).toBeInstanceOf(VoyageEmbeddings);
    });
  });

  describe("embed", () => {
    it("should generate embedding for single text", async () => {
      const mockEmbedding = Array(1024)
        .fill(0)
        .map((_, i) => i * 0.001);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
          model: "voyage-2",
          usage: { total_tokens: 10 },
        }),
      });

      const result = await embeddings.embed("test text");

      expect(result).toEqual({
        embedding: mockEmbedding,
        dimensions: 1024,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.voyageai.com/v1/embeddings",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
          },
          body: JSON.stringify({
            input: ["test text"],
            model: "voyage-2",
          }),
        },
      );
    });

    it("should include input_type when specified", async () => {
      const queryEmbeddings = new VoyageEmbeddings(
        "test-api-key",
        "voyage-2",
        undefined,
        undefined,
        undefined,
        "query",
      );

      const mockEmbedding = Array(1024).fill(0.5);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
          model: "voyage-2",
          usage: { total_tokens: 10 },
        }),
      });

      await queryEmbeddings.embed("test text");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.input_type).toBe("query");
    });

    it("should handle long text", async () => {
      const longText = "word ".repeat(1000);
      const mockEmbedding = Array(1024).fill(0.5);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
          model: "voyage-2",
          usage: { total_tokens: 1000 },
        }),
      });

      const result = await embeddings.embed(longText);

      expect(result.embedding).toEqual(mockEmbedding);
    });

    it("should use custom base URL", async () => {
      const customEmbeddings = new VoyageEmbeddings(
        "test-api-key",
        "voyage-2",
        undefined,
        undefined,
        "https://custom.voyage.com/v1",
      );

      const mockEmbedding = Array(1024).fill(0.1);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
          model: "voyage-2",
          usage: { total_tokens: 5 },
        }),
      });

      await customEmbeddings.embed("test");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://custom.voyage.com/v1/embeddings",
        expect.any(Object),
      );
    });

    it("should throw error if no embedding returned", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [],
          model: "voyage-2",
          usage: { total_tokens: 0 },
        }),
      });

      await expect(embeddings.embed("test")).rejects.toThrow(
        "No embedding returned from Voyage AI API",
      );
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized: Invalid API key",
      });

      await expect(embeddings.embed("test")).rejects.toThrow();
    });

    it("should propagate network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network Error"));

      await expect(embeddings.embed("test")).rejects.toThrow("Network Error");
    });
  });

  describe("embedBatch", () => {
    it("should generate embeddings for multiple texts", async () => {
      const mockEmbeddings = [
        Array(1024).fill(0.1),
        Array(1024).fill(0.2),
        Array(1024).fill(0.3),
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: mockEmbeddings.map((embedding) => ({ embedding })),
          model: "voyage-2",
          usage: { total_tokens: 30 },
        }),
      });

      const texts = ["text1", "text2", "text3"];
      const results = await embeddings.embedBatch(texts);

      expect(results).toEqual([
        { embedding: mockEmbeddings[0], dimensions: 1024 },
        { embedding: mockEmbeddings[1], dimensions: 1024 },
        { embedding: mockEmbeddings[2], dimensions: 1024 },
      ]);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.input).toEqual(texts);
    });

    it("should handle empty batch", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [],
          model: "voyage-2",
          usage: { total_tokens: 0 },
        }),
      });

      const results = await embeddings.embedBatch([]);

      expect(results).toEqual([]);
    });

    it("should handle single item in batch", async () => {
      const mockEmbedding = Array(1024).fill(0.5);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
          model: "voyage-2",
          usage: { total_tokens: 10 },
        }),
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

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: mockEmbeddings.map((embedding) => ({ embedding })),
          model: "voyage-2",
          usage: { total_tokens: batchSize * 10 },
        }),
      });

      const texts = Array(batchSize)
        .fill(null)
        .map((_, i) => `text ${i}`);
      const results = await embeddings.embedBatch(texts);

      expect(results).toHaveLength(batchSize);
    });

    it("should throw error if no embeddings returned", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          model: "voyage-2",
          usage: { total_tokens: 0 },
        }),
      });

      await expect(embeddings.embedBatch(["text1"])).rejects.toThrow(
        "No embeddings returned from Voyage AI API",
      );
    });

    it("should propagate errors in batch", async () => {
      mockFetch.mockRejectedValue(new Error("Batch API Error"));

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
      const customEmbeddings = new VoyageEmbeddings(
        "test-api-key",
        "voyage-2",
        512,
      );
      expect(customEmbeddings.getDimensions()).toBe(512);
    });
  });

  describe("getModel", () => {
    it("should return configured model", () => {
      expect(embeddings.getModel()).toBe("voyage-2");
    });

    it("should return custom model", () => {
      const customEmbeddings = new VoyageEmbeddings(
        "test-api-key",
        "voyage-large-2",
      );
      expect(customEmbeddings.getModel()).toBe("voyage-large-2");
    });
  });

  describe("rate limiting", () => {
    it("should retry on rate limit error (429 status)", async () => {
      const mockEmbedding = Array(1024).fill(0.5);

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => "Rate limit exceeded",
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => "Rate limit exceeded",
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            data: [{ embedding: mockEmbedding }],
            model: "voyage-2",
            usage: { total_tokens: 10 },
          }),
        });

      const result = await embeddings.embed("test text");

      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should retry on rate limit message", async () => {
      const mockEmbedding = Array(1024).fill(0.5);

      mockFetch
        .mockRejectedValueOnce({
          message: "You have exceeded the rate limit",
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            data: [{ embedding: mockEmbedding }],
            model: "voyage-2",
            usage: { total_tokens: 10 },
          }),
        });

      const result = await embeddings.embed("test text");

      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should use exponential backoff", async () => {
      const rateLimitEmbeddings = new VoyageEmbeddings(
        "test-api-key",
        "voyage-2",
        undefined,
        {
          retryAttempts: 3,
          retryDelayMs: 100,
        },
      );

      const mockEmbedding = Array(1024).fill(0.5);

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => "Rate limit",
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => "Rate limit",
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            data: [{ embedding: mockEmbedding }],
            model: "voyage-2",
            usage: { total_tokens: 10 },
          }),
        });

      const startTime = Date.now();
      await rateLimitEmbeddings.embed("test text");
      const duration = Date.now() - startTime;

      // Should wait: 100ms (first retry) + 200ms (second retry) = 300ms
      expect(duration).toBeGreaterThanOrEqual(250);
    });

    it("should throw error after max retries exceeded", async () => {
      const rateLimitEmbeddings = new VoyageEmbeddings(
        "test-api-key",
        "voyage-2",
        undefined,
        {
          retryAttempts: 2,
          retryDelayMs: 100,
        },
      );

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Rate limit exceeded",
      });

      await expect(rateLimitEmbeddings.embed("test text")).rejects.toThrow(
        "Voyage AI API rate limit exceeded after 2 retry attempts",
      );

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should handle rate limit errors in batch operations", async () => {
      const mockEmbeddings = [Array(1024).fill(0.1), Array(1024).fill(0.2)];

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => "Rate limit",
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            data: mockEmbeddings.map((embedding) => ({ embedding })),
            model: "voyage-2",
            usage: { total_tokens: 20 },
          }),
        });

      const results = await embeddings.embedBatch(["text1", "text2"]);

      expect(results).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should not retry on non-rate-limit errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      await expect(embeddings.embed("test text")).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should accept custom rate limit configuration", () => {
      const customEmbeddings = new VoyageEmbeddings(
        "test-api-key",
        "voyage-2",
        undefined,
        {
          maxRequestsPerMinute: 500,
          retryAttempts: 5,
          retryDelayMs: 2000,
        },
      );

      expect(customEmbeddings).toBeDefined();
    });
  });
});
