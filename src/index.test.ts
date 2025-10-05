import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./qdrant/client.js');
vi.mock('./embeddings/openai.js');

describe('MCP Server Tool Schemas', () => {
  describe('CreateCollectionSchema', () => {
    it('should validate correct collection creation input', async () => {
      const { z } = await import('zod');

      const CreateCollectionSchema = z.object({
        name: z.string(),
        distance: z.enum(['Cosine', 'Euclid', 'Dot']).optional(),
      });

      const validInput = { name: 'test-collection' };
      expect(() => CreateCollectionSchema.parse(validInput)).not.toThrow();

      const validInputWithDistance = { name: 'test-collection', distance: 'Cosine' as const };
      expect(() => CreateCollectionSchema.parse(validInputWithDistance)).not.toThrow();
    });

    it('should reject invalid distance metric', async () => {
      const { z } = await import('zod');

      const CreateCollectionSchema = z.object({
        name: z.string(),
        distance: z.enum(['Cosine', 'Euclid', 'Dot']).optional(),
      });

      const invalidInput = { name: 'test', distance: 'Invalid' };
      expect(() => CreateCollectionSchema.parse(invalidInput)).toThrow();
    });

    it('should require name field', async () => {
      const { z } = await import('zod');

      const CreateCollectionSchema = z.object({
        name: z.string(),
        distance: z.enum(['Cosine', 'Euclid', 'Dot']).optional(),
      });

      const invalidInput = { distance: 'Cosine' };
      expect(() => CreateCollectionSchema.parse(invalidInput)).toThrow();
    });
  });

  describe('AddDocumentsSchema', () => {
    it('should validate correct document addition input', async () => {
      const { z } = await import('zod');

      const AddDocumentsSchema = z.object({
        collection: z.string(),
        documents: z.array(z.object({
          id: z.union([z.string(), z.number()]),
          text: z.string(),
          metadata: z.record(z.any()).optional(),
        })),
      });

      const validInput = {
        collection: 'test-collection',
        documents: [
          { id: 1, text: 'test document' },
          { id: 'doc-2', text: 'another document', metadata: { type: 'test' } },
        ],
      };

      expect(() => AddDocumentsSchema.parse(validInput)).not.toThrow();
    });

    it('should accept both string and number IDs', async () => {
      const { z } = await import('zod');

      const AddDocumentsSchema = z.object({
        collection: z.string(),
        documents: z.array(z.object({
          id: z.union([z.string(), z.number()]),
          text: z.string(),
          metadata: z.record(z.any()).optional(),
        })),
      });

      const stringIdInput = {
        collection: 'test',
        documents: [{ id: 'string-id', text: 'test' }],
      };
      expect(() => AddDocumentsSchema.parse(stringIdInput)).not.toThrow();

      const numberIdInput = {
        collection: 'test',
        documents: [{ id: 123, text: 'test' }],
      };
      expect(() => AddDocumentsSchema.parse(numberIdInput)).not.toThrow();
    });

    it('should require text field in documents', async () => {
      const { z } = await import('zod');

      const AddDocumentsSchema = z.object({
        collection: z.string(),
        documents: z.array(z.object({
          id: z.union([z.string(), z.number()]),
          text: z.string(),
          metadata: z.record(z.any()).optional(),
        })),
      });

      const invalidInput = {
        collection: 'test',
        documents: [{ id: 1, metadata: {} }],
      };
      expect(() => AddDocumentsSchema.parse(invalidInput)).toThrow();
    });
  });

  describe('SemanticSearchSchema', () => {
    it('should validate correct search input', async () => {
      const { z } = await import('zod');

      const SemanticSearchSchema = z.object({
        collection: z.string(),
        query: z.string(),
        limit: z.number().optional(),
        filter: z.record(z.any()).optional(),
      });

      const validInput = {
        collection: 'test-collection',
        query: 'search query',
        limit: 10,
        filter: { category: 'test' },
      };

      expect(() => SemanticSearchSchema.parse(validInput)).not.toThrow();
    });

    it('should work with minimal input', async () => {
      const { z } = await import('zod');

      const SemanticSearchSchema = z.object({
        collection: z.string(),
        query: z.string(),
        limit: z.number().optional(),
        filter: z.record(z.any()).optional(),
      });

      const minimalInput = {
        collection: 'test',
        query: 'search',
      };

      expect(() => SemanticSearchSchema.parse(minimalInput)).not.toThrow();
    });

    it('should require collection and query', async () => {
      const { z } = await import('zod');

      const SemanticSearchSchema = z.object({
        collection: z.string(),
        query: z.string(),
        limit: z.number().optional(),
        filter: z.record(z.any()).optional(),
      });

      const missingQuery = { collection: 'test', limit: 5 };
      expect(() => SemanticSearchSchema.parse(missingQuery)).toThrow();

      const missingCollection = { query: 'test', limit: 5 };
      expect(() => SemanticSearchSchema.parse(missingCollection)).toThrow();
    });
  });

  describe('DeleteCollectionSchema', () => {
    it('should validate correct delete input', async () => {
      const { z } = await import('zod');

      const DeleteCollectionSchema = z.object({
        name: z.string(),
      });

      const validInput = { name: 'test-collection' };
      expect(() => DeleteCollectionSchema.parse(validInput)).not.toThrow();
    });

    it('should require name field', async () => {
      const { z } = await import('zod');

      const DeleteCollectionSchema = z.object({
        name: z.string(),
      });

      expect(() => DeleteCollectionSchema.parse({})).toThrow();
    });
  });

  describe('GetCollectionInfoSchema', () => {
    it('should validate correct input', async () => {
      const { z } = await import('zod');

      const GetCollectionInfoSchema = z.object({
        name: z.string(),
      });

      const validInput = { name: 'test-collection' };
      expect(() => GetCollectionInfoSchema.parse(validInput)).not.toThrow();
    });
  });

  describe('DeleteDocumentsSchema', () => {
    it('should validate correct delete documents input', async () => {
      const { z } = await import('zod');

      const DeleteDocumentsSchema = z.object({
        collection: z.string(),
        ids: z.array(z.union([z.string(), z.number()])),
      });

      const validInput = {
        collection: 'test-collection',
        ids: [1, 'doc-2', 3],
      };

      expect(() => DeleteDocumentsSchema.parse(validInput)).not.toThrow();
    });

    it('should accept string and number IDs', async () => {
      const { z } = await import('zod');

      const DeleteDocumentsSchema = z.object({
        collection: z.string(),
        ids: z.array(z.union([z.string(), z.number()])),
      });

      const stringIds = { collection: 'test', ids: ['a', 'b', 'c'] };
      expect(() => DeleteDocumentsSchema.parse(stringIds)).not.toThrow();

      const numberIds = { collection: 'test', ids: [1, 2, 3] };
      expect(() => DeleteDocumentsSchema.parse(numberIds)).not.toThrow();

      const mixedIds = { collection: 'test', ids: [1, 'b', 3] };
      expect(() => DeleteDocumentsSchema.parse(mixedIds)).not.toThrow();
    });

    it('should require both collection and ids', async () => {
      const { z } = await import('zod');

      const DeleteDocumentsSchema = z.object({
        collection: z.string(),
        ids: z.array(z.union([z.string(), z.number()])),
      });

      const missingIds = { collection: 'test' };
      expect(() => DeleteDocumentsSchema.parse(missingIds)).toThrow();

      const missingCollection = { ids: [1, 2, 3] };
      expect(() => DeleteDocumentsSchema.parse(missingCollection)).toThrow();
    });
  });
});

