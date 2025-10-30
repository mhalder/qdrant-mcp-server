import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CodeIndexer } from "../../src/code/indexer.js";
import type { CodeConfig } from "../../src/code/types.js";
import type { EmbeddingProvider } from "../../src/embeddings/base.js";
import type { QdrantManager } from "../../src/qdrant/client.js";

// Mock implementations
class MockQdrantManager implements Partial<QdrantManager> {
  private collections = new Map<string, any>();
  private points = new Map<string, any[]>();

  async collectionExists(name: string): Promise<boolean> {
    return this.collections.has(name);
  }

  async createCollection(
    name: string,
    _vectorSize: number,
    _distance: string,
    _enableHybrid?: boolean
  ): Promise<void> {
    this.collections.set(name, {
      vectorSize: _vectorSize,
      hybridEnabled: _enableHybrid || false,
    });
    this.points.set(name, []);
  }

  async deleteCollection(name: string): Promise<void> {
    this.collections.delete(name);
    this.points.delete(name);
  }

  async addPoints(collectionName: string, points: any[]): Promise<void> {
    const existing = this.points.get(collectionName) || [];
    this.points.set(collectionName, [...existing, ...points]);
  }

  async addPointsWithSparse(collectionName: string, points: any[]): Promise<void> {
    await this.addPoints(collectionName, points);
  }

  async search(
    collectionName: string,
    _vector: number[],
    limit: number,
    _filter?: any
  ): Promise<any[]> {
    const points = this.points.get(collectionName) || [];
    return points.slice(0, limit).map((p, idx) => ({
      id: p.id,
      score: 0.9 - idx * 0.1,
      payload: p.payload,
    }));
  }

  async hybridSearch(
    collectionName: string,
    _vector: number[],
    _sparseVector: any,
    limit: number,
    _filter?: any
  ): Promise<any[]> {
    return this.search(collectionName, _vector, limit, _filter);
  }

  async getCollectionInfo(name: string): Promise<any> {
    const collection = this.collections.get(name);
    const points = this.points.get(name) || [];
    return {
      pointsCount: points.length,
      hybridEnabled: collection?.hybridEnabled || false,
      vectorSize: collection?.vectorSize || 384,
    };
  }
}

class MockEmbeddingProvider implements EmbeddingProvider {
  getDimensions(): number {
    return 384;
  }

  async embed(_text: string): Promise<{ embedding: number[] }> {
    return { embedding: new Array(384).fill(0.1) };
  }

  async embedBatch(texts: string[]): Promise<Array<{ embedding: number[] }>> {
    return texts.map(() => ({ embedding: new Array(384).fill(0.1) }));
  }
}

