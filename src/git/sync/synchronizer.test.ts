import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitSynchronizer } from "./synchronizer.js";

// Mock fs module
vi.mock("node:fs", () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn(),
  },
}));

// Mock os module
vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/home/test"),
}));

import { promises as fs } from "node:fs";

describe("GitSynchronizer", () => {
  let synchronizer: GitSynchronizer;

  beforeEach(() => {
    vi.clearAllMocks();
    synchronizer = new GitSynchronizer("/test/repo", "git_abc12345");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialize", () => {
    it("should return true when snapshot exists and matches repo", async () => {
      const snapshot = {
        repoPath: "/test/repo",
        lastCommitHash: "abc123",
        lastIndexedAt: Date.now(),
        commitsIndexed: 100,
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(snapshot));

      const result = await synchronizer.initialize();

      expect(result).toBe(true);
      expect(synchronizer.getLastCommitHash()).toBe("abc123");
      expect(synchronizer.getCommitsIndexed()).toBe(100);
    });

    it("should return false when snapshot does not exist", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(
        new Error("ENOENT: no such file"),
      );

      const result = await synchronizer.initialize();

      expect(result).toBe(false);
      expect(synchronizer.getLastCommitHash()).toBeNull();
    });

    it("should return false when snapshot is for different repo", async () => {
      const snapshot = {
        repoPath: "/different/repo",
        lastCommitHash: "abc123",
        lastIndexedAt: Date.now(),
        commitsIndexed: 100,
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(snapshot));

      const result = await synchronizer.initialize();

      expect(result).toBe(false);
      expect(synchronizer.getLastCommitHash()).toBeNull();
    });

    it("should return false when snapshot is invalid JSON", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("not valid json");

      const result = await synchronizer.initialize();

      expect(result).toBe(false);
    });
  });

  describe("getLastCommitHash", () => {
    it("should return null when no snapshot loaded", () => {
      expect(synchronizer.getLastCommitHash()).toBeNull();
    });

    it("should return hash after loading snapshot", async () => {
      const snapshot = {
        repoPath: "/test/repo",
        lastCommitHash: "xyz789",
        lastIndexedAt: Date.now(),
        commitsIndexed: 50,
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(snapshot));
      await synchronizer.initialize();

      expect(synchronizer.getLastCommitHash()).toBe("xyz789");
    });
  });

  describe("getLastIndexedAt", () => {
    it("should return null when no snapshot loaded", () => {
      expect(synchronizer.getLastIndexedAt()).toBeNull();
    });

    it("should return date after loading snapshot", async () => {
      const timestamp = Date.now();
      const snapshot = {
        repoPath: "/test/repo",
        lastCommitHash: "abc123",
        lastIndexedAt: timestamp,
        commitsIndexed: 50,
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(snapshot));
      await synchronizer.initialize();

      const date = synchronizer.getLastIndexedAt();
      expect(date).toBeInstanceOf(Date);
      expect(date?.getTime()).toBe(timestamp);
    });
  });

  describe("getCommitsIndexed", () => {
    it("should return 0 when no snapshot loaded", () => {
      expect(synchronizer.getCommitsIndexed()).toBe(0);
    });

    it("should return count after loading snapshot", async () => {
      const snapshot = {
        repoPath: "/test/repo",
        lastCommitHash: "abc123",
        lastIndexedAt: Date.now(),
        commitsIndexed: 150,
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(snapshot));
      await synchronizer.initialize();

      expect(synchronizer.getCommitsIndexed()).toBe(150);
    });
  });

  describe("updateSnapshot", () => {
    it("should write snapshot to file", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      await synchronizer.updateSnapshot("def456", 200);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining("git-snapshots"),
        { recursive: true },
      );
      // Check the file was written with correct data (JSON may be formatted)
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(".tmp"),
        expect.stringMatching(/lastCommitHash.*def456/s),
      );
      expect(fs.rename).toHaveBeenCalled();

      // Verify internal state was updated
      expect(synchronizer.getLastCommitHash()).toBe("def456");
      expect(synchronizer.getCommitsIndexed()).toBe(200);
    });

    it("should use atomic write with rename", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.rename).mockResolvedValue(undefined);

      await synchronizer.updateSnapshot("abc123", 100);

      // Verify write to temp file first, then rename
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const renameCall = vi.mocked(fs.rename).mock.calls[0];

      expect(writeCall[0]).toContain(".tmp");
      expect(renameCall[0]).toContain(".tmp");
      expect(renameCall[1]).not.toContain(".tmp");
    });
  });

  describe("deleteSnapshot", () => {
    it("should delete snapshot file", async () => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      await synchronizer.deleteSnapshot();

      expect(fs.unlink).toHaveBeenCalled();
      expect(synchronizer.getLastCommitHash()).toBeNull();
    });

    it("should not throw when file does not exist", async () => {
      vi.mocked(fs.unlink).mockRejectedValue(new Error("ENOENT"));

      await expect(synchronizer.deleteSnapshot()).resolves.not.toThrow();
    });
  });

  describe("exists", () => {
    it("should return true when snapshot file exists", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await synchronizer.exists();

      expect(result).toBe(true);
    });

    it("should return false when snapshot file does not exist", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

      const result = await synchronizer.exists();

      expect(result).toBe(false);
    });
  });

  describe("getSnapshotAge", () => {
    it("should return null when no snapshot loaded", () => {
      expect(synchronizer.getSnapshotAge()).toBeNull();
    });

    it("should return age in milliseconds", async () => {
      const timestamp = Date.now() - 10000; // 10 seconds ago
      const snapshot = {
        repoPath: "/test/repo",
        lastCommitHash: "abc123",
        lastIndexedAt: timestamp,
        commitsIndexed: 50,
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(snapshot));
      await synchronizer.initialize();

      const age = synchronizer.getSnapshotAge();
      expect(age).toBeGreaterThanOrEqual(10000);
      expect(age).toBeLessThan(11000);
    });
  });
});
