import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIEmbeddings } from './openai.js';
import OpenAI from 'openai';

vi.mock('openai', () => ({
  default: vi.fn(),
}));

describe('OpenAIEmbeddings', () => {
  let embeddings: OpenAIEmbeddings;
  let mockOpenAI: any;

  beforeEach(() => {
    mockOpenAI = {
      embeddings: {
        create: vi.fn(),
      },
    };

    vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as any);

    embeddings = new OpenAIEmbeddings('test-api-key');
  });

  describe('constructor', () => {
    it('should use default model and dimensions', () => {
      expect(embeddings.getModel()).toBe('text-embedding-3-small');
      expect(embeddings.getDimensions()).toBe(1536);
    });

    it('should use custom model', () => {
      const customEmbeddings = new OpenAIEmbeddings('test-api-key', 'text-embedding-3-large');
      expect(customEmbeddings.getModel()).toBe('text-embedding-3-large');
      expect(customEmbeddings.getDimensions()).toBe(3072);
    });

    it('should use custom dimensions', () => {
      const customEmbeddings = new OpenAIEmbeddings('test-api-key', 'text-embedding-3-small', 512);
      expect(customEmbeddings.getDimensions()).toBe(512);
    });

    it('should use default dimensions for text-embedding-ada-002', () => {
      const adaEmbeddings = new OpenAIEmbeddings('test-api-key', 'text-embedding-ada-002');
      expect(adaEmbeddings.getDimensions()).toBe(1536);
    });
  });

  describe('embed', () => {
    it('should generate embedding for single text', async () => {
      const mockEmbedding = Array(1536).fill(0).map((_, i) => i * 0.001);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const result = await embeddings.embed('test text');

      expect(result).toEqual({
        embedding: mockEmbedding,
        dimensions: 1536,
      });
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'test text',
        dimensions: 1536,
      });
    });

    it('should handle long text', async () => {
      const longText = 'word '.repeat(1000);
      const mockEmbedding = Array(1536).fill(0.5);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const result = await embeddings.embed(longText);

      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: longText,
        dimensions: 1536,
      });
    });

    it('should use custom model configuration', async () => {
      const customEmbeddings = new OpenAIEmbeddings('test-api-key', 'text-embedding-3-large', 3072);
      const mockEmbedding = Array(3072).fill(0.1);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      await customEmbeddings.embed('test');

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-large',
        input: 'test',
        dimensions: 3072,
      });
    });

    it('should propagate errors', async () => {
      mockOpenAI.embeddings.create.mockRejectedValue(new Error('API Error'));

      await expect(embeddings.embed('test')).rejects.toThrow('API Error');
    });
  });

  describe('embedBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
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

      const texts = ['text1', 'text2', 'text3'];
      const results = await embeddings.embedBatch(texts);

      expect(results).toEqual([
        { embedding: mockEmbeddings[0], dimensions: 1536 },
        { embedding: mockEmbeddings[1], dimensions: 1536 },
        { embedding: mockEmbeddings[2], dimensions: 1536 },
      ]);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: texts,
        dimensions: 1536,
      });
    });

    it('should handle empty batch', async () => {
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [],
      });

      const results = await embeddings.embedBatch([]);

      expect(results).toEqual([]);
    });

    it('should handle single item in batch', async () => {
      const mockEmbedding = Array(1536).fill(0.5);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const results = await embeddings.embedBatch(['single text']);

      expect(results).toHaveLength(1);
      expect(results[0].embedding).toEqual(mockEmbedding);
    });

    it('should handle large batches', async () => {
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

    it('should propagate errors in batch', async () => {
      mockOpenAI.embeddings.create.mockRejectedValue(new Error('Batch API Error'));

      await expect(embeddings.embedBatch(['text1', 'text2'])).rejects.toThrow('Batch API Error');
    });
  });

  describe('getDimensions', () => {
    it('should return configured dimensions', () => {
      expect(embeddings.getDimensions()).toBe(1536);
    });

    it('should return custom dimensions', () => {
      const customEmbeddings = new OpenAIEmbeddings('test-api-key', 'text-embedding-3-small', 512);
      expect(customEmbeddings.getDimensions()).toBe(512);
    });
  });

  describe('getModel', () => {
    it('should return configured model', () => {
      expect(embeddings.getModel()).toBe('text-embedding-3-small');
    });

    it('should return custom model', () => {
      const customEmbeddings = new OpenAIEmbeddings('test-api-key', 'text-embedding-3-large');
      expect(customEmbeddings.getModel()).toBe('text-embedding-3-large');
    });
  });
});
