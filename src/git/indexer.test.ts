import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHistoryIndexer } from "./indexer.js";
import { DEFAULT_GIT_CONFIG } from "./config.js";
import type { GitConfig } from "./types.js";

// Create mock instances
const mockExtractorInstance = {
  validateRepository: vi.fn(),
  getLatestCommitHash: vi.fn(),
  getCommits: vi.fn(),
  getCommitDiff: vi.fn(),
};

const mockChunkerInstance = {
  classifyCommitType: vi.fn(),
  createChunks: vi.fn(),
  generateChunkId: vi.fn(),
};

const mockSynchronizerInstance = {
  initialize: vi.fn(),
  getLastCommitHash: vi.fn(),
  getLastIndexedAt: vi.fn(),
  getCommitsIndexed: vi.fn(),
  updateSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
};

// Mock dependencies using class syntax
vi.mock("./extractor.js", () => {
  return {
    GitExtractor: class MockGitExtractor {
      validateRepository = mockExtractorInstance.validateRepository;
      getLatestCommitHash = mockExtractorInstance.getLatestCommitHash;
      getCommits = mockExtractorInstance.getCommits;
      getCommitDiff = mockExtractorInstance.getCommitDiff;
    },
  };
});

vi.mock("./chunker.js", () => {
  return {
    CommitChunker: class MockCommitChunker {
      classifyCommitType = mockChunkerInstance.classifyCommitType;
      createChunks = mockChunkerInstance.createChunks;
      generateChunkId = mockChunkerInstance.generateChunkId;
    },
  };
});

vi.mock("./sync/synchronizer.js", () => {
  return {
    GitSynchronizer: class MockGitSynchronizer {
      initialize = mockSynchronizerInstance.initialize;
      getLastCommitHash = mockSynchronizerInstance.getLastCommitHash;
      getLastIndexedAt = mockSynchronizerInstance.getLastIndexedAt;
      getCommitsIndexed = mockSynchronizerInstance.getCommitsIndexed;
      updateSnapshot = mockSynchronizerInstance.updateSnapshot;
      deleteSnapshot = mockSynchronizerInstance.deleteSnapshot;
    },
  };
});

vi.mock("node:fs", () => ({
  promises: {
    realpath: vi.fn().mockImplementation((p) => Promise.resolve(p)),
  },
}));

