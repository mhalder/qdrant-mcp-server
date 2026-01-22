import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitExtractor, normalizeRemoteUrl } from "./extractor.js";
import { DEFAULT_GIT_CONFIG, GIT_LOG_COMMIT_DELIMITER } from "./config.js";
import type { GitConfig } from "./types.js";

// Mock child_process with promisify-compatible execFile
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: (fn: any) => fn,
}));

import { execFile } from "node:child_process";

const mockExecFile = vi.mocked(execFile);

describe("GitExtractor", () => {
  let extractor: GitExtractor;
  const config: GitConfig = { ...DEFAULT_GIT_CONFIG };

  beforeEach(() => {
    mockExecFile.mockReset();
    extractor = new GitExtractor("/test/repo", config);
  });

  describe("validateRepository", () => {
    it("should return true for valid git repository", async () => {
      mockExecFile.mockResolvedValue({ stdout: ".git", stderr: "" } as any);

      const result = await extractor.validateRepository();

      expect(result).toBe(true);
      expect(mockExecFile).toHaveBeenCalledWith(
        "git",
        ["rev-parse", "--git-dir"],
        expect.objectContaining({ cwd: "/test/repo" }),
      );
    });

    it("should return false for non-git directory", async () => {
      mockExecFile.mockRejectedValue(new Error("fatal: not a git repository"));

      const result = await extractor.validateRepository();

      expect(result).toBe(false);
    });
  });

  describe("getLatestCommitHash", () => {
    it("should return latest commit hash", async () => {
      mockExecFile.mockResolvedValue({
        stdout: "abc123def456789\n",
        stderr: "",
      } as any);

      const result = await extractor.getLatestCommitHash();

      expect(result).toBe("abc123def456789");
      expect(mockExecFile).toHaveBeenCalledWith(
        "git",
        ["rev-parse", "HEAD"],
        expect.objectContaining({ cwd: "/test/repo" }),
      );
    });
  });

  describe("getCommitCount", () => {
    it("should return total commit count", async () => {
      mockExecFile.mockResolvedValue({ stdout: "42\n", stderr: "" } as any);

      const result = await extractor.getCommitCount();

      expect(result).toBe(42);
      expect(mockExecFile).toHaveBeenCalledWith(
        "git",
        ["rev-list", "--count", "HEAD"],
        expect.objectContaining({ cwd: "/test/repo" }),
      );
    });

    it("should return commit count since specific commit", async () => {
      mockExecFile.mockResolvedValue({ stdout: "10\n", stderr: "" } as any);

      const result = await extractor.getCommitCount("abc123");

      expect(result).toBe(10);
      expect(mockExecFile).toHaveBeenCalledWith(
        "git",
        ["rev-list", "--count", "abc123..HEAD"],
        expect.objectContaining({ cwd: "/test/repo" }),
      );
    });
  });

  describe("getCommits", () => {
    it("should parse commits from git log output", async () => {
      const gitLogOutput = [
        GIT_LOG_COMMIT_DELIMITER,
        "abc123def|abc123d|John Doe|john@example.com|2024-01-15T10:30:00Z|feat: add new feature|This is the body",
        "",
        "10\t5\tsrc/feature.ts",
        "3\t1\tsrc/utils.ts",
        GIT_LOG_COMMIT_DELIMITER,
        "xyz789ghi|xyz789g|Jane Smith|jane@example.com|2024-01-14T09:00:00Z|fix: resolve bug|Bug fix description",
        "",
        "2\t8\tsrc/bug.ts",
      ].join("\n");

      mockExecFile.mockResolvedValue({
        stdout: gitLogOutput,
        stderr: "",
      } as any);

      const result = await extractor.getCommits();

      expect(result).toHaveLength(2);

      // First commit
      expect(result[0].hash).toBe("abc123def");
      expect(result[0].shortHash).toBe("abc123d");
      expect(result[0].author).toBe("John Doe");
      expect(result[0].authorEmail).toBe("john@example.com");
      expect(result[0].subject).toBe("feat: add new feature");
      expect(result[0].body).toBe("This is the body");
      expect(result[0].files).toEqual(["src/feature.ts", "src/utils.ts"]);
      expect(result[0].insertions).toBe(13);
      expect(result[0].deletions).toBe(6);

      // Second commit
      expect(result[1].hash).toBe("xyz789ghi");
      expect(result[1].subject).toBe("fix: resolve bug");
      expect(result[1].files).toEqual(["src/bug.ts"]);
      expect(result[1].insertions).toBe(2);
      expect(result[1].deletions).toBe(8);
    });

    it("should handle commits with no files", async () => {
      const gitLogOutput = [
        GIT_LOG_COMMIT_DELIMITER,
        "abc123|abc12|Author|author@example.com|2024-01-15T10:00:00Z|chore: empty commit|",
      ].join("\n");

      mockExecFile.mockResolvedValue({
        stdout: gitLogOutput,
        stderr: "",
      } as any);

      const result = await extractor.getCommits();

      expect(result).toHaveLength(1);
      expect(result[0].files).toEqual([]);
      expect(result[0].insertions).toBe(0);
      expect(result[0].deletions).toBe(0);
    });

    it("should handle binary files in numstat", async () => {
      const gitLogOutput = [
        GIT_LOG_COMMIT_DELIMITER,
        "abc123|abc12|Author|author@example.com|2024-01-15T10:00:00Z|feat: add image|",
        "",
        "-\t-\tassets/image.png",
        "5\t2\tsrc/component.ts",
      ].join("\n");

      mockExecFile.mockResolvedValue({
        stdout: gitLogOutput,
        stderr: "",
      } as any);

      const result = await extractor.getCommits();

      expect(result[0].files).toEqual(["assets/image.png", "src/component.ts"]);
      expect(result[0].insertions).toBe(5); // Binary files don't count
      expect(result[0].deletions).toBe(2);
    });

    it("should handle renamed files", async () => {
      const gitLogOutput = [
        GIT_LOG_COMMIT_DELIMITER,
        "abc123|abc12|Author|author@example.com|2024-01-15T10:00:00Z|refactor: rename file|",
        "",
        "0\t0\tsrc/{old.ts => new.ts}",
      ].join("\n");

      mockExecFile.mockResolvedValue({
        stdout: gitLogOutput,
        stderr: "",
      } as any);

      const result = await extractor.getCommits();

      expect(result[0].files).toEqual(["src/new.ts"]);
    });

    it("should respect maxCommits option", async () => {
      mockExecFile.mockResolvedValue({ stdout: "", stderr: "" } as any);

      await extractor.getCommits({ maxCommits: 100 });

      expect(mockExecFile).toHaveBeenCalledWith(
        "git",
        expect.arrayContaining(["-n100"]),
        expect.any(Object),
      );
    });

    it("should add sinceCommit range when specified", async () => {
      mockExecFile.mockResolvedValue({ stdout: "", stderr: "" } as any);

      await extractor.getCommits({ sinceCommit: "abc123" });

      expect(mockExecFile).toHaveBeenCalledWith(
        "git",
        expect.arrayContaining(["abc123..HEAD"]),
        expect.any(Object),
      );
    });

    it("should add sinceDate filter when specified", async () => {
      mockExecFile.mockResolvedValue({ stdout: "", stderr: "" } as any);

      await extractor.getCommits({ sinceDate: "2024-01-01" });

      expect(mockExecFile).toHaveBeenCalledWith(
        "git",
        expect.arrayContaining(["--since=2024-01-01"]),
        expect.any(Object),
      );
    });

    it("should handle commits with pipes in body", async () => {
      const gitLogOutput = [
        GIT_LOG_COMMIT_DELIMITER,
        "abc123|abc12|Author|author@example.com|2024-01-15T10:00:00Z|feat: add feature|Body with | pipes | characters",
      ].join("\n");

      mockExecFile.mockResolvedValue({
        stdout: gitLogOutput,
        stderr: "",
      } as any);

      const result = await extractor.getCommits();

      expect(result[0].body).toBe("Body with | pipes | characters");
    });

    it("should handle simple rename format", async () => {
      const gitLogOutput = [
        GIT_LOG_COMMIT_DELIMITER,
        "abc123|abc12|Author|author@example.com|2024-01-15T10:00:00Z|refactor: move|",
        "",
        "0\t0\told-name.ts => new-name.ts",
      ].join("\n");

      mockExecFile.mockResolvedValue({
        stdout: gitLogOutput,
        stderr: "",
      } as any);

      const result = await extractor.getCommits();

      expect(result[0].files).toEqual(["new-name.ts"]);
    });
  });

  describe("getCommitDiff", () => {
    it("should return diff for a commit", async () => {
      const diffOutput = `commit abc123
Author: John Doe <john@example.com>

    feat: add feature

diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,5 @@
+const newLine = true;
 const existingLine = true;`;

      mockExecFile.mockResolvedValue({ stdout: diffOutput, stderr: "" } as any);

      const result = await extractor.getCommitDiff("abc123");

      expect(result).toBe(diffOutput);
      expect(mockExecFile).toHaveBeenCalledWith(
        "git",
        ["show", "--no-color", "-p", "abc123"],
        expect.objectContaining({ cwd: "/test/repo" }),
      );
    });

    it("should truncate large diffs", async () => {
      const largeDiff = "x".repeat(10000);
      const customConfig = { ...config, maxDiffSize: 100 };
      const customExtractor = new GitExtractor("/test/repo", customConfig);

      mockExecFile.mockResolvedValue({ stdout: largeDiff, stderr: "" } as any);

      const result = await customExtractor.getCommitDiff("abc123");

      expect(result.length).toBeLessThan(largeDiff.length);
      expect(result).toContain("[diff truncated: showing 100 of 10000 bytes]");
    });

    it("should return empty string on error", async () => {
      mockExecFile.mockRejectedValue(new Error("Commit not found"));

      const result = await extractor.getCommitDiff("nonexistent");

      expect(result).toBe("");
    });
  });

  describe("getRemoteUrl", () => {
    it("should return remote origin URL", async () => {
      mockExecFile.mockResolvedValue({
        stdout: "git@github.com:user/repo.git\n",
        stderr: "",
      } as any);

      const result = await extractor.getRemoteUrl();

      expect(result).toBe("git@github.com:user/repo.git");
      expect(mockExecFile).toHaveBeenCalledWith(
        "git",
        ["remote", "get-url", "origin"],
        expect.objectContaining({ cwd: "/test/repo" }),
      );
    });

    it("should return empty string when no remote configured", async () => {
      mockExecFile.mockRejectedValue(
        new Error("fatal: No such remote 'origin'"),
      );

      const result = await extractor.getRemoteUrl();

      expect(result).toBe("");
    });

    it("should return HTTPS URL", async () => {
      mockExecFile.mockResolvedValue({
        stdout: "https://github.com/user/repo.git\n",
        stderr: "",
      } as any);

      const result = await extractor.getRemoteUrl();

      expect(result).toBe("https://github.com/user/repo.git");
    });
  });
});

