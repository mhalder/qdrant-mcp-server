/**
 * Snapshot - Persistence layer for Merkle tree snapshots
 * Stores file hashes and tree structure for incremental updates
 */

import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { MerkleTree } from "./merkle.js";

export interface Snapshot {
  codebasePath: string;
  timestamp: number;
  fileHashes: Record<string, string>;
  merkleTree: string; // Serialized tree
}

export class SnapshotManager {
  constructor(private snapshotPath: string) {}

  /**
   * Save snapshot to disk
   */
  async save(
    codebasePath: string,
    fileHashes: Map<string, string>,
    tree: MerkleTree
  ): Promise<void> {
    const snapshot: Snapshot = {
      codebasePath,
      timestamp: Date.now(),
      fileHashes: Object.fromEntries(fileHashes),
      merkleTree: tree.serialize(),
    };

    // Ensure directory exists
    await fs.mkdir(dirname(this.snapshotPath), { recursive: true });

    // Write snapshot atomically (write to temp file, then rename)
    const tempPath = `${this.snapshotPath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(snapshot, null, 2), "utf-8");
    await fs.rename(tempPath, this.snapshotPath);
  }

  /**
   * Load snapshot from disk
   */
  async load(): Promise<{
    codebasePath: string;
    fileHashes: Map<string, string>;
    merkleTree: MerkleTree;
    timestamp: number;
  } | null> {
    try {
      const data = await fs.readFile(this.snapshotPath, "utf-8");
      const snapshot: Snapshot = JSON.parse(data);

      const fileHashes = new Map(Object.entries(snapshot.fileHashes));
      const tree = MerkleTree.deserialize(snapshot.merkleTree);

      return {
        codebasePath: snapshot.codebasePath,
        fileHashes,
        merkleTree: tree,
        timestamp: snapshot.timestamp,
      };
    } catch (_error) {
      // Snapshot doesn't exist or is corrupted
      return null;
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
   * Delete snapshot
   */
  async delete(): Promise<void> {
    try {
      await fs.unlink(this.snapshotPath);
    } catch {
      // Ignore if doesn't exist
    }
  }

  /**
   * Validate snapshot (check for corruption)
   */
  async validate(): Promise<boolean> {
    try {
      const snapshot = await this.load();
      if (!snapshot) return false;

      // Basic validation: check if tree can be deserialized
      return snapshot.merkleTree.getRootHash() !== undefined || snapshot.fileHashes.size === 0;
    } catch {
      return false;
    }
  }
}
