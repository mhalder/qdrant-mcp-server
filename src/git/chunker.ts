/**
 * CommitChunker - Create embeddable chunks from git commits
 */

import { createHash } from "node:crypto";
import { COMMIT_TYPE_PATTERNS } from "./config.js";
import type { CommitChunk, CommitType, GitConfig, RawCommit } from "./types.js";

export class CommitChunker {
  constructor(private config: GitConfig) {}

  /**
   * Classify commit type based on commit message
   */
  classifyCommitType(commit: RawCommit): CommitType {
    const message = `${commit.subject} ${commit.body}`.toLowerCase();

    // Check each type's patterns
    for (const { type, patterns } of COMMIT_TYPE_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(commit.subject) || pattern.test(message)) {
          return type;
        }
      }
    }

    return "other";
  }

  /**
   * Create embeddable chunks from a commit
   * Currently produces one chunk per commit, but could be extended
   * to handle very large commits differently
   */
  createChunks(
    commit: RawCommit,
    repoPath: string,
    diff?: string,
  ): CommitChunk[] {
    const commitType = this.classifyCommitType(commit);
    const content = this.formatChunkContent(commit, commitType, diff);

    // Check if content exceeds max chunk size
    if (content.length > this.config.maxChunkSize) {
      // Truncate content but keep essential metadata visible
      const truncatedContent = this.truncateContent(
        content,
        commit,
        commitType,
      );
      return [
        {
          content: truncatedContent,
          metadata: this.createMetadata(commit, commitType, repoPath),
        },
      ];
    }

    return [
      {
        content,
        metadata: this.createMetadata(commit, commitType, repoPath),
      },
    ];
  }

  /**
   * Generate deterministic chunk ID from commit content
   */
  generateChunkId(chunk: CommitChunk): string {
    // Use commit hash + repo path for deterministic ID
    const data = `${chunk.metadata.commitHash}:${chunk.metadata.repoPath}`;
    const hash = createHash("sha256").update(data).digest("hex");
    return `gitcommit_${hash.substring(0, 16)}`;
  }

  /**
   * Format the chunk content for embedding
   */
  private formatChunkContent(
    commit: RawCommit,
    commitType: CommitType,
    diff?: string,
  ): string {
    const lines: string[] = [];

    // Header section
    lines.push(`Commit: ${commit.shortHash}`);
    lines.push(`Type: ${commitType}`);
    lines.push(`Author: ${commit.author}`);
    lines.push(`Date: ${commit.date.toISOString().split("T")[0]}`);
    lines.push("");

    // Subject line
    lines.push(`Subject: ${commit.subject}`);
    lines.push("");

    // Body (description) if present
    if (commit.body.trim()) {
      lines.push("Description:");
      lines.push(commit.body.trim());
      lines.push("");
    }

    // Files changed
    if (this.config.includeFileList && commit.files.length > 0) {
      lines.push(`Files changed (${commit.files.length}):`);
      for (const file of commit.files.slice(0, 20)) {
        // Limit to 20 files
        lines.push(`  - ${file}`);
      }
      if (commit.files.length > 20) {
        lines.push(`  ... and ${commit.files.length - 20} more files`);
      }
      lines.push("");
    }

    // Change stats
    lines.push(`Changes: +${commit.insertions} -${commit.deletions}`);

    // Diff preview if included
    if (this.config.includeDiff && diff) {
      lines.push("");
      lines.push("Diff preview:");
      lines.push(this.extractDiffPreview(diff));
    }

    return lines.join("\n");
  }

  /**
   * Extract a readable preview from the diff
   */
  private extractDiffPreview(diff: string): string {
    // Remove the commit metadata from the top of git show output
    const diffStart = diff.indexOf("diff --git");
    if (diffStart === -1) return "";

    const diffContent = diff.substring(diffStart);

    // Extract just the actual changes (lines starting with + or -)
    // but not the diff headers
    const lines = diffContent.split("\n");
    const changeLines: string[] = [];
    let currentFile = "";

    for (const line of lines) {
      if (line.startsWith("diff --git")) {
        // Extract filename from diff header
        const match = line.match(/diff --git a\/.+ b\/(.+)/);
        if (match) {
          currentFile = match[1];
        }
      } else if (line.startsWith("@@")) {
        // Include hunk header with file context
        if (currentFile && changeLines.length > 0) {
          changeLines.push(`--- ${currentFile} ---`);
        }
        changeLines.push(line);
      } else if (
        (line.startsWith("+") || line.startsWith("-")) &&
        !line.startsWith("+++") &&
        !line.startsWith("---")
      ) {
        changeLines.push(line);
      }
    }

    // Limit the preview size
    const maxPreviewLines = 50;
    if (changeLines.length > maxPreviewLines) {
      return (
        changeLines.slice(0, maxPreviewLines).join("\n") +
        `\n... (${changeLines.length - maxPreviewLines} more lines)`
      );
    }

    return changeLines.join("\n");
  }

  /**
   * Truncate content while preserving essential information
   */
  private truncateContent(
    content: string,
    commit: RawCommit,
    commitType: CommitType,
  ): string {
    // Keep the header and subject, truncate the rest
    const essentialLines: string[] = [
      `Commit: ${commit.shortHash}`,
      `Type: ${commitType}`,
      `Author: ${commit.author}`,
      `Date: ${commit.date.toISOString().split("T")[0]}`,
      "",
      `Subject: ${commit.subject}`,
      "",
    ];

    // Add truncated body if present
    if (commit.body.trim()) {
      const maxBodyLength = 500;
      const body = commit.body.trim();
      if (body.length > maxBodyLength) {
        essentialLines.push("Description:");
        essentialLines.push(body.substring(0, maxBodyLength) + "...");
        essentialLines.push("");
      } else {
        essentialLines.push("Description:");
        essentialLines.push(body);
        essentialLines.push("");
      }
    }

    // Add file summary
    if (commit.files.length > 0) {
      essentialLines.push(`Files changed (${commit.files.length}):`);
      for (const file of commit.files.slice(0, 10)) {
        essentialLines.push(`  - ${file}`);
      }
      if (commit.files.length > 10) {
        essentialLines.push(`  ... and ${commit.files.length - 10} more files`);
      }
      essentialLines.push("");
    }

    essentialLines.push(`Changes: +${commit.insertions} -${commit.deletions}`);
    essentialLines.push("");
    essentialLines.push("[content truncated due to size]");

    return essentialLines.join("\n");
  }

  /**
   * Create metadata object for a chunk
   */
  private createMetadata(
    commit: RawCommit,
    commitType: CommitType,
    repoPath: string,
  ): CommitChunk["metadata"] {
    return {
      commitHash: commit.hash,
      shortHash: commit.shortHash,
      author: commit.author,
      authorEmail: commit.authorEmail,
      date: commit.date.toISOString(),
      subject: commit.subject,
      commitType,
      files: commit.files,
      insertions: commit.insertions,
      deletions: commit.deletions,
      repoPath,
    };
  }
}
