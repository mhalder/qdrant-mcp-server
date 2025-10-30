/**
 * MerkleTree - Efficient change detection using Merkle trees
 * Enables incremental updates by comparing file hashes
 */

import { createHash } from 'crypto';

export class MerkleNode {
  constructor(
    public hash: string,
    public left?: MerkleNode,
    public right?: MerkleNode
  ) {}
}

export class MerkleTree {
  root: MerkleNode | undefined = undefined;

  /**
   * Build Merkle tree from file hashes
   * @param fileHashes Map of file path to content hash
   */
  build(fileHashes: Map<string, string>): void {
    if (fileHashes.size === 0) {
      this.root = undefined;
      return;
    }

    // Sort files for deterministic tree structure
    const leaves = Array.from(fileHashes.entries())
      .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
      .map(([path, hash]) => {
        const combined = `${path}:${hash}`;
        const leafHash = createHash('sha256').update(combined).digest('hex');
        return new MerkleNode(leafHash);
      });

    this.root = this.buildRecursive(leaves);
  }

  /**
   * Recursively build tree from leaf nodes
   */
  private buildRecursive(nodes: MerkleNode[]): MerkleNode {
    if (nodes.length === 1) {
      return nodes[0];
    }

    const parents: MerkleNode[] = [];
    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = nodes[i + 1] || left; // Duplicate if odd number

      const combined = left.hash + right.hash;
      const parentHash = createHash('sha256').update(combined).digest('hex');

      parents.push(new MerkleNode(parentHash, left, right));
    }

    return this.buildRecursive(parents);
  }

  /**
   * Compare two trees and return file differences
   */
  static compare(
    oldHashes: Map<string, string>,
    newHashes: Map<string, string>
  ): { added: string[]; modified: string[]; deleted: string[] } {
    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];

    // Find added and modified files
    for (const [path, hash] of newHashes) {
      if (!oldHashes.has(path)) {
        added.push(path);
      } else if (oldHashes.get(path) !== hash) {
        modified.push(path);
      }
    }

    // Find deleted files
    for (const [path] of oldHashes) {
      if (!newHashes.has(path)) {
        deleted.push(path);
      }
    }

    return { added, modified, deleted };
  }

  /**
   * Get root hash (quick comparison)
   */
  getRootHash(): string | undefined {
    return this.root?.hash;
  }

  /**
   * Serialize tree for storage
   */
  serialize(): string {
    return JSON.stringify({
      root: this.serializeNode(this.root),
    });
  }

  private serializeNode(node: MerkleNode | undefined): any | null {
    if (!node) return null;
    return {
      hash: node.hash,
      left: this.serializeNode(node.left),
      right: this.serializeNode(node.right),
    };
  }

  /**
   * Deserialize tree from storage
   */
  static deserialize(data: string): MerkleTree {
    const tree = new MerkleTree();
    const obj = JSON.parse(data);
    tree.root = tree.deserializeNode(obj.root);
    return tree;
  }

  private deserializeNode(obj: any): MerkleNode | undefined {
    if (!obj) return undefined;
    return new MerkleNode(
      obj.hash,
      this.deserializeNode(obj.left),
      this.deserializeNode(obj.right)
    );
  }
}
