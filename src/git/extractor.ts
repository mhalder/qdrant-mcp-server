/**
 * GitExtractor - Extract commit data from git repositories
 * Uses child_process.execFile for security (no shell injection)
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  GIT_LOG_COMMIT_DELIMITER,
  GIT_LOG_FORMAT,
  GIT_MAX_BUFFER,
} from "./config.js";
import type { GitConfig, GitExtractOptions, RawCommit } from "./types.js";

const execFileAsync = promisify(execFile);

/**
 * Normalize git remote URL to consistent format for hashing.
 * Handles both SSH and HTTPS URL formats.
 *
 * @example
 * normalizeRemoteUrl("git@github.com:user/repo.git") // → "user/repo"
 * normalizeRemoteUrl("https://github.com/user/repo.git") // → "user/repo"
 * normalizeRemoteUrl("") // → ""
 */
export function normalizeRemoteUrl(url: string): string {
  if (!url) return "";
  return url
    .replace(/^git@[^:]+:/, "") // git@github.com:user/repo → user/repo
    .replace(/^https?:\/\/[^/]+\//, "") // https://github.com/user/repo → user/repo
    .replace(/\.git$/, ""); // user/repo.git → user/repo
}

export class GitExtractor {
  constructor(
    private repoPath: string,
    private config: GitConfig,
  ) {}

  /**
   * Validate that the path is a git repository
   */
  async validateRepository(): Promise<boolean> {
    try {
      await execFileAsync("git", ["rev-parse", "--git-dir"], {
        cwd: this.repoPath,
        maxBuffer: GIT_MAX_BUFFER,
        timeout: this.config.gitTimeout,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the latest commit hash
   */
  async getLatestCommitHash(): Promise<string> {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: this.repoPath,
      maxBuffer: GIT_MAX_BUFFER,
      timeout: this.config.gitTimeout,
    });
    return stdout.trim();
  }

  /**
   * Get the remote origin URL, or empty string if not configured
   */
  async getRemoteUrl(): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["remote", "get-url", "origin"],
        {
          cwd: this.repoPath,
          maxBuffer: GIT_MAX_BUFFER,
          timeout: this.config.gitTimeout,
        },
      );
      return stdout.trim();
    } catch {
      return ""; // No remote configured
    }
  }

  /**
   * Get total commit count (optionally after a specific commit)
   */
  async getCommitCount(sinceCommit?: string): Promise<number> {
    const args = ["rev-list", "--count"];

    if (sinceCommit) {
      args.push(`${sinceCommit}..HEAD`);
    } else {
      args.push("HEAD");
    }

    const { stdout } = await execFileAsync("git", args, {
      cwd: this.repoPath,
      maxBuffer: GIT_MAX_BUFFER,
      timeout: this.config.gitTimeout,
    });

    return parseInt(stdout.trim(), 10);
  }

  /**
   * Extract commits from the repository
   */
  async getCommits(options?: GitExtractOptions): Promise<RawCommit[]> {
    const maxCommits = options?.maxCommits ?? this.config.maxCommits;

    // Build git log arguments
    const args = [
      "log",
      `--pretty=format:${GIT_LOG_COMMIT_DELIMITER}${GIT_LOG_FORMAT}`,
      "--numstat", // Include insertions/deletions per file
      `-n${maxCommits}`,
    ];

    // Add range if sinceCommit is specified
    if (options?.sinceCommit) {
      args.push(`${options.sinceCommit}..HEAD`);
    }

    // Add date filter if sinceDate is specified
    if (options?.sinceDate) {
      args.push(`--since=${options.sinceDate}`);
    }

    const { stdout } = await execFileAsync("git", args, {
      cwd: this.repoPath,
      maxBuffer: GIT_MAX_BUFFER,
      timeout: this.config.gitTimeout,
    });

    return this.parseGitLog(stdout);
  }

  /**
   * Get the diff for a specific commit
   */
  async getCommitDiff(commitHash: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["show", "--no-color", "-p", commitHash],
        {
          cwd: this.repoPath,
          maxBuffer: GIT_MAX_BUFFER,
          timeout: this.config.gitTimeout,
        },
      );

      // Truncate diff if it exceeds maxDiffSize
      if (stdout.length > this.config.maxDiffSize) {
        return (
          stdout.substring(0, this.config.maxDiffSize) +
          `\n\n[diff truncated: showing ${this.config.maxDiffSize} of ${stdout.length} bytes]`
        );
      }

      return stdout;
    } catch {
      return "";
    }
  }

  /**
   * Parse git log output into structured commits
   */
  private parseGitLog(output: string): RawCommit[] {
    const commits: RawCommit[] = [];

    // Split by commit delimiter
    const commitBlocks = output.split(GIT_LOG_COMMIT_DELIMITER);

    for (const block of commitBlocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      const commit = this.parseCommitBlock(trimmed);
      if (commit) {
        commits.push(commit);
      }
    }

    return commits;
  }

  /**
   * Parse a single commit block
   */
  private parseCommitBlock(block: string): RawCommit | null {
    // The format line is first, followed by numstat output
    const lines = block.split("\n");
    if (lines.length === 0) return null;

    // Parse the format line: hash|shortHash|author|authorEmail|date|subject|body
    const formatLine = lines[0];
    const parts = formatLine.split("|");

    if (parts.length < 6) return null;

    const [
      hash,
      shortHash,
      author,
      authorEmail,
      dateStr,
      subject,
      ...bodyParts
    ] = parts;

    // Parse files and stats from numstat output
    const { files, insertions, deletions } = this.parseNumstat(lines.slice(1));

    return {
      hash,
      shortHash,
      author,
      authorEmail,
      date: new Date(dateStr),
      subject,
      body: bodyParts.join("|").trim(), // Body might contain | characters
      files,
      insertions,
      deletions,
    };
  }

  /**
   * Parse numstat output (lines after the format line)
   */
  private parseNumstat(lines: string[]): {
    files: string[];
    insertions: number;
    deletions: number;
  } {
    const files: string[] = [];
    let insertions = 0;
    let deletions = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // numstat format: insertions<tab>deletions<tab>filename
      // Binary files show as "-" for insertions/deletions
      const match = trimmed.match(/^(\d+|-)\s+(\d+|-)\s+(.+)$/);

      if (match) {
        const [, ins, del, filename] = match;

        // Handle binary files (marked with -)
        if (ins !== "-") {
          insertions += parseInt(ins, 10);
        }
        if (del !== "-") {
          deletions += parseInt(del, 10);
        }

        // Handle renamed files (old -> new)
        if (filename.includes(" => ")) {
          const renameParts = filename.match(/(.+)\{(.+) => (.+)\}(.+)?/);
          if (renameParts) {
            files.push(
              `${renameParts[1]}${renameParts[3]}${renameParts[4] || ""}`,
            );
          } else {
            const simpleRename = filename.split(" => ");
            files.push(simpleRename[1] || filename);
          }
        } else {
          files.push(filename);
        }
      }
    }

    return { files, insertions, deletions };
  }
}
