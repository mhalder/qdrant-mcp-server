import { QdrantClient } from "@qdrant/js-client-rest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QdrantManager } from "./client.js";

const mockClient = {
  createCollection: vi.fn().mockResolvedValue({}),
  getCollection: vi.fn().mockResolvedValue({}),
  getCollections: vi.fn().mockResolvedValue({ collections: [] }),
  deleteCollection: vi.fn().mockResolvedValue({}),
  upsert: vi.fn().mockResolvedValue({}),
  search: vi.fn().mockResolvedValue([]),
  retrieve: vi.fn().mockResolvedValue([]),
  delete: vi.fn().mockResolvedValue({}),
  query: vi.fn().mockResolvedValue({ points: [] }),
};

vi.mock("@qdrant/js-client-rest", () => ({
  QdrantClient: vi.fn().mockImplementation(function () {
    return mockClient;
  }),
}));

describe("QdrantManager", () => {
  let manager: QdrantManager;

  beforeEach(() => {
    // Reset mocks and restore default implementations
    mockClient.createCollection.mockReset().mockResolvedValue({});
    mockClient.getCollection.mockReset().mockResolvedValue({});
    mockClient.getCollections
      .mockReset()
      .mockResolvedValue({ collections: [] });
    mockClient.deleteCollection.mockReset().mockResolvedValue({});
    mockClient.upsert.mockReset().mockResolvedValue({});
    mockClient.search.mockReset().mockResolvedValue([]);
    mockClient.retrieve.mockReset().mockResolvedValue([]);
    mockClient.delete.mockReset().mockResolvedValue({});
    mockClient.query.mockReset().mockResolvedValue({ points: [] });
    vi.mocked(QdrantClient).mockClear();
    manager = new QdrantManager("http://localhost:6333");
  });

  describe("constructor", () => {
    it("should pass apiKey to QdrantClient when provided", () => {
      new QdrantManager("http://localhost:6333", "test-api-key");

      expect(QdrantClient).toHaveBeenCalledWith({
        url: "http://localhost:6333",
        apiKey: "test-api-key",
      });
    });

    it("should work without apiKey for unauthenticated instances", () => {
      new QdrantManager("http://localhost:6333");

      expect(QdrantClient).toHaveBeenCalledWith({
        url: "http://localhost:6333",
        apiKey: undefined,
      });
    });
  });

  describe("createCollection", () => {
    it("should create a collection with default distance metric", async () => {
      await manager.createCollection("test-collection", 1536);

      expect(mockClient.createCollection).toHaveBeenCalledWith(
        "test-collection",
        {
          vectors: {
            size: 1536,
            distance: "Cosine",
          },
        },
      );
    });

    it("should create a collection with custom distance metric", async () => {
      await manager.createCollection("test-collection", 1536, "Euclid");

      expect(mockClient.createCollection).toHaveBeenCalledWith(
        "test-collection",
        {
          vectors: {
            size: 1536,
            distance: "Euclid",
          },
        },
      );
    });

    it("should create a hybrid collection with sparse vectors enabled", async () => {
      await manager.createCollection("test-collection", 1536, "Cosine", true);

      expect(mockClient.createCollection).toHaveBeenCalledWith(
        "test-collection",
        {
          vectors: {
            dense: {
              size: 1536,
              distance: "Cosine",
            },
          },
          sparse_vectors: {
            text: {
              modifier: "idf",
            },
          },
        },
      );
    });
  });

  describe("collectionExists", () => {
    it("should return true if collection exists", async () => {
      mockClient.getCollection.mockResolvedValue({ collection_name: "test" });

      const exists = await manager.collectionExists("test");

      expect(exists).toBe(true);
      expect(mockClient.getCollection).toHaveBeenCalledWith("test");
    });

    it("should return false if collection does not exist", async () => {
      mockClient.getCollection.mockRejectedValue(new Error("Not found"));

      const exists = await manager.collectionExists("test");

      expect(exists).toBe(false);
    });
  });

  describe("listCollections", () => {
    it("should return list of collection names", async () => {
      mockClient.getCollections.mockResolvedValue({
        collections: [
          { name: "collection1" },
          { name: "collection2" },
          { name: "collection3" },
        ],
      });

      const collections = await manager.listCollections();

      expect(collections).toEqual([
        "collection1",
        "collection2",
        "collection3",
      ]);
    });

    it("should return empty array when no collections exist", async () => {
      mockClient.getCollections.mockResolvedValue({
        collections: [],
      });

      const collections = await manager.listCollections();

      expect(collections).toEqual([]);
    });
  });

  describe("getCollectionInfo", () => {
    it("should return collection info with vector configuration", async () => {
      mockClient.getCollection.mockResolvedValue({
        collection_name: "test-collection",
        points_count: 100,
        config: {
          params: {
            vectors: {
              size: 1536,
              distance: "Cosine",
            },
          },
        },
      });

      const info = await manager.getCollectionInfo("test-collection");

      expect(info).toEqual({
        name: "test-collection",
        vectorSize: 1536,
        pointsCount: 100,
        distance: "Cosine",
        hybridEnabled: false,
      });
    });

    it("should handle missing points_count", async () => {
      mockClient.getCollection.mockResolvedValue({
        collection_name: "test-collection",
        config: {
          params: {
            vectors: {
              size: 1536,
              distance: "Dot",
            },
          },
        },
      });

      const info = await manager.getCollectionInfo("test-collection");

      expect(info.pointsCount).toBe(0);
    });

    it("should return hybrid collection info with named vectors", async () => {
      mockClient.getCollection.mockResolvedValue({
        collection_name: "hybrid-collection",
        points_count: 50,
        config: {
          params: {
            vectors: {
              dense: {
                size: 768,
                distance: "Cosine",
              },
            },
            sparse_vectors: {
              text: {
                modifier: "idf",
              },
            },
          },
        },
      });

      const info = await manager.getCollectionInfo("hybrid-collection");

      expect(info).toEqual({
        name: "hybrid-collection",
        vectorSize: 768,
        pointsCount: 50,
        distance: "Cosine",
        hybridEnabled: true,
      });
    });
  });

  describe("deleteCollection", () => {
    it("should delete a collection", async () => {
      await manager.deleteCollection("test-collection");

      expect(mockClient.deleteCollection).toHaveBeenCalledWith(
        "test-collection",
      );
    });
  });

  describe("addPoints", () => {
    it("should add points to a collection", async () => {
      const points = [
        { id: 1, vector: [0.1, 0.2, 0.3], payload: { text: "test" } },
        { id: 2, vector: [0.4, 0.5, 0.6], payload: { text: "test2" } },
      ];

      await manager.addPoints("test-collection", points);

      expect(mockClient.upsert).toHaveBeenCalledWith("test-collection", {
        wait: true,
        points,
      });
    });

    it("should add points without payload", async () => {
      const points = [{ id: 1, vector: [0.1, 0.2, 0.3] }];

      await manager.addPoints("test-collection", points);

      expect(mockClient.upsert).toHaveBeenCalledWith("test-collection", {
        wait: true,
        points,
      });
    });

    it("should normalize string IDs to UUID format", async () => {
      const points = [
        {
          id: "my-custom-id",
          vector: [0.1, 0.2, 0.3],
          payload: { text: "test" },
        },
      ];

      await manager.addPoints("test-collection", points);

      // Verify the ID was normalized to UUID format
      const calls = mockClient.upsert.mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toBe("test-collection");

      const normalizedId = calls[0][1].points[0].id;
      // Check that it's a valid UUID format
      expect(normalizedId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      // Ensure it's not the original ID
      expect(normalizedId).not.toBe("my-custom-id");
    });

    it("should preserve UUID format IDs without modification", async () => {
      const uuidId = "123e4567-e89b-12d3-a456-426614174000";
      const points = [
        { id: uuidId, vector: [0.1, 0.2, 0.3], payload: { text: "test" } },
      ];

      await manager.addPoints("test-collection", points);

      // UUID should remain unchanged
      expect(mockClient.upsert).toHaveBeenCalledWith("test-collection", {
        wait: true,
        points: [
          {
            id: uuidId,
            vector: [0.1, 0.2, 0.3],
            payload: { text: "test" },
          },
        ],
      });
    });

    it("should throw error with error.data.status.error message", async () => {
      const points = [{ id: 1, vector: [0.1, 0.2, 0.3] }];

      mockClient.upsert.mockRejectedValue({
        data: {
          status: {
            error: "Vector dimension mismatch",
          },
        },
      });

      await expect(
        manager.addPoints("test-collection", points),
      ).rejects.toThrow(
        'Failed to add points to collection "test-collection": Vector dimension mismatch',
      );
    });

    it("should throw error with error.message fallback", async () => {
      const points = [{ id: 1, vector: [0.1, 0.2, 0.3] }];

      mockClient.upsert.mockRejectedValue(new Error("Network error"));

      await expect(
        manager.addPoints("test-collection", points),
      ).rejects.toThrow(
        'Failed to add points to collection "test-collection": Network error',
      );
    });

    it("should throw error with String(error) fallback", async () => {
      const points = [{ id: 1, vector: [0.1, 0.2, 0.3] }];

      mockClient.upsert.mockRejectedValue("Unknown error");

      await expect(
        manager.addPoints("test-collection", points),
      ).rejects.toThrow(
        'Failed to add points to collection "test-collection": Unknown error',
      );
    });
  });

  describe("search", () => {
    beforeEach(() => {
      // Mock getCollection for standard collection by default
      mockClient.getCollection.mockResolvedValue({
        collection_name: "test-collection",
        points_count: 100,
        config: {
          params: {
            vectors: {
              size: 768,
              distance: "Cosine",
            },
          },
        },
      });
    });

    it("should search for similar vectors", async () => {
      mockClient.search.mockResolvedValue([
        { id: 1, score: 0.95, payload: { text: "result1" } },
        { id: 2, score: 0.85, payload: { text: "result2" } },
      ]);

      const results = await manager.search(
        "test-collection",
        [0.1, 0.2, 0.3],
        5,
      );

      expect(results).toEqual([
        { id: 1, score: 0.95, payload: { text: "result1" } },
        { id: 2, score: 0.85, payload: { text: "result2" } },
      ]);
      expect(mockClient.search).toHaveBeenCalledWith("test-collection", {
        vector: [0.1, 0.2, 0.3],
        limit: 5,
        filter: undefined,
      });
    });

    it("should search with custom limit", async () => {
      mockClient.search.mockResolvedValue([]);

      await manager.search("test-collection", [0.1, 0.2, 0.3], 10);

      expect(mockClient.search).toHaveBeenCalledWith("test-collection", {
        vector: [0.1, 0.2, 0.3],
        limit: 10,
        filter: undefined,
      });
    });

    it("should search with Qdrant format filter (must)", async () => {
      mockClient.search.mockResolvedValue([]);

      const filter = { must: [{ key: "category", match: { value: "test" } }] };
      await manager.search("test-collection", [0.1, 0.2, 0.3], 5, filter);

      expect(mockClient.search).toHaveBeenCalledWith("test-collection", {
        vector: [0.1, 0.2, 0.3],
        limit: 5,
        filter,
      });
    });

    it("should convert simple key-value filter to Qdrant format", async () => {
      mockClient.search.mockResolvedValue([]);

      const simpleFilter = { category: "database", type: "document" };
      await manager.search("test-collection", [0.1, 0.2, 0.3], 5, simpleFilter);

      expect(mockClient.search).toHaveBeenCalledWith("test-collection", {
        vector: [0.1, 0.2, 0.3],
        limit: 5,
        filter: {
          must: [
            { key: "category", match: { value: "database" } },
            { key: "type", match: { value: "document" } },
          ],
        },
      });
    });

    it("should handle empty filter object", async () => {
      mockClient.search.mockResolvedValue([]);

      await manager.search("test-collection", [0.1, 0.2, 0.3], 5, {});

      expect(mockClient.search).toHaveBeenCalledWith("test-collection", {
        vector: [0.1, 0.2, 0.3],
        limit: 5,
        filter: undefined,
      });
    });

    it("should search with Qdrant format filter (should)", async () => {
      mockClient.search.mockResolvedValue([]);

      const filter = {
        should: [{ key: "tag", match: { value: "important" } }],
      };
      await manager.search("test-collection", [0.1, 0.2, 0.3], 5, filter);

      expect(mockClient.search).toHaveBeenCalledWith("test-collection", {
        vector: [0.1, 0.2, 0.3],
        limit: 5,
        filter,
      });
    });

    it("should search with Qdrant format filter (must_not)", async () => {
      mockClient.search.mockResolvedValue([]);

      const filter = {
        must_not: [{ key: "status", match: { value: "deleted" } }],
      };
      await manager.search("test-collection", [0.1, 0.2, 0.3], 5, filter);

      expect(mockClient.search).toHaveBeenCalledWith("test-collection", {
        vector: [0.1, 0.2, 0.3],
        limit: 5,
        filter,
      });
    });

    it("should handle null payload in results", async () => {
      mockClient.search.mockResolvedValue([
        { id: 1, score: 0.95, payload: null },
      ]);

      const results = await manager.search("test-collection", [0.1, 0.2, 0.3]);

      expect(results).toEqual([{ id: 1, score: 0.95, payload: undefined }]);
    });

    it("should use named vector for hybrid-enabled collections", async () => {
      // Mock getCollectionInfo to return hybrid enabled collection
      mockClient.getCollection.mockResolvedValue({
        collection_name: "hybrid-collection",
        points_count: 10,
        config: {
          params: {
            vectors: {
              dense: {
                size: 768,
                distance: "Cosine",
              },
            },
            sparse_vectors: {
              text: {
                modifier: "idf",
              },
            },
          },
        },
      });

      mockClient.search.mockResolvedValue([
        { id: 1, score: 0.95, payload: { text: "result1" } },
      ]);

      const results = await manager.search(
        "hybrid-collection",
        [0.1, 0.2, 0.3],
        5,
      );

      expect(results).toEqual([
        { id: 1, score: 0.95, payload: { text: "result1" } },
      ]);
      expect(mockClient.search).toHaveBeenCalledWith("hybrid-collection", {
        vector: { name: "dense", vector: [0.1, 0.2, 0.3] },
        limit: 5,
        filter: undefined,
      });
    });

    it("should use unnamed vector for standard collections", async () => {
      // Mock getCollectionInfo to return standard collection (no sparse vectors)
      mockClient.getCollection.mockResolvedValue({
        collection_name: "standard-collection",
        points_count: 10,
        config: {
          params: {
            vectors: {
              size: 768,
              distance: "Cosine",
            },
          },
        },
      });

      mockClient.search.mockResolvedValue([
        { id: 1, score: 0.95, payload: { text: "result1" } },
      ]);

      const results = await manager.search(
        "standard-collection",
        [0.1, 0.2, 0.3],
        5,
      );

      expect(results).toEqual([
        { id: 1, score: 0.95, payload: { text: "result1" } },
      ]);
      expect(mockClient.search).toHaveBeenCalledWith("standard-collection", {
        vector: [0.1, 0.2, 0.3],
        limit: 5,
        filter: undefined,
      });
    });
  });

  describe("getPoint", () => {
    it("should retrieve a point by id", async () => {
      mockClient.retrieve.mockResolvedValue([
        { id: 1, payload: { text: "test" } },
      ]);

      const point = await manager.getPoint("test-collection", 1);

      expect(point).toEqual({ id: 1, payload: { text: "test" } });
      expect(mockClient.retrieve).toHaveBeenCalledWith("test-collection", {
        ids: [1],
      });
    });

    it("should return null if point not found", async () => {
      mockClient.retrieve.mockResolvedValue([]);

      const point = await manager.getPoint("test-collection", 1);

      expect(point).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      mockClient.retrieve.mockRejectedValue(new Error("Not found"));

      const point = await manager.getPoint("test-collection", 1);

      expect(point).toBeNull();
    });

    it("should handle null payload", async () => {
      mockClient.retrieve.mockResolvedValue([{ id: 1, payload: null }]);

      const point = await manager.getPoint("test-collection", 1);

      expect(point).toEqual({ id: 1, payload: undefined });
    });
  });

  describe("deletePoints", () => {
    it("should delete points by ids", async () => {
      await manager.deletePoints("test-collection", [1, 2, 3]);

      expect(mockClient.delete).toHaveBeenCalledWith("test-collection", {
        wait: true,
        points: [1, 2, 3],
      });
    });

    it("should delete single point", async () => {
      await manager.deletePoints("test-collection", ["doc-1"]);

      expect(mockClient.delete).toHaveBeenCalledWith("test-collection", {
        wait: true,
        points: ["bb0e4f49-4437-94d9-01e8-969ff11bd112"], // Normalized UUID from 'doc-1'
      });
    });
  });

  describe("deletePointsByFilter", () => {
    it("should delete points matching filter", async () => {
      const filter = {
        must: [{ key: "relativePath", match: { value: "src/test.ts" } }],
      };
      await manager.deletePointsByFilter("test-collection", filter);

      expect(mockClient.delete).toHaveBeenCalledWith("test-collection", {
        wait: true,
        filter: filter,
      });
    });

    it("should delete points with complex filter", async () => {
      const filter = {
        must: [
          { key: "relativePath", match: { value: "src/utils.ts" } },
          { key: "language", match: { value: "typescript" } },
        ],
      };
      await manager.deletePointsByFilter("test-collection", filter);

      expect(mockClient.delete).toHaveBeenCalledWith("test-collection", {
        wait: true,
        filter: filter,
      });
    });
  });

  describe("hybridSearch", () => {
    beforeEach(() => {
      mockClient.query = vi.fn();
    });

    it("should perform hybrid search with dense and sparse vectors", async () => {
      const denseVector = [0.1, 0.2, 0.3];
      const sparseVector = { indices: [1, 5, 10], values: [0.5, 0.3, 0.2] };

      mockClient.query.mockResolvedValue({
        points: [
          { id: 1, score: 0.95, payload: { text: "result1" } },
          { id: 2, score: 0.85, payload: { text: "result2" } },
        ],
      });

      const results = await manager.hybridSearch(
        "test-collection",
        denseVector,
        sparseVector,
      );

      expect(results).toEqual([
        { id: 1, score: 0.95, payload: { text: "result1" } },
        { id: 2, score: 0.85, payload: { text: "result2" } },
      ]);

      expect(mockClient.query).toHaveBeenCalledWith("test-collection", {
        prefetch: [
          {
            query: denseVector,
            using: "dense",
            limit: 20,
            filter: undefined,
          },
          {
            query: sparseVector,
            using: "text",
            limit: 20,
            filter: undefined,
          },
        ],
        query: {
          fusion: "rrf",
        },
        limit: 5,
        with_payload: true,
      });
    });

    it("should use custom limit with appropriate prefetch limit", async () => {
      const denseVector = [0.1, 0.2, 0.3];
      const sparseVector = { indices: [1, 5], values: [0.5, 0.3] };

      mockClient.query.mockResolvedValue({ points: [] });

      await manager.hybridSearch(
        "test-collection",
        denseVector,
        sparseVector,
        10,
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        "test-collection",
        expect.objectContaining({
          prefetch: expect.arrayContaining([
            expect.objectContaining({ limit: 40 }), // 10 * 4
          ]),
          limit: 10,
        }),
      );
    });

    it("should convert simple filter to Qdrant format", async () => {
      const denseVector = [0.1, 0.2, 0.3];
      const sparseVector = { indices: [1], values: [0.5] };
      const filter = { category: "test", type: "doc" };

      mockClient.query.mockResolvedValue({ points: [] });

      await manager.hybridSearch(
        "test-collection",
        denseVector,
        sparseVector,
        5,
        filter,
      );

      expect(mockClient.query).toHaveBeenCalledWith("test-collection", {
        prefetch: [
          {
            query: denseVector,
            using: "dense",
            limit: 20,
            filter: {
              must: [
                { key: "category", match: { value: "test" } },
                { key: "type", match: { value: "doc" } },
              ],
            },
          },
          {
            query: sparseVector,
            using: "text",
            limit: 20,
            filter: {
              must: [
                { key: "category", match: { value: "test" } },
                { key: "type", match: { value: "doc" } },
              ],
            },
          },
        ],
        query: {
          fusion: "rrf",
        },
        limit: 5,
        with_payload: true,
      });
    });

    it("should handle Qdrant format filter (must)", async () => {
      const denseVector = [0.1, 0.2, 0.3];
      const sparseVector = { indices: [1], values: [0.5] };
      const filter = { must: [{ key: "status", match: { value: "active" } }] };

      mockClient.query.mockResolvedValue({ points: [] });

      await manager.hybridSearch(
        "test-collection",
        denseVector,
        sparseVector,
        5,
        filter,
      );

      const call = mockClient.query.mock.calls[0][1];
      expect(call.prefetch[0].filter).toEqual(filter);
      expect(call.prefetch[1].filter).toEqual(filter);
    });

    it("should handle Qdrant format filter (should)", async () => {
      const denseVector = [0.1, 0.2, 0.3];
      const sparseVector = { indices: [1], values: [0.5] };
      const filter = {
        should: [{ key: "tag", match: { value: "important" } }],
      };

      mockClient.query.mockResolvedValue({ points: [] });

      await manager.hybridSearch(
        "test-collection",
        denseVector,
        sparseVector,
        5,
        filter,
      );

      const call = mockClient.query.mock.calls[0][1];
      expect(call.prefetch[0].filter).toEqual(filter);
      expect(call.prefetch[1].filter).toEqual(filter);
    });

    it("should handle Qdrant format filter (must_not)", async () => {
      const denseVector = [0.1, 0.2, 0.3];
      const sparseVector = { indices: [1], values: [0.5] };
      const filter = {
        must_not: [{ key: "status", match: { value: "deleted" } }],
      };

      mockClient.query.mockResolvedValue({ points: [] });

      await manager.hybridSearch(
        "test-collection",
        denseVector,
        sparseVector,
        5,
        filter,
      );

      const call = mockClient.query.mock.calls[0][1];
      expect(call.prefetch[0].filter).toEqual(filter);
      expect(call.prefetch[1].filter).toEqual(filter);
    });

    it("should handle empty filter object", async () => {
      const denseVector = [0.1, 0.2, 0.3];
      const sparseVector = { indices: [1], values: [0.5] };

      mockClient.query.mockResolvedValue({ points: [] });

      await manager.hybridSearch(
        "test-collection",
        denseVector,
        sparseVector,
        5,
        {},
      );

      const call = mockClient.query.mock.calls[0][1];
      expect(call.prefetch[0].filter).toBeUndefined();
      expect(call.prefetch[1].filter).toBeUndefined();
    });

    it("should handle null payload in results", async () => {
      const denseVector = [0.1, 0.2, 0.3];
      const sparseVector = { indices: [1], values: [0.5] };

      mockClient.query.mockResolvedValue({
        points: [{ id: 1, score: 0.95, payload: null }],
      });

      const results = await manager.hybridSearch(
        "test-collection",
        denseVector,
        sparseVector,
      );

      expect(results).toEqual([{ id: 1, score: 0.95, payload: undefined }]);
    });

    it("should throw error with error.data.status.error message", async () => {
      const denseVector = [0.1, 0.2, 0.3];
      const sparseVector = { indices: [1], values: [0.5] };

      mockClient.query.mockRejectedValue({
        data: {
          status: {
            error: "Named vector not found",
          },
        },
      });

      await expect(
        manager.hybridSearch("test-collection", denseVector, sparseVector),
      ).rejects.toThrow(
        'Hybrid search failed on collection "test-collection": Named vector not found',
      );
    });

    it("should throw error with error.message fallback", async () => {
      const denseVector = [0.1, 0.2, 0.3];
      const sparseVector = { indices: [1], values: [0.5] };

      mockClient.query.mockRejectedValue(new Error("Network timeout"));

      await expect(
        manager.hybridSearch("test-collection", denseVector, sparseVector),
      ).rejects.toThrow(
        'Hybrid search failed on collection "test-collection": Network timeout',
      );
    });

    it("should throw error with String(error) fallback", async () => {
      const denseVector = [0.1, 0.2, 0.3];
      const sparseVector = { indices: [1], values: [0.5] };

      mockClient.query.mockRejectedValue("Unknown error");

      await expect(
        manager.hybridSearch("test-collection", denseVector, sparseVector),
      ).rejects.toThrow(
        'Hybrid search failed on collection "test-collection": Unknown error',
      );
    });
  });

  describe("addPointsWithSparse", () => {
    it("should add points with dense and sparse vectors", async () => {
      const points = [
        {
          id: 1,
          vector: [0.1, 0.2, 0.3],
          sparseVector: { indices: [1, 5], values: [0.5, 0.3] },
          payload: { text: "test" },
        },
        {
          id: 2,
          vector: [0.4, 0.5, 0.6],
          sparseVector: { indices: [2, 8], values: [0.4, 0.6] },
          payload: { text: "test2" },
        },
      ];

      await manager.addPointsWithSparse("test-collection", points);

      expect(mockClient.upsert).toHaveBeenCalledWith("test-collection", {
        wait: true,
        points: [
          {
            id: 1,
            vector: {
              dense: [0.1, 0.2, 0.3],
              text: { indices: [1, 5], values: [0.5, 0.3] },
            },
            payload: { text: "test" },
          },
          {
            id: 2,
            vector: {
              dense: [0.4, 0.5, 0.6],
              text: { indices: [2, 8], values: [0.4, 0.6] },
            },
            payload: { text: "test2" },
          },
        ],
      });
    });

    it("should add points without payload", async () => {
      const points = [
        {
          id: 1,
          vector: [0.1, 0.2, 0.3],
          sparseVector: { indices: [1], values: [0.5] },
        },
      ];

      await manager.addPointsWithSparse("test-collection", points);

      expect(mockClient.upsert).toHaveBeenCalledWith("test-collection", {
        wait: true,
        points: [
          {
            id: 1,
            vector: {
              dense: [0.1, 0.2, 0.3],
              text: { indices: [1], values: [0.5] },
            },
            payload: undefined,
          },
        ],
      });
    });

    it("should normalize string IDs to UUID format", async () => {
      const points = [
        {
          id: "my-doc-id",
          vector: [0.1, 0.2, 0.3],
          sparseVector: { indices: [1], values: [0.5] },
          payload: { text: "test" },
        },
      ];

      await manager.addPointsWithSparse("test-collection", points);

      const calls = mockClient.upsert.mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toBe("test-collection");

      const normalizedId = calls[0][1].points[0].id;
      // Check that it's a valid UUID format
      expect(normalizedId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(normalizedId).not.toBe("my-doc-id");
    });

    it("should preserve UUID format IDs without modification", async () => {
      const uuidId = "123e4567-e89b-12d3-a456-426614174000";
      const points = [
        {
          id: uuidId,
          vector: [0.1, 0.2, 0.3],
          sparseVector: { indices: [1], values: [0.5] },
          payload: { text: "test" },
        },
      ];

      await manager.addPointsWithSparse("test-collection", points);

      expect(mockClient.upsert).toHaveBeenCalledWith("test-collection", {
        wait: true,
        points: [
          {
            id: uuidId,
            vector: {
              dense: [0.1, 0.2, 0.3],
              text: { indices: [1], values: [0.5] },
            },
            payload: { text: "test" },
          },
        ],
      });
    });

    it("should throw error with error.data.status.error message", async () => {
      const points = [
        {
          id: 1,
          vector: [0.1, 0.2, 0.3],
          sparseVector: { indices: [1], values: [0.5] },
        },
      ];

      mockClient.upsert.mockRejectedValue({
        data: {
          status: {
            error: "Sparse vector not configured",
          },
        },
      });

      await expect(
        manager.addPointsWithSparse("test-collection", points),
      ).rejects.toThrow(
        'Failed to add points with sparse vectors to collection "test-collection": Sparse vector not configured',
      );
    });

    it("should throw error with error.message fallback", async () => {
      const points = [
        {
          id: 1,
          vector: [0.1, 0.2, 0.3],
          sparseVector: { indices: [1], values: [0.5] },
        },
      ];

      mockClient.upsert.mockRejectedValue(new Error("Connection refused"));

      await expect(
        manager.addPointsWithSparse("test-collection", points),
      ).rejects.toThrow(
        'Failed to add points with sparse vectors to collection "test-collection": Connection refused',
      );
    });

    it("should throw error with String(error) fallback", async () => {
      const points = [
        {
          id: 1,
          vector: [0.1, 0.2, 0.3],
          sparseVector: { indices: [1], values: [0.5] },
        },
      ];

      mockClient.upsert.mockRejectedValue("Unexpected error");

      await expect(
        manager.addPointsWithSparse("test-collection", points),
      ).rejects.toThrow(
        'Failed to add points with sparse vectors to collection "test-collection": Unexpected error',
      );
    });
  });
});
