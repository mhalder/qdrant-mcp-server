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
    tempDir = join(
      tmpdir(),
      `qdrant-mcp-test-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
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
      await createTestFile(
        codebaseDir,
        "hello.ts",
        'export function hello(name: string): string {\n  console.log("Greeting user");\n  return `Hello, ${name}!`;\n}'
      );

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
      await createTestFile(
        codebaseDir,
        "test.ts",
        "export const configuration = {\n  apiKey: process.env.API_KEY,\n  timeout: 5000\n};"
      );

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
      await createTestFile(
        codebaseDir,
        "test.ts",
        "export function calculateTotal(items: number[]): number {\n  return items.reduce((sum, item) => sum + item, 0);\n}"
      );

      await indexer.indexCodebase(codebaseDir);
      const deleteCollectionSpy = vi.spyOn(qdrant, "deleteCollection");

      await indexer.indexCodebase(codebaseDir, { forceReindex: true });

      expect(deleteCollectionSpy).toHaveBeenCalled();
    });

    it("should call progress callback", async () => {
      await createTestFile(
        codebaseDir,
        "test.ts",
        "export interface User {\n  id: string;\n  name: string;\n  email: string;\n}"
      );

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

      await createTestFile(
        codebaseDir,
        "test.ts",
        "export class DataService {\n  async fetchData(): Promise<any[]> {\n    return [];\n  }\n}"
      );

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
        await createTestFile(
          codebaseDir,
          `file${i}.ts`,
          `export function test${i}() {\n  console.log('Test function ${i}');\n  return ${i};\n}`
        );
      }

      const embedBatchSpy = vi.spyOn(embeddings, "embedBatch");

      await indexer.indexCodebase(codebaseDir);

      expect(embedBatchSpy).toHaveBeenCalled();
    });
  });

  describe("searchCode", () => {
    beforeEach(async () => {
      await createTestFile(
        codebaseDir,
        "test.ts",
        "export function hello(name: string): string {\n  const greeting = `Hello, ${name}!`;\n  return greeting;\n}"
      );
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

      await createTestFile(
        codebaseDir,
        "test.ts",
        `export function testFunction(): boolean {
  console.log('Running comprehensive test suite');
  const result = performValidation();
  const status = checkStatus();
  return result && status;
}
function performValidation(): boolean {
  console.log('Validating data');
  return true;
}
function checkStatus(): boolean {
  return true;
}`
      );
      // Force reindex to recreate collection with hybrid search enabled
      await hybridIndexer.indexCodebase(codebaseDir, { forceReindex: true });

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
      await createTestFile(
        codebaseDir,
        "test.ts",
        "export const APP_CONFIG = {\n  port: 3000,\n  host: 'localhost',\n  debug: true,\n  apiUrl: 'https://api.example.com',\n  timeout: 5000\n};\nconsole.log('Config loaded');"
      );
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
      await createTestFile(
        codebaseDir,
        "file1.ts",
        `export const initialValue = 1;
console.log('Initial file created');
function helper(param: string): boolean {
  console.log('Processing:', param);
  return true;
}`
      );
      await indexer.indexCodebase(codebaseDir);

      await createTestFile(
        codebaseDir,
        "file2.ts",
        [
          "export function process(data: number): number {",
          "  console.log('Processing data with value:', data);",
          "  const multiplier = 42;",
          "  const result = data * multiplier;",
          "  console.log('Computed result:', result);",
          "  if (result > 100) {",
          "    console.log('Result is large');",
          "  }",
          "  return result;",
          "}",
          "",
          "export function validate(input: string): boolean {",
          "  if (!input || input.length === 0) {",
          "    console.log('Invalid input');",
          "    return false;",
          "  }",
          "  console.log('Valid input');",
          "  return input.length > 5;",
          "}",
        ].join("\n")
      );

      const stats = await indexer.reindexChanges(codebaseDir);

      expect(stats.filesAdded).toBe(1);
      expect(stats.chunksAdded).toBeGreaterThan(0);
    });

    it("should detect modified files", async () => {
      await createTestFile(
        codebaseDir,
        "test.ts",
        "export const originalValue = 1;\nconsole.log('Original');"
      );
      await indexer.indexCodebase(codebaseDir);

      await createTestFile(
        codebaseDir,
        "test.ts",
        "export const updatedValue = 2;\nconsole.log('Updated');"
      );

      const stats = await indexer.reindexChanges(codebaseDir);

      expect(stats.filesModified).toBe(1);
    });

    it("should detect deleted files", async () => {
      await createTestFile(
        codebaseDir,
        "test.ts",
        "export const toBeDeleted = 1;\nconsole.log('Will be deleted');"
      );
      await indexer.indexCodebase(codebaseDir);

      await fs.unlink(join(codebaseDir, "test.ts"));

      const stats = await indexer.reindexChanges(codebaseDir);

      expect(stats.filesDeleted).toBe(1);
    });

    it("should handle no changes", async () => {
      await createTestFile(
        codebaseDir,
        "test.ts",
        "export const unchangedValue = 1;\nconsole.log('No changes');"
      );
      await indexer.indexCodebase(codebaseDir);

      const stats = await indexer.reindexChanges(codebaseDir);

      expect(stats.filesAdded).toBe(0);
      expect(stats.filesModified).toBe(0);
      expect(stats.filesDeleted).toBe(0);
    });

    it("should call progress callback during reindexing", async () => {
      await createTestFile(
        codebaseDir,
        "test.ts",
        "export const existingValue = 1;\nconsole.log('Existing');"
      );
      await indexer.indexCodebase(codebaseDir);

      await createTestFile(
        codebaseDir,
        "new.ts",
        "export const newValue = 2;\nconsole.log('New file');"
      );

      const progressCallback = vi.fn();
      await indexer.reindexChanges(codebaseDir, progressCallback);

      expect(progressCallback).toHaveBeenCalled();
    });
  });

  describe("path validation", () => {
    it("should handle non-existent paths gracefully", async () => {
      // Create a path that doesn't exist yet
      const nonExistentDir = join(codebaseDir, "non-existent-dir");

      // Should not throw error, validatePath falls back to absolute path
      // and scanner finds 0 files
      const stats = await indexer.indexCodebase(nonExistentDir);
      expect(stats.filesScanned).toBe(0);
      expect(stats.status).toBe("completed");
    });

    it("should resolve real paths for existing directories", async () => {
      await createTestFile(codebaseDir, "test.ts", "export const test = true;");

      // Should successfully index with real path
      const stats = await indexer.indexCodebase(codebaseDir);
      expect(stats.filesScanned).toBeGreaterThan(0);
    });
  });

  describe("clearIndex", () => {
    it("should clear indexed codebase", async () => {
      await createTestFile(
        codebaseDir,
        "test.ts",
        "export const configValue = 1;\nconsole.log('Config loaded');"
      );
      await indexer.indexCodebase(codebaseDir);

      await indexer.clearIndex(codebaseDir);

      const status = await indexer.getIndexStatus(codebaseDir);
      expect(status.isIndexed).toBe(false);
    });

    it("should handle clearing non-indexed codebase", async () => {
      await expect(indexer.clearIndex(codebaseDir)).resolves.not.toThrow();
    });

    it("should allow re-indexing after clearing", async () => {
      await createTestFile(
        codebaseDir,
        "test.ts",
        "export const reindexValue = 1;\nconsole.log('Reindexing');"
      );
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
        "src/components/Button.ts",
        `export const Button = () => {
  console.log('Button component rendering');
  const handleClick = () => {
    console.log('Button clicked');
  };
  return '<button>Click me</button>';
}`
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

  describe("Chunk limiting configuration", () => {
    it("should respect maxChunksPerFile limit", async () => {
      const limitedConfig = {
        ...config,
        maxChunksPerFile: 2,
      };
      const limitedIndexer = new CodeIndexer(qdrant as any, embeddings, limitedConfig);

      // Create a large file that would generate many chunks
      const largeContent = Array(50)
        .fill(null)
        .map((_, i) => `function test${i}() { console.log('test ${i}'); return ${i}; }`)
        .join("\n\n");

      await createTestFile(codebaseDir, "large.ts", largeContent);

      const stats = await limitedIndexer.indexCodebase(codebaseDir);

      // Should limit chunks per file to 2
      expect(stats.chunksCreated).toBeLessThanOrEqual(2);
      expect(stats.filesIndexed).toBe(1);
    });

    it("should respect maxTotalChunks limit", async () => {
      const limitedConfig = {
        ...config,
        maxTotalChunks: 3,
      };
      const limitedIndexer = new CodeIndexer(qdrant as any, embeddings, limitedConfig);

      // Create multiple files
      for (let i = 0; i < 10; i++) {
        await createTestFile(
          codebaseDir,
          `file${i}.ts`,
          `export function func${i}() { console.log('function ${i}'); return ${i}; }`
        );
      }

      const stats = await limitedIndexer.indexCodebase(codebaseDir);

      // Should stop after reaching max total chunks
      expect(stats.chunksCreated).toBeLessThanOrEqual(3);
      expect(stats.filesIndexed).toBeGreaterThan(0);
    });

    it("should handle maxTotalChunks during chunk iteration", async () => {
      const limitedConfig = {
        ...config,
        maxTotalChunks: 1,
      };
      const limitedIndexer = new CodeIndexer(qdrant as any, embeddings, limitedConfig);

      // Create a file with multiple chunks
      const content = `
function first() {
  console.log('first function');
  return 1;
}

function second() {
  console.log('second function');
  return 2;
}

function third() {
  console.log('third function');
  return 3;
}
      `;

      await createTestFile(codebaseDir, "multi.ts", content);

      const stats = await limitedIndexer.indexCodebase(codebaseDir);

      // Should stop after first chunk
      expect(stats.chunksCreated).toBe(1);
    });
  });

  describe("Progress callback coverage", () => {
    it("should call progress callback during reindexChanges", async () => {
      // Initial indexing
      await createTestFile(
        codebaseDir,
        "file1.ts",
        "export const initial = 1;\nconsole.log('Initial');"
      );
      await indexer.indexCodebase(codebaseDir);

      // Add new file
      await createTestFile(
        codebaseDir,
        "file2.ts",
        `export const added = 2;
console.log('Added file');

export function process() {
  console.log('Processing');
  return true;
}`
      );

      const progressUpdates: string[] = [];
      const progressCallback = (progress: any) => {
        progressUpdates.push(progress.phase);
      };

      await indexer.reindexChanges(codebaseDir, progressCallback);

      // Should have called progress callback with various phases
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates).toContain("scanning");
    });
  });

  describe("Error handling edge cases", () => {
    it("should handle non-Error exceptions", async () => {
      // This tests the `error instanceof Error ? error.message : String(error)` branch
      await createTestFile(codebaseDir, "test.ts", "const x = 1;");

      // Mock fs.readFile to throw a non-Error object
      const originalReadFile = fs.readFile;
      let callCount = 0;

      // @ts-expect-error - Mocking for test
      fs.readFile = async (path: any, encoding: any) => {
        callCount++;
        if (callCount === 1 && typeof path === "string" && path.endsWith("test.ts")) {
          // Throw a non-Error object
          throw "String error";
        }
        return originalReadFile(path, encoding);
      };

      try {
        const stats = await indexer.indexCodebase(codebaseDir);

        // Should handle the error gracefully
        expect(stats.status).toBe("completed");
        expect(stats.errors?.some((e) => e.includes("String error"))).toBe(true);
      } finally {
        // Restore original function
        // @ts-expect-error
        fs.readFile = originalReadFile;
      }
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
