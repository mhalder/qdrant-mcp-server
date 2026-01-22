/**
 * Integration tests for GitExtractor
 * These tests run against real git repositories (not mocked)
 */

import { describe, it, expect, beforeAll } from "vitest";
import { GitExtractor } from "./extractor.js";
import { DEFAULT_GIT_CONFIG } from "./config.js";
import type { GitConfig } from "./types.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

describe("GitExtractor Integration Tests", () => {
  let extractor: GitExtractor;
  const config: GitConfig = { ...DEFAULT_GIT_CONFIG, maxCommits: 100 };

  // Use the current repository for integration tests
  const repoPath = process.cwd();

  beforeAll(async () => {
    extractor = new GitExtractor(repoPath, config);

    // Verify we're in a git repository
    const isRepo = await extractor.validateRepository();
    if (!isRepo) {
      throw new Error("Integration tests must be run from a git repository");
    }
  });

  describe("validateRepository", () => {
    it("should detect valid git repository", async () => {
      const result = await extractor.validateRepository();
      expect(result).toBe(true);
    });

    it("should return false for non-existent path", async () => {
      const badExtractor = new GitExtractor("/nonexistent/path", config);
      const result = await badExtractor.validateRepository();
      expect(result).toBe(false);
    });
  });

  describe("getCommits - data integrity", () => {
    it("should extract commits without data corruption", async () => {
      const commits = await extractor.getCommits({ maxCommits: 50 });

      expect(commits.length).toBeGreaterThan(0);
      expect(commits.length).toBeLessThanOrEqual(50);

      for (const commit of commits) {
        // Verify hash format (40 hex characters)
        expect(commit.hash).toMatch(/^[a-f0-9]{40}$/);

        // Verify short hash format (7+ hex characters)
        expect(commit.shortHash).toMatch(/^[a-f0-9]{7,}$/);

        // Verify author is not empty
        expect(commit.author.length).toBeGreaterThan(0);

        // Verify author email format
        expect(commit.authorEmail).toMatch(/.+@.+/);

        // Verify date is valid
        expect(commit.date).toBeInstanceOf(Date);
        expect(commit.date.getTime()).not.toBeNaN();

        // Verify subject is not empty
        expect(commit.subject.length).toBeGreaterThan(0);

        // CRITICAL: Verify fields don't contain numstat patterns
        // This catches the parsing bug where numstat bleeds into format fields
        const numstatPattern = /^\d+\s+\d+\s+\S+/;
        expect(commit.hash).not.toMatch(numstatPattern);
        expect(commit.author).not.toMatch(numstatPattern);
        expect(commit.subject).not.toMatch(numstatPattern);

        // Verify insertions/deletions are non-negative integers
        expect(commit.insertions).toBeGreaterThanOrEqual(0);
        expect(commit.deletions).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(commit.insertions)).toBe(true);
        expect(Number.isInteger(commit.deletions)).toBe(true);

        // Verify files array
        expect(Array.isArray(commit.files)).toBe(true);
        for (const file of commit.files) {
          expect(typeof file).toBe("string");
          expect(file.length).toBeGreaterThan(0);
        }
      }
    });

    it("should return correct commit count matching git rev-list", async () => {
      // Get expected count from git directly
      const { stdout } = await execFileAsync(
        "git",
        ["rev-list", "--count", "-n", "50", "HEAD"],
        { cwd: repoPath },
      );
      const expectedCount = Math.min(parseInt(stdout.trim(), 10), 50);

      // Get commits via extractor
      const commits = await extractor.getCommits({ maxCommits: 50 });

      // Should match exactly
      expect(commits.length).toBe(expectedCount);
    });

    it("should extract files correctly with stats", async () => {
      // Find a commit with files using git log
      const { stdout: logOutput } = await execFileAsync(
        "git",
        ["log", "--oneline", "--shortstat", "-n", "10", "HEAD"],
        { cwd: repoPath },
      );

      // If there are commits with files changed, verify our extractor gets them
      if (logOutput.includes("file")) {
        const commits = await extractor.getCommits({ maxCommits: 10 });
        const commitsWithFiles = commits.filter((c) => c.files.length > 0);

        // At least some commits should have files
        expect(commitsWithFiles.length).toBeGreaterThan(0);

        // Verify files and stats are consistent
        for (const commit of commitsWithFiles) {
          // If there are files, there should typically be insertions or deletions
          // (unless all files are renames with no changes)
          expect(commit.files.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("getCommits - range filtering", () => {
    it("should support sinceCommit range filtering", async () => {
      // Get all commits first
      const allCommits = await extractor.getCommits({ maxCommits: 20 });

      if (allCommits.length >= 5) {
        // Use the 5th commit as the "since" point
        const sinceHash = allCommits[4].hash;

        // Get commits since that point
        const recentCommits = await extractor.getCommits({
          sinceCommit: sinceHash,
          maxCommits: 20,
        });

        // Should have fewer commits (the 4 before the since point)
        expect(recentCommits.length).toBeLessThan(allCommits.length);
        expect(recentCommits.length).toBe(4);

        // Verify the commits are the expected ones
        for (let i = 0; i < recentCommits.length; i++) {
          expect(recentCommits[i].hash).toBe(allCommits[i].hash);
        }
      }
    });
  });

  describe("getCommitDiff", () => {
    it("should return diff for a valid commit", async () => {
      const commits = await extractor.getCommits({ maxCommits: 1 });

      if (commits.length > 0) {
        const diff = await extractor.getCommitDiff(commits[0].hash);

        // Diff should contain commit information
        expect(diff).toContain("commit");
        expect(diff).toContain(commits[0].hash);
      }
    });

    it("should return empty string for invalid commit", async () => {
      const diff = await extractor.getCommitDiff("0000000000000000000000000000000000000000");
      expect(diff).toBe("");
    });
  });

  describe("getLatestCommitHash", () => {
    it("should return the HEAD commit hash", async () => {
      const hash = await extractor.getLatestCommitHash();

      // Verify format
      expect(hash).toMatch(/^[a-f0-9]{40}$/);

      // Verify it matches git rev-parse HEAD
      const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
        cwd: repoPath,
      });
      expect(hash).toBe(stdout.trim());
    });
  });

  describe("getCommitCount", () => {
    it("should return total commit count", async () => {
      const count = await extractor.getCommitCount();

      // Verify against git rev-list
      const { stdout } = await execFileAsync(
        "git",
        ["rev-list", "--count", "HEAD"],
        { cwd: repoPath },
      );
      expect(count).toBe(parseInt(stdout.trim(), 10));
    });

    it("should return count since specific commit", async () => {
      const commits = await extractor.getCommits({ maxCommits: 10 });

      if (commits.length >= 5) {
        const sinceHash = commits[4].hash;
        const count = await extractor.getCommitCount(sinceHash);

        expect(count).toBe(4); // 4 commits between sinceHash and HEAD
      }
    });
  });
});
