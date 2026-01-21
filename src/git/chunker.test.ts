import { describe, it, expect, beforeEach } from "vitest";
import { CommitChunker } from "./chunker.js";
import { DEFAULT_GIT_CONFIG } from "./config.js";
import type { GitConfig, RawCommit } from "./types.js";

describe("CommitChunker", () => {
  let chunker: CommitChunker;
  const config: GitConfig = { ...DEFAULT_GIT_CONFIG };

  beforeEach(() => {
    chunker = new CommitChunker(config);
  });

  const createMockCommit = (overrides: Partial<RawCommit> = {}): RawCommit => ({
    hash: "abc123def456789",
    shortHash: "abc123d",
    author: "John Doe",
    authorEmail: "john@example.com",
    date: new Date("2024-01-15T10:30:00Z"),
    subject: "feat: add new feature",
    body: "This is the commit body with more details.",
    files: ["src/feature.ts", "src/utils.ts"],
    insertions: 50,
    deletions: 10,
    ...overrides,
  });

  describe("classifyCommitType", () => {
    it("should classify feat commits", () => {
      const commit = createMockCommit({ subject: "feat: add new feature" });
      expect(chunker.classifyCommitType(commit)).toBe("feat");
    });

    it("should classify feat commits with scope", () => {
      const commit = createMockCommit({ subject: "feat(auth): add login" });
      expect(chunker.classifyCommitType(commit)).toBe("feat");
    });

    it("should classify fix commits", () => {
      const commit = createMockCommit({ subject: "fix: resolve null error" });
      expect(chunker.classifyCommitType(commit)).toBe("fix");
    });

    it("should classify bugfix commits", () => {
      const commit = createMockCommit({ subject: "bugfix: handle edge case" });
      expect(chunker.classifyCommitType(commit)).toBe("fix");
    });

    it("should classify hotfix commits", () => {
      const commit = createMockCommit({
        subject: "hotfix: critical security patch",
      });
      expect(chunker.classifyCommitType(commit)).toBe("fix");
    });

    it("should classify refactor commits", () => {
      const commit = createMockCommit({
        subject: "refactor: improve code structure",
      });
      expect(chunker.classifyCommitType(commit)).toBe("refactor");
    });

    it("should classify docs commits", () => {
      const commit = createMockCommit({ subject: "docs: update README" });
      expect(chunker.classifyCommitType(commit)).toBe("docs");
    });

    it("should classify test commits", () => {
      const commit = createMockCommit({ subject: "test: add unit tests" });
      expect(chunker.classifyCommitType(commit)).toBe("test");
    });

    it("should classify chore commits", () => {
      const commit = createMockCommit({
        subject: "chore: update dependencies",
      });
      expect(chunker.classifyCommitType(commit)).toBe("chore");
    });

    it("should classify style commits", () => {
      const commit = createMockCommit({ subject: "style: format code" });
      expect(chunker.classifyCommitType(commit)).toBe("style");
    });

    it("should classify perf commits", () => {
      const commit = createMockCommit({ subject: "perf: optimize query" });
      expect(chunker.classifyCommitType(commit)).toBe("perf");
    });

    it("should classify build commits", () => {
      const commit = createMockCommit({
        subject: "build: update webpack config",
      });
      expect(chunker.classifyCommitType(commit)).toBe("build");
    });

    it("should classify ci commits", () => {
      const commit = createMockCommit({ subject: "ci: add GitHub Actions" });
      expect(chunker.classifyCommitType(commit)).toBe("ci");
    });

    it("should classify revert commits", () => {
      const commit = createMockCommit({ subject: "revert: undo last change" });
      expect(chunker.classifyCommitType(commit)).toBe("revert");
    });

    it("should classify other commits without conventional format", () => {
      const commit = createMockCommit({ subject: "Updated something random" });
      expect(chunker.classifyCommitType(commit)).toBe("other");
    });

    it("should detect type from body if not in subject", () => {
      const commit = createMockCommit({
        subject: "Update code",
        body: "This fixes a bug in authentication",
      });
      expect(chunker.classifyCommitType(commit)).toBe("fix");
    });

    it("should detect implement keyword as feat", () => {
      const commit = createMockCommit({
        subject: "Implement user authentication",
      });
      expect(chunker.classifyCommitType(commit)).toBe("feat");
    });

    it("should detect optimize keyword as perf", () => {
      const commit = createMockCommit({
        subject: "Optimize database queries for better performance",
      });
      expect(chunker.classifyCommitType(commit)).toBe("perf");
    });
  });

  describe("createChunks", () => {
    it("should create a chunk with correct content", () => {
      const commit = createMockCommit();
      const chunks = chunker.createChunks(commit, "/test/repo");

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain("Commit: abc123d");
      expect(chunks[0].content).toContain("Type: feat");
      expect(chunks[0].content).toContain("Author: John Doe");
      expect(chunks[0].content).toContain("Subject: feat: add new feature");
      expect(chunks[0].content).toContain("src/feature.ts");
      expect(chunks[0].content).toContain("Changes: +50 -10");
    });

    it("should create chunk with correct metadata", () => {
      const commit = createMockCommit();
      const chunks = chunker.createChunks(commit, "/test/repo");

      expect(chunks[0].metadata).toEqual({
        commitHash: "abc123def456789",
        shortHash: "abc123d",
        author: "John Doe",
        authorEmail: "john@example.com",
        date: "2024-01-15T10:30:00.000Z",
        subject: "feat: add new feature",
        commitType: "feat",
        files: ["src/feature.ts", "src/utils.ts"],
        insertions: 50,
        deletions: 10,
        repoPath: "/test/repo",
      });
    });

    it("should include diff preview when provided", () => {
      const commit = createMockCommit();
      const diff = `commit abc123
Author: John Doe

    feat: add feature

diff --git a/src/feature.ts b/src/feature.ts
--- a/src/feature.ts
+++ b/src/feature.ts
@@ -1,3 +1,5 @@
+const newLine = true;
 const existing = true;`;

      const chunks = chunker.createChunks(commit, "/test/repo", diff);

      expect(chunks[0].content).toContain("Diff preview:");
      expect(chunks[0].content).toContain("+const newLine = true;");
    });

    it("should handle commits with no body", () => {
      const commit = createMockCommit({ body: "" });
      const chunks = chunker.createChunks(commit, "/test/repo");

      expect(chunks[0].content).not.toContain("Description:");
    });

    it("should handle commits with no files", () => {
      const commit = createMockCommit({ files: [] });
      const chunks = chunker.createChunks(commit, "/test/repo");

      expect(chunks[0].content).not.toContain("Files changed");
    });

    it("should limit files list to 20 files", () => {
      const manyFiles = Array(30)
        .fill(null)
        .map((_, i) => `src/file${i}.ts`);
      const commit = createMockCommit({ files: manyFiles });
      const chunks = chunker.createChunks(commit, "/test/repo");

      expect(chunks[0].content).toContain("Files changed (30):");
      expect(chunks[0].content).toContain("... and 10 more files");
    });

    it("should truncate large content", () => {
      const veryLongBody = "x".repeat(5000);
      const commit = createMockCommit({ body: veryLongBody });
      const smallConfig = { ...config, maxChunkSize: 1000 };
      const smallChunker = new CommitChunker(smallConfig);

      const chunks = smallChunker.createChunks(commit, "/test/repo");

      expect(chunks[0].content.length).toBeLessThanOrEqual(1500); // Some buffer for truncation message
      expect(chunks[0].content).toContain("[content truncated due to size]");
    });

    it("should not include file list when disabled", () => {
      const configWithoutFiles = { ...config, includeFileList: false };
      const chunkerNoFiles = new CommitChunker(configWithoutFiles);
      const commit = createMockCommit();

      const chunks = chunkerNoFiles.createChunks(commit, "/test/repo");

      expect(chunks[0].content).not.toContain("Files changed");
    });

    it("should not include diff when disabled", () => {
      const configWithoutDiff = { ...config, includeDiff: false };
      const chunkerNoDiff = new CommitChunker(configWithoutDiff);
      const commit = createMockCommit();
      const diff = "diff content here";

      const chunks = chunkerNoDiff.createChunks(commit, "/test/repo", diff);

      expect(chunks[0].content).not.toContain("Diff preview:");
    });
  });

  describe("generateChunkId", () => {
    it("should generate deterministic chunk ID", () => {
      const commit = createMockCommit();
      const chunks = chunker.createChunks(commit, "/test/repo");

      const id1 = chunker.generateChunkId(chunks[0]);
      const id2 = chunker.generateChunkId(chunks[0]);

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^gitcommit_[a-f0-9]{16}$/);
    });

    it("should generate different IDs for different commits", () => {
      const commit1 = createMockCommit({ hash: "abc123" });
      const commit2 = createMockCommit({ hash: "xyz789" });

      const chunks1 = chunker.createChunks(commit1, "/test/repo");
      const chunks2 = chunker.createChunks(commit2, "/test/repo");

      const id1 = chunker.generateChunkId(chunks1[0]);
      const id2 = chunker.generateChunkId(chunks2[0]);

      expect(id1).not.toBe(id2);
    });

    it("should generate different IDs for same commit in different repos", () => {
      const commit = createMockCommit();

      const chunks1 = chunker.createChunks(commit, "/repo1");
      const chunks2 = chunker.createChunks(commit, "/repo2");

      const id1 = chunker.generateChunkId(chunks1[0]);
      const id2 = chunker.generateChunkId(chunks2[0]);

      expect(id1).not.toBe(id2);
    });
  });
});
