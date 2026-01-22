/**
 * GitSynchronizer - Track last indexed commit for incremental updates
 */

import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { GitSnapshot } from "../types.js";

export class GitSynchronizer {
  private snapshotPath: string;
  private snapshot: GitSnapshot | null = null;

  constructor(
    private repoPath: string,
    collectionName: string,
  ) {
    // Store snapshots in ~/.qdrant-mcp/git-snapshots/
    const snapshotDir = join(homedir(), ".qdrant-mcp", "git-snapshots");
    this.snapshotPath = join(snapshotDir, `${collectionName}.json`);
  }

  /**
   * Initialize synchronizer by loading existing snapshot
   * @returns true if snapshot exists and was loaded
   */
  async initialize(): Promise<boolean> {
    try {
      const content = await fs.readFile(this.snapshotPath, "utf-8");
      this.snapshot = JSON.parse(content) as GitSnapshot;

      // Validate snapshot is for the same repo
      if (this.snapshot.repoPath !== this.repoPath) {
        this.snapshot = null;
        return false;
      }

      return true;
    } catch {
      this.snapshot = null;
      return false;
    }
  }

  /**
   * Get the last indexed commit hash
   */
  getLastCommitHash(): string | null {
    return this.snapshot?.lastCommitHash ?? null;
  }

  /**
   * Get the timestamp of last indexing
   */
  getLastIndexedAt(): Date | null {
    if (!this.snapshot) return null;
    return new Date(this.snapshot.lastIndexedAt);
  }

  /**
   * Get the number of commits indexed
   */
  getCommitsIndexed(): number {
    return this.snapshot?.commitsIndexed ?? 0;
  }

  /**
   * Update snapshot with new indexing state
   */
  async updateSnapshot(
    lastCommitHash: string,
    commitsIndexed: number,
  ): Promise<void> {
    this.snapshot = {
      repoPath: this.repoPath,
      lastCommitHash,
      lastIndexedAt: Date.now(),
      commitsIndexed,
    };

    // Ensure directory exists
    const dir = dirname(this.snapshotPath);
    await fs.mkdir(dir, { recursive: true });

    // Write snapshot atomically using temp file
    const tempPath = `${this.snapshotPath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(this.snapshot, null, 2));
    await fs.rename(tempPath, this.snapshotPath);
  }

  /**
   * Delete the snapshot file
   */
  async deleteSnapshot(): Promise<void> {
    try {
      await fs.unlink(this.snapshotPath);
      this.snapshot = null;
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Check if snapshot exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.snapshotPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get snapshot age in milliseconds
   */
  getSnapshotAge(): number | null {
    if (!this.snapshot) return null;
    return Date.now() - this.snapshot.lastIndexedAt;
  }
}