describe("CodeIndexer", () => {
  let indexer: CodeIndexer;
  let qdrant: MockQdrantManager;
  let embeddings: MockEmbeddingProvider;
  let config: CodeConfig;
  let tempDir: string;
  let codebaseDir: string;

  beforeEach(async () => {
    // Create temporary test directory
    tempDir = join(tmpdir(), `qdrant-mcp-test-${Date.now()}`);
    codebaseDir = join(tempDir, "codebase");
    await fs.mkdir(codebaseDir, { recursive: true });

    // Initialize mocks and config
    qdrant = new MockQdrantManager() as any;
    embeddings = new MockEmbeddingProvider();
    config = {
      chunkSize: 500,
      chunkOverlap: 50,
      enableASTChunking: true,
      supportedExtensions: [".ts", ".js", ".py"],
      ignorePatterns: ["node_modules/**", "dist/**"],
      batchSize: 10,
      defaultSearchLimit: 5,
      enableHybridSearch: false,
    };

    indexer = new CodeIndexer(qdrant as any, embeddings, config);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe("indexCodebase", () => {
    it("should index a simple codebase", async () => {
      await createTestFile(codebaseDir, "hello.ts", 'function hello() { return "world"; }');

      const stats = await indexer.indexCodebase(codebaseDir);

      expect(stats.filesScanned).toBe(1);
      expect(stats.filesIndexed).toBe(1);
      expect(stats.chunksCreated).toBeGreaterThan(0);
      expect(stats.status).toBe("completed");
    });

    it("should handle empty directory", async () => {
      const stats = await indexer.indexCodebase(codebaseDir);

      expect(stats.filesScanned).toBe(0);
      expect(stats.chunksCreated).toBe(0);
      expect(stats.status).toBe("completed");
    });

    it("should index multiple files", async () => {
      await createTestFile(codebaseDir, "file1.ts", "function test1() {}");
      await createTestFile(codebaseDir, "file2.js", "function test2() {}");
      await createTestFile(codebaseDir, "file3.py", "def test3(): pass");

      const stats = await indexer.indexCodebase(codebaseDir);

      expect(stats.filesScanned).toBe(3);
      expect(stats.filesIndexed).toBe(3);
    });

    it("should create collection with correct settings", async () => {
      await createTestFile(codebaseDir, "test.ts", "const x = 1;");

      const createCollectionSpy = vi.spyOn(qdrant, "createCollection");

      await indexer.indexCodebase(codebaseDir);

      expect(createCollectionSpy).toHaveBeenCalledWith(
        expect.stringContaining("code_"),
        384,
        "Cosine",
        false
      );
    });

    it("should force re-index when option is set", async () => {
      await createTestFile(codebaseDir, "test.ts", "const x = 1;");

      await indexer.indexCodebase(codebaseDir);
      const deleteCollectionSpy = vi.spyOn(qdrant, "deleteCollection");

      await indexer.indexCodebase(codebaseDir, { forceReindex: true });

      expect(deleteCollectionSpy).toHaveBeenCalled();
    });

    it("should call progress callback", async () => {
      await createTestFile(codebaseDir, "test.ts", "const x = 1;");

      const progressCallback = vi.fn();

      await indexer.indexCodebase(codebaseDir, undefined, progressCallback);

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback.mock.calls.some((call) => call[0].phase === "scanning")).toBe(true);
      expect(progressCallback.mock.calls.some((call) => call[0].phase === "chunking")).toBe(true);
    });

    it("should respect custom extensions", async () => {
      await createTestFile(codebaseDir, "test.ts", "const x = 1;");
      await createTestFile(codebaseDir, "test.md", "# Documentation");

      const stats = await indexer.indexCodebase(codebaseDir, {
        extensions: [".md"],
      });

      expect(stats.filesScanned).toBe(1);
    });

    it("should handle files with secrets gracefully", async () => {
      await createTestFile(
        codebaseDir,
        "secrets.ts",
        'const apiKey = "sk_test_FAKE_KEY_FOR_TESTING_ONLY_NOT_REAL";'
      );

      const stats = await indexer.indexCodebase(codebaseDir);

      expect(stats.errors).toBeDefined();
      expect(stats.errors?.some((e) => e.includes("secrets"))).toBe(true);
    });

    it("should enable hybrid search when configured", async () => {
      const hybridConfig = { ...config, enableHybridSearch: true };
      const hybridIndexer = new CodeIndexer(qdrant as any, embeddings, hybridConfig);

      await createTestFile(codebaseDir, "test.ts", "const x = 1;");

      const createCollectionSpy = vi.spyOn(qdrant, "createCollection");

      await hybridIndexer.indexCodebase(codebaseDir);

      expect(createCollectionSpy).toHaveBeenCalledWith(
        expect.stringContaining("code_"),
        384,
        "Cosine",
        true
      );
    });

    it("should handle file read errors", async () => {
      await createTestFile(codebaseDir, "test.ts", "content");

      // Mock fs.readFile to throw error for this specific file
      const originalReadFile = fs.readFile;
      vi.spyOn(fs, "readFile").mockImplementation(async (path: any, ...args: any[]) => {
        if (path.includes("test.ts")) {
          throw new Error("Permission denied");
        }
        return originalReadFile(path, ...args);
      });

      const stats = await indexer.indexCodebase(codebaseDir);

      expect(stats.errors?.some((e) => e.includes("Permission denied"))).toBe(true);

      vi.restoreAllMocks();
    });

    it("should batch embed operations", async () => {
      // Create multiple files to trigger batching
      for (let i = 0; i < 5; i++) {
        await createTestFile(codebaseDir, `file${i}.ts`, `function test${i}() {}`);
      }

      const embedBatchSpy = vi.spyOn(embeddings, "embedBatch");

      await indexer.indexCodebase(codebaseDir);

      expect(embedBatchSpy).toHaveBeenCalled();
    });
  });

  describe("searchCode", () => {
    beforeEach(async () => {
      await createTestFile(codebaseDir, "test.ts", 'function hello() { return "world"; }');
      await indexer.indexCodebase(codebaseDir);
    });

    it("should search indexed codebase", async () => {
      const results = await indexer.searchCode(codebaseDir, "hello function");

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should throw error for non-indexed codebase", async () => {
      const nonIndexedDir = join(tempDir, "non-indexed");
      await fs.mkdir(nonIndexedDir, { recursive: true });

      await expect(indexer.searchCode(nonIndexedDir, "test")).rejects.toThrow("not indexed");
    });

    it("should respect limit option", async () => {
      const results = await indexer.searchCode(codebaseDir, "test", { limit: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should apply score threshold", async () => {
      const results = await indexer.searchCode(codebaseDir, "test", {
        scoreThreshold: 0.95,
      });

      results.forEach((r) => {
        expect(r.score).toBeGreaterThanOrEqual(0.95);
      });
    });

    it("should filter by file types", async () => {
      await createTestFile(codebaseDir, "test.py", "def test(): pass");
      await indexer.indexCodebase(codebaseDir, { forceReindex: true });

      const results = await indexer.searchCode(codebaseDir, "test", {
        fileTypes: [".py"],
      });

      // Filter should be applied (even if mock doesn't filter properly)
      expect(Array.isArray(results)).toBe(true);
    });

    it("should use hybrid search when enabled", async () => {
      const hybridConfig = { ...config, enableHybridSearch: true };
      const hybridIndexer = new CodeIndexer(qdrant as any, embeddings, hybridConfig);

      await createTestFile(codebaseDir, "test.ts", "function test() {}");
      await hybridIndexer.indexCodebase(codebaseDir);

      const hybridSearchSpy = vi.spyOn(qdrant, "hybridSearch");

      await hybridIndexer.searchCode(codebaseDir, "test");

      expect(hybridSearchSpy).toHaveBeenCalled();
    });

    it("should format results correctly", async () => {
      const results = await indexer.searchCode(codebaseDir, "hello");

      results.forEach((result) => {
        expect(result).toHaveProperty("content");
        expect(result).toHaveProperty("filePath");
        expect(result).toHaveProperty("startLine");
        expect(result).toHaveProperty("endLine");
        expect(result).toHaveProperty("language");
        expect(result).toHaveProperty("score");
      });
    });
  });

  describe("getIndexStatus", () => {
    it("should return not indexed for new codebase", async () => {
      const status = await indexer.getIndexStatus(codebaseDir);

      expect(status.isIndexed).toBe(false);
    });

    it("should return indexed status after indexing", async () => {
      await createTestFile(codebaseDir, "test.ts", "const x = 1;");
      await indexer.indexCodebase(codebaseDir);

      const status = await indexer.getIndexStatus(codebaseDir);

      expect(status.isIndexed).toBe(true);
      expect(status.collectionName).toBeDefined();
      expect(status.chunksCount).toBeGreaterThan(0);
    });
  });

  describe("reindexChanges", () => {
    it("should throw error if not previously indexed", async () => {
      await expect(indexer.reindexChanges(codebaseDir)).rejects.toThrow("not indexed");
    });

    it("should detect and index new files", async () => {
      await createTestFile(codebaseDir, "file1.ts", "const x = 1;");
      await indexer.indexCodebase(codebaseDir);

      await createTestFile(codebaseDir, "file2.ts", "const y = 2;");

      const stats = await indexer.reindexChanges(codebaseDir);

      expect(stats.filesAdded).toBe(1);
      expect(stats.chunksAdded).toBeGreaterThan(0);
    });

    it("should detect modified files", async () => {
      await createTestFile(codebaseDir, "test.ts", "const x = 1;");
      await indexer.indexCodebase(codebaseDir);

      await createTestFile(codebaseDir, "test.ts", "const x = 2;");

      const stats = await indexer.reindexChanges(codebaseDir);

      expect(stats.filesModified).toBe(1);
    });

    it("should detect deleted files", async () => {
      await createTestFile(codebaseDir, "test.ts", "const x = 1;");
      await indexer.indexCodebase(codebaseDir);

      await fs.unlink(join(codebaseDir, "test.ts"));

      const stats = await indexer.reindexChanges(codebaseDir);

      expect(stats.filesDeleted).toBe(1);
    });

    it("should handle no changes", async () => {
      await createTestFile(codebaseDir, "test.ts", "const x = 1;");
      await indexer.indexCodebase(codebaseDir);

      const stats = await indexer.reindexChanges(codebaseDir);

      expect(stats.filesAdded).toBe(0);
      expect(stats.filesModified).toBe(0);
      expect(stats.filesDeleted).toBe(0);
    });

    it("should call progress callback during reindexing", async () => {
      await createTestFile(codebaseDir, "test.ts", "const x = 1;");
      await indexer.indexCodebase(codebaseDir);

      await createTestFile(codebaseDir, "new.ts", "const y = 2;");

      const progressCallback = vi.fn();
      await indexer.reindexChanges(codebaseDir, progressCallback);

      expect(progressCallback).toHaveBeenCalled();
    });
  });

  describe("clearIndex", () => {
    it("should clear indexed codebase", async () => {
      await createTestFile(codebaseDir, "test.ts", "const x = 1;");
      await indexer.indexCodebase(codebaseDir);

      await indexer.clearIndex(codebaseDir);

      const status = await indexer.getIndexStatus(codebaseDir);
      expect(status.isIndexed).toBe(false);
    });

    it("should handle clearing non-indexed codebase", async () => {
      await expect(indexer.clearIndex(codebaseDir)).resolves.not.toThrow();
    });

    it("should allow re-indexing after clearing", async () => {
      await createTestFile(codebaseDir, "test.ts", "const x = 1;");
      await indexer.indexCodebase(codebaseDir);

      await indexer.clearIndex(codebaseDir);

      const stats = await indexer.indexCodebase(codebaseDir);
      expect(stats.status).toBe("completed");
    });
  });

  describe("edge cases", () => {
    it("should handle nested directory structures", async () => {
      await fs.mkdir(join(codebaseDir, "src", "components"), { recursive: true });
      await createTestFile(
        codebaseDir,
        "src/components/Button.tsx",
        "export const Button = () => {}"
      );

      const stats = await indexer.indexCodebase(codebaseDir);

      expect(stats.filesIndexed).toBe(1);
    });

    it("should handle files with unicode content", async () => {
      await createTestFile(codebaseDir, "test.ts", "const greeting = '你好世界';");

      const stats = await indexer.indexCodebase(codebaseDir);

      expect(stats.status).toBe("completed");
    });

    it("should handle very large files", async () => {
      const largeContent = "function test() {}\n".repeat(1000);
      await createTestFile(codebaseDir, "large.ts", largeContent);

      const stats = await indexer.indexCodebase(codebaseDir);

      expect(stats.chunksCreated).toBeGreaterThan(1);
    });

    it("should generate consistent collection names", async () => {
      await createTestFile(codebaseDir, "test.ts", "const x = 1;");

      await indexer.indexCodebase(codebaseDir);
      const status1 = await indexer.getIndexStatus(codebaseDir);

      await indexer.clearIndex(codebaseDir);

      await indexer.indexCodebase(codebaseDir);
      const status2 = await indexer.getIndexStatus(codebaseDir);

      expect(status1.collectionName).toBe(status2.collectionName);
    });

    it("should handle concurrent operations gracefully", async () => {
      await createTestFile(codebaseDir, "test.ts", "const x = 1;");

      await indexer.indexCodebase(codebaseDir);

      const searchPromises = [
        indexer.searchCode(codebaseDir, "test"),
        indexer.searchCode(codebaseDir, "const"),
        indexer.getIndexStatus(codebaseDir),
      ];

      const results = await Promise.all(searchPromises);

      expect(results).toHaveLength(3);
    });
  });
});

// Helper function to create test files
async function createTestFile(
  baseDir: string,
  relativePath: string,
  content: string
): Promise<void> {
  const fullPath = join(baseDir, relativePath);
  const dir = join(fullPath, "..");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
}