describe("normalizeRemoteUrl", () => {
  it("should normalize SSH URL", () => {
    expect(normalizeRemoteUrl("git@github.com:user/repo.git")).toBe(
      "user/repo",
    );
  });

  it("should normalize HTTPS URL", () => {
    expect(normalizeRemoteUrl("https://github.com/user/repo.git")).toBe(
      "user/repo",
    );
  });

  it("should handle URL without .git suffix", () => {
    expect(normalizeRemoteUrl("git@github.com:user/repo")).toBe("user/repo");
    expect(normalizeRemoteUrl("https://github.com/user/repo")).toBe(
      "user/repo",
    );
  });

  it("should return empty string for empty input", () => {
    expect(normalizeRemoteUrl("")).toBe("");
  });

  it("should handle GitLab SSH URL", () => {
    expect(normalizeRemoteUrl("git@gitlab.com:group/project.git")).toBe(
      "group/project",
    );
  });

  it("should handle Bitbucket SSH URL", () => {
    expect(normalizeRemoteUrl("git@bitbucket.org:team/repo.git")).toBe(
      "team/repo",
    );
  });

  it("should handle HTTP URL (not HTTPS)", () => {
    expect(normalizeRemoteUrl("http://github.com/user/repo.git")).toBe(
      "user/repo",
    );
  });

  it("should handle nested paths", () => {
    expect(
      normalizeRemoteUrl("https://github.com/org/group/subgroup/repo.git"),
    ).toBe("org/group/subgroup/repo");
  });
});