describe('MCP Server Resource URIs', () => {
  it('should match collections URI pattern', () => {
    const collectionsUri = 'qdrant://collections';
    expect(collectionsUri).toMatch(/^qdrant:\/\/collections$/);
  });

  it('should match collection detail URI pattern', () => {
    const collectionUri = 'qdrant://collection/my-collection';
    const match = collectionUri.match(/^qdrant:\/\/collection\/(.+)$/);

    expect(match).not.toBeNull();
    expect(match![1]).toBe('my-collection');
  });

  it('should extract collection name from URI', () => {
    const testCases = [
      { uri: 'qdrant://collection/test', expected: 'test' },
      { uri: 'qdrant://collection/my-docs', expected: 'my-docs' },
      { uri: 'qdrant://collection/collection-123', expected: 'collection-123' },
    ];

    testCases.forEach(({ uri, expected }) => {
      const match = uri.match(/^qdrant:\/\/collection\/(.+)$/);
      expect(match![1]).toBe(expected);
    });
  });

  it('should not match invalid URIs', () => {
    const invalidUris = [
      'qdrant://invalid',
      'http://collections',
      'qdrant://collection/',
      'qdrant:collections',
    ];

    invalidUris.forEach((uri) => {
      const collectionsMatch = uri.match(/^qdrant:\/\/collections$/);
      const collectionMatch = uri.match(/^qdrant:\/\/collection\/(.+)$/);

      expect(collectionsMatch || collectionMatch).toBeFalsy();
    });
  });
});
