import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAIEmbeddings } from "./openai.js";
import OpenAI from "openai";

const mockOpenAI = {
  embeddings: {
    create: vi.fn().mockResolvedValue({ data: [{ embedding: [] }] }),
  },
};

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function () {
    return mockOpenAI;
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

describe("OpenAIEmbeddings", () => {
  let embeddings: OpenAIEmbeddings;

  beforeEach(() => {
    mockOpenAI.embeddings.create
      .mockReset()
      .mockResolvedValue({ data: [{ embedding: [] }] });
    vi.mocked(OpenAI).mockClear();
    embeddings = new OpenAIEmbeddings("test-api-key");
  });

  describe("constructor", () => {
    it("should use default model and dimensions", () => {
      expect(embeddings.getModel()).toBe("text-embedding-3-small");
      expect(embeddings.getDimensions()).toBe(1536);
    });

    it("should use custom model", () => {
      const customEmbeddings = new OpenAIEmbeddings(
        "test-api-key",
        "text-embedding-3-large",
      );
      expect(customEmbeddings.getModel()).toBe("text-embedding-3-large");
      expect(customEmbeddings.getDimensions()).toBe(3072);
    });

    it("should use custom dimensions", () => {
      const customEmbeddings = new OpenAIEmbeddings(
        "test-api-key",
        "text-embedding-3-small",
        512,
      );
      expect(customEmbeddings.getDimensions()).toBe(512);
    });

    it("should use default dimensions for text-embedding-ada-002", () => {
      const adaEmbeddings = new OpenAIEmbeddings(
        "test-api-key",
        "text-embedding-ada-002",
      );
      expect(adaEmbeddings.getDimensions()).toBe(1536);
    });
  });

  describe("embed", () => {
    it("should generate embedding for single text", async () => {
      const mockEmbedding = Array(1536)
        .fill(0)
        .map((_, i) => i * 0.001);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const result = await embeddings.embed("test text");

      expect(result).toEqual({
        embedding: mockEmbedding,
        dimensions: 1536,
      });
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: "text-embedding-3-small",
        input: "test text",
        dimensions: 1536,
      });
    });

    it("should handle long text", async () => {
      const longText = "word ".repeat(1000);
      const mockEmbedding = Array(1536).fill(0.5);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const result = await embeddings.embed(longText);

      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: "text-embedding-3-small",
        input: longText,
        dimensions: 1536,
      });
    });

    it("should use custom model configuration", async () => {
      const customEmbeddings = new OpenAIEmbeddings(
        "test-api-key",
        "text-embedding-3-large",
        3072,
      );
      const mockEmbedding = Array(3072).fill(0.1);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      await customEmbeddings.embed("test");

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: "text-embedding-3-large",
        input: "test",
        dimensions: 3072,
      });
    });

    it("should propagate errors", async () => {
      mockOpenAI.embeddings.create.mockRejectedValue(new Error("API Error"));

      await expect(embeddings.embed("test")).rejects.toThrow("API Error");
    });
  });

  describe("embedBatch", () => {
    it("should generate embeddings for multiple texts", async () => {
      const mockEmbeddings = [
        Array(1536).fill(0.1),
        Array(1536).fill(0.2),
        Array(1536).fill(0.3),
      ];
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [
          { embedding: mockEmbeddings[0] },
          { embedding: mockEmbeddings[1] },
          { embedding: mockEmbeddings[2] },
        ],
      });

      const texts = ["text1", "text2", "text3"];
      const results = await embeddings.embedBatch(texts);

      expect(results).toEqual([
        { embedding: mockEmbeddings[0], dimensions: 1536 },
        { embedding: mockEmbeddings[1], dimensions: 1536 },
        { embedding: mockEmbeddings[2], dimensions: 1536 },
      ]);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: "text-embedding-3-small",
        input: texts,
        dimensions: 1536,
      });
    });

    it("should handle empty batch", async () => {
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [],
      });

      const results = await embeddings.embedBatch([]);

      expect(results).toEqual([]);
    });

    it("should handle single item in batch", async () => {
      const mockEmbedding = Array(1536).fill(0.5);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const results = await embeddings.embedBatch(["single text"]);

      expect(results).toHaveLength(1);
      expect(results[0].embedding).toEqual(mockEmbedding);
    });

    it("should handle large batches", async () => {
      const batchSize = 100;
      const mockEmbeddings = Array(batchSize)
        .fill(null)
        .map(() => Array(1536).fill(Math.random()));

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: mockEmbeddings.map((embedding) => ({ embedding })),
      });

      const texts = Array(batchSize)
        .fill(null)
        .map((_, i) => `text ${i}`);
      const results = await embeddings.embedBatch(texts);

      expect(results).toHaveLength(batchSize);
    });

    it("should propagate errors in batch", async () => {
      mockOpenAI.embeddings.create.mockRejectedValue(
        new Error("Batch API Error"),
      );

      await expect(embeddings.embedBatch(["text1", "text2"])).rejects.toThrow(
        "Batch API Error",
      );
    });
  });

  describe("getDimensions", () => {
    it("should return configured dimensions", () => {
      expect(embeddings.getDimensions()).toBe(1536);
    });

    it("should return custom dimensions", () => {
      const customEmbeddings = new OpenAIEmbeddings(
        "test-api-key",
        "text-embedding-3-small",
        512,
      );
      expect(customEmbeddings.getDimensions()).toBe(512);
    });
  });

  describe("getModel", () => {
    it("should return configured model", () => {
      expect(embeddings.getModel()).toBe("text-embedding-3-small");
    });

    it("should return custom model", () => {
      const customEmbeddings = new OpenAIEmbeddings(
        "test-api-key",
        "text-embedding-3-large",
      );
      expect(customEmbeddings.getModel()).toBe("text-embedding-3-large");
    });
  });

  describe("rate limiting", () => {
    it("should retry on rate limit error (429 status)", async () => {
      const mockEmbedding = Array(1536).fill(0.5);

      // Fail first two times with rate limit, succeed on third
      mockOpenAI.embeddings.create
        .mockRejectedValueOnce({ status: 429, message: "Rate limit exceeded" })
        .mockRejectedValueOnce({ status: 429, message: "Rate limit exceeded" })
        .mockResolvedValue({ data: [{ embedding: mockEmbedding }] });

      const result = await embeddings.embed("test text");

      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(3);
    });

    it("should respect Retry-After header when present", async () => {
      const mockEmbedding = Array(1536).fill(0.5);
      const rateLimitError = {
        status: 429,
        message: "Rate limit exceeded",
        headers: { "retry-after": "2" },
      };

      mockOpenAI.embeddings.create
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ data: [{ embedding: mockEmbedding }] });

      const startTime = Date.now();
      await embeddings.embed("test text");
      const duration = Date.now() - startTime;

      // Should wait at least 2 seconds (2000ms)
      expect(duration).toBeGreaterThanOrEqual(1900); // Allow small margin
    });

    it("should fallback to exponential backoff with invalid Retry-After header", async () => {
      const rateLimitEmbeddings = new OpenAIEmbeddings(
        "test-api-key",
        "text-embedding-3-small",
        undefined,
        {
          retryAttempts: 2,
          retryDelayMs: 100, // 100ms for faster tests
        },
      );

      const mockEmbedding = Array(1536).fill(0.5);

      // Test various invalid Retry-After values
      const invalidRetryAfterError = {
        status: 429,
        message: "Rate limit exceeded",
        headers: { "retry-after": "invalid" }, // Non-numeric value
      };

      mockOpenAI.embeddings.create
        .mockRejectedValueOnce(invalidRetryAfterError)
        .mockResolvedValue({ data: [{ embedding: mockEmbedding }] });

      const startTime = Date.now();
      await rateLimitEmbeddings.embed("test text");
      const duration = Date.now() - startTime;

      // Should fallback to exponential backoff (100ms) instead of using invalid header
      expect(duration).toBeGreaterThanOrEqual(90); // Allow small margin
      expect(duration).toBeLessThan(500); // Should not wait too long
    });

    it("should use exponential backoff when no Retry-After header", async () => {
      const rateLimitEmbeddings = new OpenAIEmbeddings(
        "test-api-key",
        "text-embedding-3-small",
        undefined,
        {
          retryAttempts: 3,
          retryDelayMs: 100, // 100ms for faster tests
        },
      );

      const mockEmbedding = Array(1536).fill(0.5);
      const rateLimitError = {
        status: 429,
        message: "Rate limit exceeded",
      };

      mockOpenAI.embeddings.create
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ data: [{ embedding: mockEmbedding }] });

      const startTime = Date.now();
      await rateLimitEmbeddings.embed("test text");
      const duration = Date.now() - startTime;

      // Should wait: 100ms (first retry) + 200ms (second retry) = 300ms
      expect(duration).toBeGreaterThanOrEqual(250); // Allow margin for test execution
    });

    it("should throw error after max retries exceeded", async () => {
      const rateLimitEmbeddings = new OpenAIEmbeddings(
        "test-api-key",
        "text-embedding-3-small",
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

      mockOpenAI.embeddings.create.mockRejectedValue(rateLimitError);

      await expect(rateLimitEmbeddings.embed("test text")).rejects.toThrow(
        "OpenAI API rate limit exceeded after 2 retry attempts",
      );

      // Should try initial + 2 retries = 3 total attempts
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(3);
    });

    it("should handle rate limit errors in batch operations", async () => {
      const mockEmbeddings = [Array(1536).fill(0.1), Array(1536).fill(0.2)];

      mockOpenAI.embeddings.create
        .mockRejectedValueOnce({ status: 429, message: "Rate limit exceeded" })
        .mockResolvedValue({
          data: [
            { embedding: mockEmbeddings[0] },
            { embedding: mockEmbeddings[1] },
          ],
        });

      const results = await embeddings.embedBatch(["text1", "text2"]);

      expect(results).toHaveLength(2);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(2);
    });

    it("should not retry on non-rate-limit errors", async () => {
      const apiError = new Error("Invalid API key");
      mockOpenAI.embeddings.create.mockRejectedValue(apiError);

      await expect(embeddings.embed("test text")).rejects.toThrow(
        "Invalid API key",
      );
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(1);
    });

    it("should accept custom rate limit configuration", () => {
      const customEmbeddings = new OpenAIEmbeddings(
        "test-api-key",
        "text-embedding-3-small",
        undefined,
        {
          maxRequestsPerMinute: 1000,
          retryAttempts: 5,
          retryDelayMs: 2000,
        },
      );

      expect(customEmbeddings).toBeDefined();
    });
  });
});
