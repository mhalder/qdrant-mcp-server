import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CodeIndexer } from "../../src/code/indexer.js";
import type { CodeConfig } from "../../src/code/types.js";
import type { EmbeddingProvider } from "../../src/embeddings/base.js";
import type { QdrantManager } from "../../src/qdrant/client.js";

// Mock implementations (same as indexer.test.ts)
class MockQdrantManager implements Partial<QdrantManager> {
  private collections = new Map<string, any>();
  private points = new Map<string, any[]>();

  async collectionExists(name: string): Promise<boolean> {
    return this.collections.has(name);
  }

  async createCollection(
    name: string,
    vectorSize: number,
    distance: string,
    enableHybrid?: boolean
  ): Promise<void> {
    this.collections.set(name, {
      vectorSize,
      distance,
      hybridEnabled: enableHybrid || false,
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
    filter?: any
  ): Promise<any[]> {
    const points = this.points.get(collectionName) || [];
    let filtered = points;

    // Simple filtering implementation
    if (filter?.must) {
      for (const condition of filter.must) {
        if (condition.key === "fileExtension") {
          filtered = filtered.filter((p) => condition.match.any.includes(p.payload.fileExtension));
        }
      }
    }

    return filtered.slice(0, limit).map((p, idx) => ({
      id: p.id,
      score: 0.9 - idx * 0.05,
      payload: p.payload,
    }));
  }

  async hybridSearch(
    collectionName: string,
    vector: number[],
    _sparseVector: any,
    limit: number,
    filter?: any
  ): Promise<any[]> {
    // Hybrid search returns similar results with slight boost
    const results = await this.search(collectionName, vector, limit, filter);
    return results.map((r) => ({ ...r, score: Math.min(r.score + 0.05, 1.0) }));
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

  async embed(text: string): Promise<{ embedding: number[] }> {
    // Simple hash-based mock embedding
    const hash = text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const base = (hash % 100) / 100;
    return { embedding: new Array(384).fill(base) };
  }

  async embedBatch(texts: string[]): Promise<Array<{ embedding: number[] }>> {
    return Promise.all(texts.map((text) => this.embed(text)));
  }
}

describe("CodeIndexer Integration Tests", () => {
  let indexer: CodeIndexer;
  let qdrant: MockQdrantManager;
  let embeddings: MockEmbeddingProvider;
  let config: CodeConfig;
  let tempDir: string;
  let codebaseDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `qdrant-mcp-test-${Date.now()}`);
    codebaseDir = join(tempDir, "codebase");
    await fs.mkdir(codebaseDir, { recursive: true });

    qdrant = new MockQdrantManager() as any;
    embeddings = new MockEmbeddingProvider();
    config = {
      chunkSize: 500,
      chunkOverlap: 50,
      enableASTChunking: true,
      supportedExtensions: [".ts", ".js", ".py", ".go"],
      ignorePatterns: ["node_modules/**", "dist/**", "*.test.*"],
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

  describe("Complete indexing workflow", () => {
    it("should index, search, and retrieve results from a TypeScript project", async () => {
      // Create a sample TypeScript project structure
      await createTestFile(
        codebaseDir,
        "src/auth/login.ts",
        `
export class AuthService {
  async login(email: string, password: string) {
    return { token: 'jwt-token' };
  }
}
      `
      );

      await createTestFile(
        codebaseDir,
        "src/auth/register.ts",
        `
export class RegistrationService {
  async register(user: User) {
    return { id: '123', email: user.email };
  }
}
      `
      );

      await createTestFile(
        codebaseDir,
        "src/utils/validation.ts",
        `
export function validateEmail(email: string): boolean {
  return /^[^@]+@[^@]+\\.[^@]+$/.test(email);
}
      `
      );

      // Index the codebase
      const indexStats = await indexer.indexCodebase(codebaseDir);

      expect(indexStats.filesScanned).toBe(3);
      expect(indexStats.filesIndexed).toBe(3);
      expect(indexStats.chunksCreated).toBeGreaterThan(0);
      expect(indexStats.status).toBe("completed");

      // Search for authentication-related code
      const authResults = await indexer.searchCode(codebaseDir, "authentication login");

      expect(authResults.length).toBeGreaterThan(0);
      expect(authResults[0].language).toBe("typescript");

      // Verify index status
      const status = await indexer.getIndexStatus(codebaseDir);

      expect(status.isIndexed).toBe(true);
      expect(status.chunksCount).toBeGreaterThan(0);
    });

    it("should handle multi-language projects", async () => {
      await createTestFile(
        codebaseDir,
        "server.ts",
        `
import express from 'express';
const app = express();
app.listen(3000);
      `
      );

      await createTestFile(
        codebaseDir,
        "client.js",
        `
const API_URL = 'http://localhost:3000';
fetch(API_URL).then(res => res.json());
      `
      );

      await createTestFile(
        codebaseDir,
        "utils.py",
        `
def process_data(data):
    return [x * 2 for x in data]
      `
      );

      const stats = await indexer.indexCodebase(codebaseDir);

      expect(stats.filesScanned).toBe(3);
      expect(stats.filesIndexed).toBe(3);

      // Search should find relevant code regardless of language
      const results = await indexer.searchCode(codebaseDir, "process data");

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("Incremental updates workflow", () => {
    it("should detect and index only changed files", async () => {
      // Initial indexing
      await createTestFile(codebaseDir, "file1.ts", "const x = 1;");
      await createTestFile(codebaseDir, "file2.ts", "const y = 2;");

      const initialStats = await indexer.indexCodebase(codebaseDir);
      expect(initialStats.filesIndexed).toBe(2);

      // Add a new file
      await createTestFile(codebaseDir, "file3.ts", "const z = 3;");

      // Incremental update
      const updateStats = await indexer.reindexChanges(codebaseDir);

      expect(updateStats.filesAdded).toBe(1);
      expect(updateStats.filesModified).toBe(0);
      expect(updateStats.filesDeleted).toBe(0);

      // Verify search includes new content
      const results = await indexer.searchCode(codebaseDir, "const z");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle file modifications", async () => {
      await createTestFile(codebaseDir, "config.ts", "export const DEBUG = false;");

      await indexer.indexCodebase(codebaseDir);

      // Modify the file
      await createTestFile(codebaseDir, "config.ts", "export const DEBUG = true;");

      const updateStats = await indexer.reindexChanges(codebaseDir);

      expect(updateStats.filesModified).toBe(1);
      expect(updateStats.filesAdded).toBe(0);
    });

    it("should handle file deletions", async () => {
      await createTestFile(codebaseDir, "temp.ts", "const temp = true;");
      await createTestFile(codebaseDir, "keep.ts", "const keep = true;");

      await indexer.indexCodebase(codebaseDir);

      // Delete a file
      await fs.unlink(join(codebaseDir, "temp.ts"));

      const updateStats = await indexer.reindexChanges(codebaseDir);

      expect(updateStats.filesDeleted).toBe(1);
      expect(updateStats.filesAdded).toBe(0);
    });

    it("should handle mixed changes in one update", async () => {
      // Initial state
      await createTestFile(codebaseDir, "file1.ts", "const a = 1;");
      await createTestFile(codebaseDir, "file2.ts", "const b = 2;");
      await createTestFile(codebaseDir, "file3.ts", "const c = 3;");

      await indexer.indexCodebase(codebaseDir);

      // Mixed changes
      await createTestFile(codebaseDir, "file1.ts", "const a = 100;"); // Modified
      await createTestFile(codebaseDir, "file4.ts", "const d = 4;"); // Added
      await fs.unlink(join(codebaseDir, "file3.ts")); // Deleted

      const updateStats = await indexer.reindexChanges(codebaseDir);

      expect(updateStats.filesAdded).toBe(1);
      expect(updateStats.filesModified).toBe(1);
      expect(updateStats.filesDeleted).toBe(1);
    });
  });

  describe("Search filtering and options", () => {
    beforeEach(async () => {
      await createTestFile(codebaseDir, "users.ts", "export class UserService {}");
      await createTestFile(codebaseDir, "auth.ts", "export class AuthService {}");
      await createTestFile(codebaseDir, "utils.js", "export function helper() {}");
      await createTestFile(codebaseDir, "data.py", "class DataProcessor: pass");

      await indexer.indexCodebase(codebaseDir);
    });

    it("should filter results by file extension", async () => {
      const results = await indexer.searchCode(codebaseDir, "class", {
        fileTypes: [".ts"],
      });

      results.forEach((result) => {
        expect(result.fileExtension).toBe(".ts");
      });
    });

    it("should respect search limit", async () => {
      const results = await indexer.searchCode(codebaseDir, "export", {
        limit: 2,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should apply score threshold", async () => {
      const results = await indexer.searchCode(codebaseDir, "service", {
        scoreThreshold: 0.8,
      });

      results.forEach((result) => {
        expect(result.score).toBeGreaterThanOrEqual(0.8);
      });
    });

    it("should support path pattern filtering", async () => {
      await createTestFile(codebaseDir, "src/api/endpoints.ts", "export const API = {}");
      await indexer.indexCodebase(codebaseDir, { forceReindex: true });

      const results = await indexer.searchCode(codebaseDir, "export", {
        pathPattern: "src/api/**",
      });

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("Hybrid search workflow", () => {
    it("should enable and use hybrid search", async () => {
      const hybridConfig = { ...config, enableHybridSearch: true };
      const hybridIndexer = new CodeIndexer(qdrant as any, embeddings, hybridConfig);

      await createTestFile(
        codebaseDir,
        "search.ts",
        "function performSearch(query: string) { return results; }"
      );

      await hybridIndexer.indexCodebase(codebaseDir);

      const results = await hybridIndexer.searchCode(codebaseDir, "search query");

      expect(results.length).toBeGreaterThan(0);
    });

    it("should fallback to standard search if hybrid not available", async () => {
      const hybridConfig = { ...config, enableHybridSearch: true };
      const hybridIndexer = new CodeIndexer(qdrant as any, embeddings, hybridConfig);

      // Index without hybrid
      await createTestFile(codebaseDir, "test.ts", "const test = true;");
      await indexer.indexCodebase(codebaseDir);

      // Search with hybrid-enabled indexer but collection without hybrid
      const results = await hybridIndexer.searchCode(codebaseDir, "test");

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("Large project workflow", () => {
    it("should handle projects with many files", async () => {
      // Create a large project structure
      for (let i = 0; i < 20; i++) {
        await createTestFile(
          codebaseDir,
          `module${i}.ts`,
          `export function func${i}() { return ${i}; }`
        );
      }

      const stats = await indexer.indexCodebase(codebaseDir);

      expect(stats.filesScanned).toBe(20);
      expect(stats.filesIndexed).toBe(20);
      expect(stats.status).toBe("completed");
    });

    it("should handle large files with many chunks", async () => {
      const largeFile = Array(100)
        .fill(null)
        .map((_, i) => `function test${i}() { return ${i}; }`)
        .join("\n\n");

      await createTestFile(codebaseDir, "large.ts", largeFile);

      const stats = await indexer.indexCodebase(codebaseDir);

      expect(stats.chunksCreated).toBeGreaterThan(1);
    });
  });

  describe("Error handling and recovery", () => {
    it("should continue indexing after encountering errors", async () => {
      await createTestFile(codebaseDir, "valid.ts", "const valid = true;");
      await createTestFile(codebaseDir, "secrets.ts", 'const key = "sk_live_abcd1234567890";');

      const stats = await indexer.indexCodebase(codebaseDir);

      // Should index valid file and report error for secrets file
      expect(stats.filesIndexed).toBe(1);
      expect(stats.errors?.length).toBeGreaterThan(0);
      expect(stats.status).toBe("completed");
    });

    it("should allow re-indexing after partial failure", async () => {
      await createTestFile(codebaseDir, "test.ts", "const test = true;");

      const stats1 = await indexer.indexCodebase(codebaseDir);
      expect(stats1.status).toBe("completed");

      // Force re-index
      const stats2 = await indexer.indexCodebase(codebaseDir, { forceReindex: true });
      expect(stats2.status).toBe("completed");
    });
  });

  describe("Clear and re-index workflow", () => {
    it("should clear index and allow re-indexing", async () => {
      await createTestFile(codebaseDir, "test.ts", "const test = 1;");

      await indexer.indexCodebase(codebaseDir);

      let status = await indexer.getIndexStatus(codebaseDir);
      expect(status.isIndexed).toBe(true);

      await indexer.clearIndex(codebaseDir);

      status = await indexer.getIndexStatus(codebaseDir);
      expect(status.isIndexed).toBe(false);

      // Re-index
      const stats = await indexer.indexCodebase(codebaseDir);
      expect(stats.status).toBe("completed");

      status = await indexer.getIndexStatus(codebaseDir);
      expect(status.isIndexed).toBe(true);
    });
  });

  describe("Progress tracking", () => {
    it("should report progress through all phases", async () => {
      for (let i = 0; i < 5; i++) {
        await createTestFile(codebaseDir, `file${i}.ts`, `const x${i} = ${i};`);
      }

      const progressUpdates: string[] = [];
      const progressCallback = (progress: any) => {
        progressUpdates.push(progress.phase);
      };

      await indexer.indexCodebase(codebaseDir, undefined, progressCallback);

      expect(progressUpdates).toContain("scanning");
      expect(progressUpdates).toContain("chunking");
      expect(progressUpdates).toContain("embedding");
      expect(progressUpdates).toContain("storing");
    });

    it("should report progress during incremental updates", async () => {
      await createTestFile(codebaseDir, "file1.ts", "const x = 1;");
      await indexer.indexCodebase(codebaseDir);

      await createTestFile(codebaseDir, "file2.ts", "const y = 2;");

      const progressUpdates: string[] = [];
      const progressCallback = (progress: any) => {
        progressUpdates.push(progress.phase);
      };

      await indexer.reindexChanges(codebaseDir, progressCallback);

      expect(progressUpdates.length).toBeGreaterThan(0);
    });
  });
});

// Helper function
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
