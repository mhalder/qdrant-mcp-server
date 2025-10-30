import { promises as fs } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileSynchronizer } from "../../../src/code/sync/synchronizer.js";

describe("FileSynchronizer", () => {
  let tempDir: string;
  let codebaseDir: string;
  let synchronizer: FileSynchronizer;
  let collectionName: string;

  beforeEach(async () => {
    // Create temporary directories for testing
    tempDir = join(tmpdir(), `qdrant-mcp-test-${Date.now()}`);
    codebaseDir = join(tempDir, "codebase");
    await fs.mkdir(codebaseDir, { recursive: true });

    // Use unique collection name to avoid conflicts between test runs
    collectionName = `test-collection-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    synchronizer = new FileSynchronizer(codebaseDir, collectionName);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }

    // Clean up snapshot file
    try {
      const snapshotPath = join(homedir(), ".qdrant-mcp", "snapshots", `${collectionName}.json`);
      await fs.rm(snapshotPath, { force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe("initialize", () => {
    it("should return false when no snapshot exists", async () => {
      const hasSnapshot = await synchronizer.initialize();
      expect(hasSnapshot).toBe(false);
    });

    it("should return true when snapshot exists", async () => {
      // Create some files and update snapshot
      await createFile(codebaseDir, "file1.ts", "content1");
      await synchronizer.updateSnapshot(["file1.ts"]);

      // Create a new synchronizer and initialize
      const newSync = new FileSynchronizer(codebaseDir, collectionName);
      const hasSnapshot = await newSync.initialize();

      expect(hasSnapshot).toBe(true);
    });

    it("should load previous file hashes", async () => {
      await createFile(codebaseDir, "file1.ts", "content1");
      await createFile(codebaseDir, "file2.ts", "content2");

      await synchronizer.updateSnapshot(["file1.ts", "file2.ts"]);

      const newSync = new FileSynchronizer(codebaseDir, collectionName);
      await newSync.initialize();

      const changes = await newSync.detectChanges(["file1.ts", "file2.ts"]);

      expect(changes.added).toEqual([]);
      expect(changes.modified).toEqual([]);
      expect(changes.deleted).toEqual([]);
    });
  });

  describe("updateSnapshot", () => {
    it("should save snapshot with file hashes", async () => {
      await createFile(codebaseDir, "file1.ts", "content1");
      await createFile(codebaseDir, "file2.ts", "content2");

      await synchronizer.updateSnapshot(["file1.ts", "file2.ts"]);

      const newSync = new FileSynchronizer(codebaseDir, collectionName, tempDir);
      const hasSnapshot = await newSync.initialize();

      expect(hasSnapshot).toBe(true);
    });

    it("should handle empty file list", async () => {
      await synchronizer.updateSnapshot([]);

      const newSync = new FileSynchronizer(codebaseDir, collectionName);
      const hasSnapshot = await newSync.initialize();

      expect(hasSnapshot).toBe(true);
    });

    it("should overwrite previous snapshot", async () => {
      await createFile(codebaseDir, "file1.ts", "content1");
      await synchronizer.updateSnapshot(["file1.ts"]);

      await createFile(codebaseDir, "file2.ts", "content2");
      await synchronizer.updateSnapshot(["file2.ts"]);

      const newSync = new FileSynchronizer(codebaseDir, collectionName);
      await newSync.initialize();

      const changes = await newSync.detectChanges(["file2.ts"]);

      expect(changes.added).toEqual([]);
      expect(changes.modified).toEqual([]);
      expect(changes.deleted).toEqual([]);
    });

    it("should handle relative and absolute paths", async () => {
      await createFile(codebaseDir, "file.ts", "content");

      await synchronizer.updateSnapshot(["file.ts"]);
      await synchronizer.updateSnapshot([join(codebaseDir, "file.ts")]);

      // Both should work without duplicates
      const newSync = new FileSynchronizer(codebaseDir, collectionName);
      await newSync.initialize();

      const changes = await newSync.detectChanges(["file.ts"]);
      expect(changes.modified).toEqual([]);
    });
  });

  describe("detectChanges", () => {
    it("should detect added files", async () => {
      await synchronizer.initialize();
      await synchronizer.updateSnapshot([]);

      await createFile(codebaseDir, "file1.ts", "content1");
      await createFile(codebaseDir, "file2.ts", "content2");

      const changes = await synchronizer.detectChanges(["file1.ts", "file2.ts"]);

      expect(changes.added).toContain("file1.ts");
      expect(changes.added).toContain("file2.ts");
      expect(changes.modified).toEqual([]);
      expect(changes.deleted).toEqual([]);
    });

    it("should detect deleted files", async () => {
      await createFile(codebaseDir, "file1.ts", "content1");
      await createFile(codebaseDir, "file2.ts", "content2");
      await synchronizer.updateSnapshot(["file1.ts", "file2.ts"]);

      await fs.unlink(join(codebaseDir, "file2.ts"));

      const changes = await synchronizer.detectChanges(["file1.ts"]);

      expect(changes.added).toEqual([]);
      expect(changes.modified).toEqual([]);
      expect(changes.deleted).toEqual(["file2.ts"]);
    });

    it("should detect modified files", async () => {
      await createFile(codebaseDir, "file1.ts", "original content");
      await synchronizer.updateSnapshot(["file1.ts"]);

      await createFile(codebaseDir, "file1.ts", "modified content");

      const changes = await synchronizer.detectChanges(["file1.ts"]);

      expect(changes.added).toEqual([]);
      expect(changes.modified).toEqual(["file1.ts"]);
      expect(changes.deleted).toEqual([]);
    });

    it("should detect mixed changes", async () => {
      await createFile(codebaseDir, "file1.ts", "content1");
      await createFile(codebaseDir, "file2.ts", "content2");
      await synchronizer.updateSnapshot(["file1.ts", "file2.ts"]);

      // Modify file1
      await createFile(codebaseDir, "file1.ts", "modified content1");

      // Add file3
      await createFile(codebaseDir, "file3.ts", "content3");

      // Delete file2

      const changes = await synchronizer.detectChanges(["file1.ts", "file3.ts"]);

      expect(changes.added).toEqual(["file3.ts"]);
      expect(changes.modified).toEqual(["file1.ts"]);
      expect(changes.deleted).toEqual(["file2.ts"]);
    });

    it("should detect no changes when files unchanged", async () => {
      await createFile(codebaseDir, "file1.ts", "content1");
      await synchronizer.updateSnapshot(["file1.ts"]);

      const changes = await synchronizer.detectChanges(["file1.ts"]);

      expect(changes.added).toEqual([]);
      expect(changes.modified).toEqual([]);
      expect(changes.deleted).toEqual([]);
    });

    it("should consider all files as added when no snapshot exists", async () => {
      await createFile(codebaseDir, "file1.ts", "content1");
      await createFile(codebaseDir, "file2.ts", "content2");

      const changes = await synchronizer.detectChanges(["file1.ts", "file2.ts"]);

      expect(changes.added).toContain("file1.ts");
      expect(changes.added).toContain("file2.ts");
      expect(changes.modified).toEqual([]);
      expect(changes.deleted).toEqual([]);
    });
  });

  describe("deleteSnapshot", () => {
    it("should delete existing snapshot", async () => {
      await createFile(codebaseDir, "file.ts", "content");
      await synchronizer.updateSnapshot(["file.ts"]);

      await synchronizer.deleteSnapshot();

      const newSync = new FileSynchronizer(codebaseDir, collectionName);
      const hasSnapshot = await newSync.initialize();

      expect(hasSnapshot).toBe(false);
    });

    it("should handle deleting non-existent snapshot", async () => {
      await expect(synchronizer.deleteSnapshot()).resolves.not.toThrow();
    });

    it("should allow operations after deletion", async () => {
      await createFile(codebaseDir, "file1.ts", "content1");
      await synchronizer.updateSnapshot(["file1.ts"]);

      await synchronizer.deleteSnapshot();

      await createFile(codebaseDir, "file2.ts", "content2");
      await synchronizer.updateSnapshot(["file2.ts"]);

      const newSync = new FileSynchronizer(codebaseDir, collectionName);
      const hasSnapshot = await newSync.initialize();

      expect(hasSnapshot).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle files with same content different names", async () => {
      const sameContent = "identical content";
      await createFile(codebaseDir, "file1.ts", sameContent);
      await createFile(codebaseDir, "file2.ts", sameContent);

      await synchronizer.updateSnapshot(["file1.ts", "file2.ts"]);

      const changes = await synchronizer.detectChanges(["file1.ts", "file2.ts"]);

      expect(changes.added).toEqual([]);
      expect(changes.modified).toEqual([]);
      expect(changes.deleted).toEqual([]);
    });

    it("should handle binary files", async () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      await fs.writeFile(join(codebaseDir, "binary.dat"), binaryContent);

      await synchronizer.updateSnapshot(["binary.dat"]);

      const changes = await synchronizer.detectChanges(["binary.dat"]);

      expect(changes.modified).toEqual([]);
    });

    it("should handle very large files", async () => {
      const largeContent = "x".repeat(1024 * 1024); // 1MB
      await createFile(codebaseDir, "large.ts", largeContent);

      await synchronizer.updateSnapshot(["large.ts"]);

      const changes = await synchronizer.detectChanges(["large.ts"]);

      expect(changes.modified).toEqual([]);
    });

    it("should handle files with special characters in names", async () => {
      await createFile(codebaseDir, "file with spaces.ts", "content");
      await createFile(codebaseDir, "file-with-dashes.ts", "content");
      await createFile(codebaseDir, "file_with_underscores.ts", "content");

      await synchronizer.updateSnapshot([
        "file with spaces.ts",
        "file-with-dashes.ts",
        "file_with_underscores.ts",
      ]);

      const changes = await synchronizer.detectChanges([
        "file with spaces.ts",
        "file-with-dashes.ts",
        "file_with_underscores.ts",
      ]);

      expect(changes.modified).toEqual([]);
    });

    it("should handle nested directory structures", async () => {
      await fs.mkdir(join(codebaseDir, "src", "components"), {
        recursive: true,
      });
      await createFile(codebaseDir, "src/components/Button.tsx", "content");

      await synchronizer.updateSnapshot(["src/components/Button.tsx"]);

      const changes = await synchronizer.detectChanges(["src/components/Button.tsx"]);

      expect(changes.modified).toEqual([]);
    });

    it("should handle empty files", async () => {
      await createFile(codebaseDir, "empty.ts", "");

      await synchronizer.updateSnapshot(["empty.ts"]);

      const changes = await synchronizer.detectChanges(["empty.ts"]);

      expect(changes.modified).toEqual([]);
    });

    it("should detect when empty file becomes non-empty", async () => {
      await createFile(codebaseDir, "file.ts", "");
      await synchronizer.updateSnapshot(["file.ts"]);

      await createFile(codebaseDir, "file.ts", "now has content");

      const changes = await synchronizer.detectChanges(["file.ts"]);

      expect(changes.modified).toEqual(["file.ts"]);
    });

    it("should handle many files efficiently", async () => {
      const files: string[] = [];

      for (let i = 0; i < 100; i++) {
        const filename = `file${i}.ts`;
        await createFile(codebaseDir, filename, `content ${i}`);
        files.push(filename);
      }

      await synchronizer.updateSnapshot(files);

      const changes = await synchronizer.detectChanges(files);

      expect(changes.added).toEqual([]);
      expect(changes.modified).toEqual([]);
      expect(changes.deleted).toEqual([]);
    });
  });

  describe("hash calculation", () => {
    it("should produce same hash for identical content", async () => {
      const content = "test content";
      await createFile(codebaseDir, "file1.ts", content);
      await synchronizer.updateSnapshot(["file1.ts"]);

      // Delete and recreate with same content
      await fs.unlink(join(codebaseDir, "file1.ts"));
      await createFile(codebaseDir, "file1.ts", content);

      const changes = await synchronizer.detectChanges(["file1.ts"]);

      expect(changes.modified).toEqual([]);
    });

    it("should produce different hash for different content", async () => {
      await createFile(codebaseDir, "file.ts", "original");
      await synchronizer.updateSnapshot(["file.ts"]);

      await createFile(codebaseDir, "file.ts", "modified");

      const changes = await synchronizer.detectChanges(["file.ts"]);

      expect(changes.modified).toEqual(["file.ts"]);
    });

    it("should be sensitive to whitespace changes", async () => {
      await createFile(codebaseDir, "file.ts", "content");
      await synchronizer.updateSnapshot(["file.ts"]);

      await createFile(codebaseDir, "file.ts", "content ");

      const changes = await synchronizer.detectChanges(["file.ts"]);

      expect(changes.modified).toEqual(["file.ts"]);
    });

    it("should be sensitive to line ending changes", async () => {
      await createFile(codebaseDir, "file.ts", "line1\nline2");
      await synchronizer.updateSnapshot(["file.ts"]);

      await createFile(codebaseDir, "file.ts", "line1\r\nline2");

      const changes = await synchronizer.detectChanges(["file.ts"]);

      expect(changes.modified).toEqual(["file.ts"]);
    });
  });
});

// Helper function to create files in the test codebase
async function createFile(baseDir: string, relativePath: string, content: string): Promise<void> {
  const fullPath = join(baseDir, relativePath);
  const dir = join(fullPath, "..");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
}