describe("GitHistoryIndexer", () => {
  let indexer: GitHistoryIndexer;
  let mockQdrant: any;
  let mockEmbeddings: any;
  const config: GitConfig = { ...DEFAULT_GIT_CONFIG };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock instances
    mockExtractorInstance.validateRepository.mockResolvedValue(true);
    mockExtractorInstance.getLatestCommitHash.mockResolvedValue("abc123def456");
    mockExtractorInstance.getCommits.mockResolvedValue([]);
    mockExtractorInstance.getCommitDiff.mockResolvedValue("");

    mockChunkerInstance.classifyCommitType.mockReturnValue("feat");
    mockChunkerInstance.createChunks.mockReturnValue([
      {
        content: "test content",
        metadata: {
          commitHash: "abc123",
          shortHash: "abc12",
          author: "Test",
          authorEmail: "test@example.com",
          date: "2024-01-15T10:00:00Z",
          subject: "test commit",
          commitType: "feat",
          files: [],
          insertions: 0,
          deletions: 0,
          repoPath: "/test/repo",
        },
      },
    ]);
    mockChunkerInstance.generateChunkId.mockReturnValue("gitcommit_abc123");

    mockSynchronizerInstance.initialize.mockResolvedValue(false);
    mockSynchronizerInstance.getLastCommitHash.mockReturnValue(null);
    mockSynchronizerInstance.getLastIndexedAt.mockReturnValue(null);
    mockSynchronizerInstance.getCommitsIndexed.mockReturnValue(0);
    mockSynchronizerInstance.updateSnapshot.mockResolvedValue(undefined);
    mockSynchronizerInstance.deleteSnapshot.mockResolvedValue(undefined);

    mockQdrant = {
      collectionExists: vi.fn().mockResolvedValue(false),
      createCollection: vi.fn().mockResolvedValue(undefined),
      deleteCollection: vi.fn().mockResolvedValue(undefined),
      getCollectionInfo: vi
        .fn()
        .mockResolvedValue({ pointsCount: 0, hybridEnabled: false }),
      addPoints: vi.fn().mockResolvedValue(undefined),
      addPointsWithSparse: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
      hybridSearch: vi.fn().mockResolvedValue([]),
      getPoint: vi.fn().mockResolvedValue(null),
    };

    mockEmbeddings = {
      getDimensions: vi.fn().mockReturnValue(768),
      embed: vi.fn().mockResolvedValue({ embedding: Array(768).fill(0.5) }),
      embedBatch: vi
        .fn()
        .mockResolvedValue([{ embedding: Array(768).fill(0.5) }]),
    };

    indexer = new GitHistoryIndexer(mockQdrant, mockEmbeddings, config);
  });

  describe("indexHistory", () => {
    it("should index commits successfully", async () => {
      const mockCommits = [
        {
          hash: "abc123",
          shortHash: "abc12",
          author: "John Doe",
          authorEmail: "john@example.com",
          date: new Date("2024-01-15"),
          subject: "feat: add feature",
          body: "",
          files: ["src/file.ts"],
          insertions: 10,
          deletions: 5,
        },
      ];

      mockExtractorInstance.validateRepository.mockResolvedValue(true);
      mockExtractorInstance.getLatestCommitHash.mockResolvedValue("abc123");
      mockExtractorInstance.getCommits.mockResolvedValue(mockCommits);
      mockExtractorInstance.getCommitDiff.mockResolvedValue("diff content");

      const stats = await indexer.indexHistory("/test/repo");

      expect(stats.status).toBe("completed");
      expect(stats.commitsScanned).toBe(1);
      expect(mockQdrant.createCollection).toHaveBeenCalled();
      expect(mockEmbeddings.embedBatch).toHaveBeenCalled();
      expect(mockQdrant.addPoints).toHaveBeenCalled();
    });

    it("should fail for non-git repository", async () => {
      mockExtractorInstance.validateRepository.mockResolvedValue(false);

      const stats = await indexer.indexHistory("/not/a/repo");

      expect(stats.status).toBe("failed");
      expect(
        stats.errors?.some((e) => e.includes("Not a valid git repository")),
      ).toBe(true);
    });

    it("should handle empty repository", async () => {
      mockExtractorInstance.validateRepository.mockResolvedValue(true);
      mockExtractorInstance.getCommits.mockResolvedValue([]);

      const stats = await indexer.indexHistory("/empty/repo");

      expect(stats.status).toBe("completed");
      expect(stats.commitsScanned).toBe(0);
      expect(stats.chunksCreated).toBe(0);
    });

    it("should delete existing collection when forceReindex is true", async () => {
      mockQdrant.collectionExists.mockResolvedValue(true);
      mockExtractorInstance.validateRepository.mockResolvedValue(true);
      mockExtractorInstance.getLatestCommitHash.mockResolvedValue("abc123");
      mockExtractorInstance.getCommits.mockResolvedValue([]);

      await indexer.indexHistory("/test/repo", { forceReindex: true });

      expect(mockQdrant.deleteCollection).toHaveBeenCalled();
      expect(mockQdrant.createCollection).toHaveBeenCalled();
    });

    it("should call progress callback during indexing", async () => {
      const mockCommits = [
        {
          hash: "abc123",
          shortHash: "abc12",
          author: "Test",
          authorEmail: "test@example.com",
          date: new Date(),
          subject: "test",
          body: "",
          files: [],
          insertions: 0,
          deletions: 0,
        },
      ];

      mockExtractorInstance.validateRepository.mockResolvedValue(true);
      mockExtractorInstance.getLatestCommitHash.mockResolvedValue("abc123");
      mockExtractorInstance.getCommits.mockResolvedValue(mockCommits);
      mockExtractorInstance.getCommitDiff.mockResolvedValue("");

      const progressCallback = vi.fn();

      await indexer.indexHistory("/test/repo", {}, progressCallback);

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: expect.stringMatching(/extracting|chunking|embedding|storing/),
        }),
      );
    });
  });

  describe("searchHistory", () => {
    beforeEach(() => {
      mockQdrant.collectionExists.mockResolvedValue(true);
    });

    it("should search indexed history", async () => {
      mockQdrant.search.mockResolvedValue([
        {
          score: 0.9,
          payload: {
            content: "test content",
            commitHash: "abc123",
            shortHash: "abc12",
            author: "John Doe",
            date: "2024-01-15T10:00:00Z",
            subject: "feat: add feature",
            commitType: "feat",
            files: ["src/file.ts"],
          },
        },
      ]);

      const results = await indexer.searchHistory("/test/repo", "add feature");

      expect(results).toHaveLength(1);
      expect(results[0].shortHash).toBe("abc12");
      expect(results[0].score).toBe(0.9);
      expect(mockEmbeddings.embed).toHaveBeenCalledWith("add feature");
    });

    it("should throw error when history not indexed", async () => {
      mockQdrant.collectionExists.mockResolvedValue(false);

      await expect(
        indexer.searchHistory("/test/repo", "query"),
      ).rejects.toThrow("Git history not indexed");
    });

    it("should apply commit type filter", async () => {
      mockQdrant.search.mockResolvedValue([]);

      await indexer.searchHistory("/test/repo", "query", {
        commitTypes: ["fix", "feat"],
      });

      expect(mockQdrant.search).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.any(Number),
        expect.objectContaining({
          must: expect.arrayContaining([
            expect.objectContaining({
              key: "commitType",
              match: { any: ["fix", "feat"] },
            }),
          ]),
        }),
      );
    });

    it("should apply date range filter", async () => {
      mockQdrant.search.mockResolvedValue([]);

      await indexer.searchHistory("/test/repo", "query", {
        dateFrom: "2024-01-01",
        dateTo: "2024-12-31",
      });

      expect(mockQdrant.search).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.any(Number),
        expect.objectContaining({
          must: expect.arrayContaining([
            expect.objectContaining({
              key: "date",
              range: { gte: "2024-01-01" },
            }),
            expect.objectContaining({
              key: "date",
              range: { lte: "2024-12-31" },
            }),
          ]),
        }),
      );
    });

    it("should apply score threshold", async () => {
      mockQdrant.search.mockResolvedValue([
        { score: 0.9, payload: { commitHash: "abc" } },
        { score: 0.5, payload: { commitHash: "xyz" } },
      ]);

      const results = await indexer.searchHistory("/test/repo", "query", {
        scoreThreshold: 0.7,
      });

      expect(results).toHaveLength(1);
      expect(results[0].score).toBe(0.9);
    });
  });

  describe("getIndexStatus", () => {
    it("should return not_indexed when collection does not exist", async () => {
      mockQdrant.collectionExists.mockResolvedValue(false);

      const status = await indexer.getIndexStatus("/test/repo");

      expect(status.status).toBe("not_indexed");
      expect(status.isIndexed).toBe(false);
    });

    it("should return indexed when collection exists and complete", async () => {
      mockQdrant.collectionExists.mockResolvedValue(true);
      mockQdrant.getPoint.mockResolvedValue({
        payload: {
          indexingComplete: true,
          completedAt: "2024-01-15T10:00:00Z",
        },
      });
      mockQdrant.getCollectionInfo.mockResolvedValue({
        pointsCount: 101,
        hybridEnabled: false,
      });

      const status = await indexer.getIndexStatus("/test/repo");

      expect(status.status).toBe("indexed");
      expect(status.isIndexed).toBe(true);
      expect(status.chunksCount).toBe(100); // 101 - 1 for metadata
    });

    it("should return indexing when in progress", async () => {
      mockQdrant.collectionExists.mockResolvedValue(true);
      mockQdrant.getPoint.mockResolvedValue({
        payload: {
          indexingComplete: false,
          startedAt: "2024-01-15T10:00:00Z",
        },
      });
      mockQdrant.getCollectionInfo.mockResolvedValue({
        pointsCount: 50,
        hybridEnabled: false,
      });

      const status = await indexer.getIndexStatus("/test/repo");

      expect(status.status).toBe("indexing");
      expect(status.isIndexed).toBe(false);
    });
  });

  describe("indexNewCommits", () => {
    it("should index only new commits", async () => {
      mockQdrant.collectionExists.mockResolvedValue(true);

      const mockNewCommits = [
        {
          hash: "new123",
          shortHash: "new12",
          author: "Test",
          authorEmail: "test@example.com",
          date: new Date(),
          subject: "new commit",
          body: "",
          files: [],
          insertions: 5,
          deletions: 2,
        },
      ];

      mockExtractorInstance.getCommits.mockResolvedValue(mockNewCommits);
      mockExtractorInstance.getCommitDiff.mockResolvedValue("");
      mockExtractorInstance.getLatestCommitHash.mockResolvedValue("new123");

      mockSynchronizerInstance.initialize.mockResolvedValue(true);
      mockSynchronizerInstance.getLastCommitHash.mockReturnValue("old123");
      mockSynchronizerInstance.getCommitsIndexed.mockReturnValue(50);

      const stats = await indexer.indexNewCommits("/test/repo");

      expect(stats.newCommits).toBe(1);
      expect(stats.chunksAdded).toBe(1);
    });

    it("should throw error when no snapshot exists", async () => {
      mockQdrant.collectionExists.mockResolvedValue(true);
      mockSynchronizerInstance.initialize.mockResolvedValue(false);

      await expect(indexer.indexNewCommits("/test/repo")).rejects.toThrow(
        "No previous snapshot found",
      );
    });

    it("should return 0 when no new commits", async () => {
      mockQdrant.collectionExists.mockResolvedValue(true);
      mockExtractorInstance.getCommits.mockResolvedValue([]);
      mockSynchronizerInstance.initialize.mockResolvedValue(true);
      mockSynchronizerInstance.getLastCommitHash.mockReturnValue("abc123");

      const stats = await indexer.indexNewCommits("/test/repo");

      expect(stats.newCommits).toBe(0);
      expect(stats.chunksAdded).toBe(0);
    });
  });

  describe("clearIndex", () => {
    it("should delete collection and snapshot", async () => {
      mockQdrant.collectionExists.mockResolvedValue(true);

      await indexer.clearIndex("/test/repo");

      expect(mockQdrant.deleteCollection).toHaveBeenCalled();
      expect(mockSynchronizerInstance.deleteSnapshot).toHaveBeenCalled();
    });

    it("should not throw when collection does not exist", async () => {
      mockQdrant.collectionExists.mockResolvedValue(false);

      await expect(indexer.clearIndex("/test/repo")).resolves.not.toThrow();
    });
  });
});
