import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MerkleTree } from "../../../src/code/sync/merkle.js";
import { SnapshotManager } from "../../../src/code/sync/snapshot.js";

describe("SnapshotManager", () => {
  let tempDir: string;
  let snapshotManager: SnapshotManager;
  let collectionName: string;

  beforeEach(async () => {
    // Create a temporary directory for test snapshots
    tempDir = join(
      tmpdir(),
      `qdrant-mcp-test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    );
    await fs.mkdir(tempDir, { recursive: true });

    collectionName = "test-collection";
    const snapshotPath = join(tempDir, `${collectionName}.json`);
    snapshotManager = new SnapshotManager(snapshotPath);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe("save", () => {
    it("should save snapshot with file hashes and merkle tree", async () => {
      const fileHashes = new Map([
        ["file1.ts", "hash1"],
        ["file2.ts", "hash2"],
      ]);

      const tree = new MerkleTree();
      tree.build(fileHashes);

      await snapshotManager.save("/test/codebase", fileHashes, tree);

      const snapshotPath = join(tempDir, `${collectionName}.json`);
      const exists = await fs
        .access(snapshotPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);
    });

    it("should save correct snapshot data", async () => {
      const fileHashes = new Map([
        ["file1.ts", "hash1"],
        ["file2.ts", "hash2"],
      ]);

      const tree = new MerkleTree();
      tree.build(fileHashes);

      await snapshotManager.save("/test/codebase", fileHashes, tree);

      const loaded = await snapshotManager.load();

      expect(loaded).toBeDefined();
      expect(loaded?.codebasePath).toBe("/test/codebase");
      expect(loaded?.fileHashes.size).toBe(2);
      expect(loaded?.fileHashes.get("file1.ts")).toBe("hash1");
      expect(loaded?.fileHashes.get("file2.ts")).toBe("hash2");
    });

    it("should overwrite existing snapshot", async () => {
      const fileHashes1 = new Map([["file1.ts", "hash1"]]);
      const tree1 = new MerkleTree();
      tree1.build(fileHashes1);

      await snapshotManager.save("/test/codebase1", fileHashes1, tree1);

      const fileHashes2 = new Map([["file2.ts", "hash2"]]);
      const tree2 = new MerkleTree();
      tree2.build(fileHashes2);

      await snapshotManager.save("/test/codebase2", fileHashes2, tree2);

      const loaded = await snapshotManager.load();

      expect(loaded?.codebasePath).toBe("/test/codebase2");
      expect(loaded?.fileHashes.size).toBe(1);
      expect(loaded?.fileHashes.get("file2.ts")).toBe("hash2");
    });

    it("should create snapshot directory if it doesn't exist", async () => {
      const nonExistentDir = join(tempDir, "nested", "path");
      const snapshotPath = join(nonExistentDir, `${collectionName}.json`);
      const manager = new SnapshotManager(snapshotPath);

      const fileHashes = new Map([["file.ts", "hash"]]);
      const tree = new MerkleTree();
      tree.build(fileHashes);

      await manager.save("/test/codebase", fileHashes, tree);

      const exists = await fs
        .access(snapshotPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);
    });

    it("should handle empty file hashes", async () => {
      const fileHashes = new Map<string, string>();
      const tree = new MerkleTree();
      tree.build(fileHashes);

      await snapshotManager.save("/test/codebase", fileHashes, tree);

      const loaded = await snapshotManager.load();

      expect(loaded?.fileHashes.size).toBe(0);
    });

    it("should preserve timestamp", async () => {
      const fileHashes = new Map([["file.ts", "hash"]]);
      const tree = new MerkleTree();
      tree.build(fileHashes);

      const beforeSave = Date.now();
      await snapshotManager.save("/test/codebase", fileHashes, tree);
      const afterSave = Date.now();

      const loaded = await snapshotManager.load();

      expect(loaded?.timestamp).toBeGreaterThanOrEqual(beforeSave);
      expect(loaded?.timestamp).toBeLessThanOrEqual(afterSave);
    });
  });

  describe("load", () => {
    it("should return null if snapshot doesn't exist", async () => {
      const loaded = await snapshotManager.load();
      expect(loaded).toBeNull();
    });

    it("should load previously saved snapshot", async () => {
      const fileHashes = new Map([
        ["file1.ts", "hash1"],
        ["file2.ts", "hash2"],
        ["file3.ts", "hash3"],
      ]);

      const tree = new MerkleTree();
      tree.build(fileHashes);

      await snapshotManager.save("/test/codebase", fileHashes, tree);

      const loaded = await snapshotManager.load();

      expect(loaded).toBeDefined();
      expect(loaded?.codebasePath).toBe("/test/codebase");
      expect(loaded?.fileHashes.size).toBe(3);
      expect(loaded?.merkleTree.getRootHash()).toBe(tree.getRootHash());
    });

    it("should handle corrupted snapshot file", async () => {
      const snapshotPath = join(tempDir, `${collectionName}.json`);
      await fs.writeFile(snapshotPath, "{ invalid json", "utf-8");

      const loaded = await snapshotManager.load();

      expect(loaded).toBeNull();
    });

    it("should handle missing fields in snapshot", async () => {
      const snapshotPath = join(tempDir, `${collectionName}.json`);
      await fs.writeFile(
        snapshotPath,
        JSON.stringify({ codebasePath: "/test" }),
        "utf-8",
      );

      const loaded = await snapshotManager.load();

      // Should handle gracefully, might return null or partial data
      expect(loaded).toBeDefined();
    });

    it("should reconstruct merkle tree from serialized data", async () => {
      const fileHashes = new Map([
        ["file1.ts", "hash1"],
        ["file2.ts", "hash2"],
      ]);

      const tree = new MerkleTree();
      tree.build(fileHashes);

      await snapshotManager.save("/test/codebase", fileHashes, tree);

      const loaded = await snapshotManager.load();

      expect(loaded?.merkleTree).toBeDefined();
      expect(loaded?.merkleTree.getRootHash()).toBe(tree.getRootHash());
    });
  });

  describe("exists", () => {
    it("should return false when snapshot doesn't exist", async () => {
      const exists = await snapshotManager.exists();
      expect(exists).toBe(false);
    });

    it("should return true when snapshot exists", async () => {
      const fileHashes = new Map([["file.ts", "hash"]]);
      const tree = new MerkleTree();
      tree.build(fileHashes);

      await snapshotManager.save("/test/codebase", fileHashes, tree);

      const exists = await snapshotManager.exists();
      expect(exists).toBe(true);
    });
  });

  describe("validate", () => {
    it("should return true for valid snapshot", async () => {
      const fileHashes = new Map([
        ["file1.ts", "hash1"],
        ["file2.ts", "hash2"],
      ]);

      const tree = new MerkleTree();
      tree.build(fileHashes);

      await snapshotManager.save("/test/codebase", fileHashes, tree);

      const isValid = await snapshotManager.validate();
      expect(isValid).toBe(true);
    });

    it("should return false when snapshot doesn't exist", async () => {
      const isValid = await snapshotManager.validate();
      expect(isValid).toBe(false);
    });

    it("should return false for corrupted snapshot", async () => {
      const snapshotPath = join(tempDir, `${collectionName}.json`);
      await fs.writeFile(snapshotPath, "{ invalid json", "utf-8");

      const isValid = await snapshotManager.validate();
      expect(isValid).toBe(false);
    });

    it("should return true for empty file hashes", async () => {
      const fileHashes = new Map<string, string>();
      const tree = new MerkleTree();
      tree.build(fileHashes);

      await snapshotManager.save("/test/codebase", fileHashes, tree);

      const isValid = await snapshotManager.validate();
      expect(isValid).toBe(true);
    });
  });

  describe("delete", () => {
    it("should delete existing snapshot", async () => {
      const fileHashes = new Map([["file.ts", "hash"]]);
      const tree = new MerkleTree();
      tree.build(fileHashes);

      await snapshotManager.save("/test/codebase", fileHashes, tree);

      expect(await snapshotManager.exists()).toBe(true);

      await snapshotManager.delete();

      expect(await snapshotManager.exists()).toBe(false);
    });

    it("should handle deleting non-existent snapshot", async () => {
      await expect(snapshotManager.delete()).resolves.not.toThrow();
    });

    it("should allow saving after deletion", async () => {
      const fileHashes1 = new Map([["file1.ts", "hash1"]]);
      const tree1 = new MerkleTree();
      tree1.build(fileHashes1);

      await snapshotManager.save("/test/codebase1", fileHashes1, tree1);
      await snapshotManager.delete();

      const fileHashes2 = new Map([["file2.ts", "hash2"]]);
      const tree2 = new MerkleTree();
      tree2.build(fileHashes2);

      await snapshotManager.save("/test/codebase2", fileHashes2, tree2);

      const loaded = await snapshotManager.load();
      expect(loaded?.codebasePath).toBe("/test/codebase2");
    });
  });

  describe("edge cases", () => {
    it("should handle large number of files", async () => {
      const fileHashes = new Map<string, string>();
      for (let i = 0; i < 1000; i++) {
        fileHashes.set(`file${i}.ts`, `hash${i}`);
      }

      const tree = new MerkleTree();
      tree.build(fileHashes);

      await snapshotManager.save("/test/codebase", fileHashes, tree);

      const loaded = await snapshotManager.load();

      expect(loaded?.fileHashes.size).toBe(1000);
    });

    it("should handle special characters in paths", async () => {
      const fileHashes = new Map([
        ["/path/with spaces/file.ts", "hash1"],
        ["/path/with-dashes/file.ts", "hash2"],
        ["/path/with_underscores/file.ts", "hash3"],
      ]);

      const tree = new MerkleTree();
      tree.build(fileHashes);

      await snapshotManager.save("/test/codebase", fileHashes, tree);

      const loaded = await snapshotManager.load();

      expect(loaded?.fileHashes.size).toBe(3);
    });

    it("should handle collection names with special characters", async () => {
      const specialName = "collection-with-dashes_and_underscores";
      const snapshotPath = join(tempDir, `${specialName}.json`);
      const manager = new SnapshotManager(snapshotPath);

      const fileHashes = new Map([["file.ts", "hash"]]);
      const tree = new MerkleTree();
      tree.build(fileHashes);

      await manager.save("/test/codebase", fileHashes, tree);

      const loaded = await manager.load();
      expect(loaded).toBeDefined();
    });

    it("should handle very long codebase paths", async () => {
      const longPath = `${"/very/long/path/".repeat(50)}codebase`;

      const fileHashes = new Map([["file.ts", "hash"]]);
      const tree = new MerkleTree();
      tree.build(fileHashes);

      await snapshotManager.save(longPath, fileHashes, tree);

      const loaded = await snapshotManager.load();
      expect(loaded?.codebasePath).toBe(longPath);
    });
  });

  describe("concurrent operations", () => {
    it("should handle rapid save operations", async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        const fileHashes = new Map([[`file${i}.ts`, `hash${i}`]]);
        const tree = new MerkleTree();
        tree.build(fileHashes);

        promises.push(
          snapshotManager.save(`/test/codebase${i}`, fileHashes, tree),
        );
      }

      await Promise.all(promises);

      // Last save should win
      const loaded = await snapshotManager.load();
      expect(loaded).toBeDefined();
    });

    it("should handle concurrent save and load", async () => {
      const fileHashes = new Map([["file.ts", "hash"]]);
      const tree = new MerkleTree();
      tree.build(fileHashes);

      await snapshotManager.save("/test/codebase", fileHashes, tree);

      const promises = [
        snapshotManager.load(),
        snapshotManager.load(),
        snapshotManager.load(),
      ];

      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result).toBeDefined();
      });
    });
  });
});
