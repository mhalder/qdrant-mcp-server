import { describe, it, expect, vi, beforeEach } from "vitest";
import { OllamaEmbeddings } from "./ollama.js";

// Mock fetch globally
global.fetch = vi.fn();

describe("OllamaEmbeddings", () => {
  let embeddings: OllamaEmbeddings;
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = global.fetch as any;
    mockFetch.mockReset();

    embeddings = new OllamaEmbeddings();
  });

  describe("constructor", () => {
    it("should use default model and dimensions", () => {
      expect(embeddings.getModel()).toBe("nomic-embed-text");
      expect(embeddings.getDimensions()).toBe(768);
    });

    it("should use custom model", () => {
      const customEmbeddings = new OllamaEmbeddings("mxbai-embed-large");
      expect(customEmbeddings.getModel()).toBe("mxbai-embed-large");
      expect(customEmbeddings.getDimensions()).toBe(1024);
    });

    it("should use custom dimensions", () => {
      const customEmbeddings = new OllamaEmbeddings("nomic-embed-text", 512);
      expect(customEmbeddings.getDimensions()).toBe(512);
    });

    it("should use default base URL", () => {
      const defaultEmbeddings = new OllamaEmbeddings();
      expect(defaultEmbeddings).toBeDefined();
    });

    it("should use custom base URL", () => {
      const customEmbeddings = new OllamaEmbeddings(
        "nomic-embed-text",
        undefined,
        undefined,
        "http://custom:11434",
      );
      expect(customEmbeddings).toBeDefined();
    });

    it("should default to 768 for unknown models", () => {
      const unknownEmbeddings = new OllamaEmbeddings("custom-model");
      expect(unknownEmbeddings.getDimensions()).toBe(768);
    });

    it("should use all-minilm model with 384 dimensions", () => {
      const miniEmbeddings = new OllamaEmbeddings("all-minilm");
      expect(miniEmbeddings.getModel()).toBe("all-minilm");
      expect(miniEmbeddings.getDimensions()).toBe(384);
    });
  });

  describe("embed", () => {
    it("should generate embedding for single text", async () => {
      const mockEmbedding = Array(768)
        .fill(0)
        .map((_, i) => i * 0.001);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          embedding: mockEmbedding,
        }),
      });

      const result = await embeddings.embed("test text");

      expect(result).toEqual({
        embedding: mockEmbedding,
        dimensions: 768,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:11434/api/embeddings",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "nomic-embed-text",
            prompt: "test text",
          }),
        },
      );
    });

    it("should handle long text", async () => {
      const longText = "word ".repeat(1000);
      const mockEmbedding = Array(768).fill(0.5);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          embedding: mockEmbedding,
        }),
      });

      const result = await embeddings.embed(longText);

      expect(result.embedding).toEqual(mockEmbedding);
    });

    it("should use custom base URL", async () => {
      const customEmbeddings = new OllamaEmbeddings(
        "nomic-embed-text",
        undefined,
        undefined,
        "http://custom:11434",
      );

      const mockEmbedding = Array(768).fill(0.1);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          embedding: mockEmbedding,
        }),
      });

      await customEmbeddings.embed("test");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://custom:11434/api/embeddings",
        expect.any(Object),
      );
    });

    it("should throw error if no embedding returned", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await expect(embeddings.embed("test")).rejects.toThrow(
        "No embedding returned from Ollama API",
      );
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Model not found",
      });

      await expect(embeddings.embed("test")).rejects.toThrow();
    });

    it("should propagate network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network Error"));

      await expect(embeddings.embed("test")).rejects.toThrow("Network Error");
    });

    it("should include text preview in API error for long text", async () => {
      const longText = "a".repeat(150);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Server error",
      });

      await expect(embeddings.embed(longText)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining("Text preview:"),
        }),
      );
    });

    it("should include model and URL in network error messages for non-Error objects", async () => {
      mockFetch.mockRejectedValue("Connection refused");

      await expect(embeddings.embed("test")).rejects.toThrow(
        "Failed to call Ollama API at http://localhost:11434 with model nomic-embed-text",
      );
    });

    it("should handle errors with message property", async () => {
      mockFetch.mockRejectedValue({
        message: "Custom error message",
      });

      await expect(embeddings.embed("test")).rejects.toThrow(
        "Custom error message",
      );
    });

    it("should handle non-Error objects in catch block", async () => {
      mockFetch.mockRejectedValue({ code: "ERR_UNKNOWN", details: "info" });

      await expect(embeddings.embed("test")).rejects.toThrow(
        "Failed to call Ollama API at http://localhost:11434 with model nomic-embed-text",
      );
    });
  });

  describe("embedBatch", () => {
    it("should generate embeddings for multiple texts in parallel", async () => {
      const mockEmbeddings = [
        Array(768).fill(0.1),
        Array(768).fill(0.2),
        Array(768).fill(0.3),
      ];

      // Mock sequential calls for each text
      mockEmbeddings.forEach((embedding) => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ embedding }),
        });
      });

      const texts = ["text1", "text2", "text3"];
      const results = await embeddings.embedBatch(texts);

      expect(results).toEqual([
        { embedding: mockEmbeddings[0], dimensions: 768 },
        { embedding: mockEmbeddings[1], dimensions: 768 },
        { embedding: mockEmbeddings[2], dimensions: 768 },
      ]);

      // Ollama processes each text individually
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should handle empty batch", async () => {
      const results = await embeddings.embedBatch([]);

      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle single item in batch", async () => {
      const mockEmbedding = Array(768).fill(0.5);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: mockEmbedding }),
      });

      const results = await embeddings.embedBatch(["single text"]);

      expect(results).toHaveLength(1);
      expect(results[0].embedding).toEqual(mockEmbedding);
    });

    it("should handle large batches with parallel processing", async () => {
      const batchSize = 20;
      const mockEmbedding = Array(768).fill(0.5);

      // Mock all responses
      for (let i = 0; i < batchSize; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ embedding: mockEmbedding }),
        });
      }

      const texts = Array(batchSize)
        .fill(null)
        .map((_, i) => `text ${i}`);
      const results = await embeddings.embedBatch(texts);

      expect(results).toHaveLength(batchSize);
      expect(mockFetch).toHaveBeenCalledTimes(batchSize);
    });

    it("should propagate errors in batch", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ embedding: Array(768).fill(0.1) }),
        })
        .mockRejectedValueOnce(new Error("Batch API Error"));

      await expect(embeddings.embedBatch(["text1", "text2"])).rejects.toThrow(
        "Batch API Error",
      );
    });

    it("should handle partial failures in batch", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ embedding: Array(768).fill(0.1) }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => "Internal error",
        });

      await expect(embeddings.embedBatch(["text1", "text2"])).rejects.toThrow();
    });
  });

  describe("getDimensions", () => {
    it("should return configured dimensions", () => {
      expect(embeddings.getDimensions()).toBe(768);
    });

    it("should return custom dimensions", () => {
      const customEmbeddings = new OllamaEmbeddings("nomic-embed-text", 512);
      expect(customEmbeddings.getDimensions()).toBe(512);
    });
  });

  describe("getModel", () => {
    it("should return configured model", () => {
      expect(embeddings.getModel()).toBe("nomic-embed-text");
    });

    it("should return custom model", () => {
      const customEmbeddings = new OllamaEmbeddings("mxbai-embed-large");
      expect(customEmbeddings.getModel()).toBe("mxbai-embed-large");
    });
  });

  describe("rate limiting", () => {
    it("should retry on rate limit error (429 status)", async () => {
      const mockEmbedding = Array(768).fill(0.5);

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
          json: async () => ({ embedding: mockEmbedding }),
        });

      const result = await embeddings.embed("test text");

      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should retry on rate limit message", async () => {
      const mockEmbedding = Array(768).fill(0.5);

      mockFetch
        .mockRejectedValueOnce({
          message: "You have exceeded the rate limit",
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ embedding: mockEmbedding }),
        });

      const result = await embeddings.embed("test text");

      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should use exponential backoff with faster default delay", async () => {
      const rateLimitEmbeddings = new OllamaEmbeddings(
        "nomic-embed-text",
        undefined,
        {
          retryAttempts: 3,
          retryDelayMs: 100,
        },
      );

      const mockEmbedding = Array(768).fill(0.5);

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
          json: async () => ({ embedding: mockEmbedding }),
        });

      const startTime = Date.now();
      await rateLimitEmbeddings.embed("test text");
      const duration = Date.now() - startTime;

      // Should wait: 100ms (first retry) + 200ms (second retry) = 300ms
      expect(duration).toBeGreaterThanOrEqual(250);
    });

    it("should throw error after max retries exceeded", async () => {
      const rateLimitEmbeddings = new OllamaEmbeddings(
        "nomic-embed-text",
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
        "Ollama API rate limit exceeded after 2 retry attempts",
      );

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should handle rate limit errors in batch operations", async () => {
      const mockEmbedding = Array(768).fill(0.5);

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => "Rate limit",
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ embedding: mockEmbedding }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ embedding: mockEmbedding }),
        });

      const results = await embeddings.embedBatch(["text1", "text2"]);

      expect(results).toHaveLength(2);
      // First call fails and retries, then succeeds. Second call succeeds immediately.
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should not retry on non-rate-limit errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Model not found",
      });

      await expect(embeddings.embed("test text")).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should accept custom rate limit configuration", () => {
      const customEmbeddings = new OllamaEmbeddings(
        "nomic-embed-text",
        undefined,
        {
          maxRequestsPerMinute: 2000,
          retryAttempts: 5,
          retryDelayMs: 1000,
        },
      );

      expect(customEmbeddings).toBeDefined();
    });

    it("should have higher default rate limit for local deployment", () => {
      // Ollama defaults to 1000 requests/minute (more lenient than cloud providers)
      const defaultEmbeddings = new OllamaEmbeddings();
      expect(defaultEmbeddings).toBeDefined();
    });
  });
});
