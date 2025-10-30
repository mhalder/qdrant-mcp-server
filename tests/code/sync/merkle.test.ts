import { describe, expect, it } from "vitest";
import { MerkleNode, MerkleTree } from "../../../src/code/sync/merkle.js";

describe("MerkleNode", () => {
  it("should create a node with a hash", () => {
    const node = new MerkleNode("abc123");
    expect(node.hash).toBe("abc123");
    expect(node.left).toBeUndefined();
    expect(node.right).toBeUndefined();
  });

  it("should create a node with children", () => {
    const left = new MerkleNode("left");
    const right = new MerkleNode("right");
    const parent = new MerkleNode("parent", left, right);

    expect(parent.hash).toBe("parent");
    expect(parent.left).toBe(left);
    expect(parent.right).toBe(right);
  });
});

describe("MerkleTree", () => {
  describe("build", () => {
    it("should build tree from single file", () => {
      const tree = new MerkleTree();
      const fileHashes = new Map([["file1.ts", "hash1"]]);

      tree.build(fileHashes);

      expect(tree.root).toBeDefined();
      expect(tree.root?.hash).toBeTruthy();
      expect(tree.root?.hash).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    it("should build tree from multiple files", () => {
      const tree = new MerkleTree();
      const fileHashes = new Map([
        ["file1.ts", "hash1"],
        ["file2.ts", "hash2"],
        ["file3.ts", "hash3"],
      ]);

      tree.build(fileHashes);

      expect(tree.root).toBeDefined();
      expect(tree.root?.hash).toBeTruthy();
    });

    it("should handle empty file map", () => {
      const tree = new MerkleTree();
      const fileHashes = new Map<string, string>();

      tree.build(fileHashes);

      expect(tree.root).toBeUndefined();
    });

    it("should sort files alphabetically", () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();

      // Same files, different insertion order
      const files1 = new Map([
        ["a.ts", "hash1"],
        ["b.ts", "hash2"],
        ["c.ts", "hash3"],
      ]);

      const files2 = new Map([
        ["c.ts", "hash3"],
        ["a.ts", "hash1"],
        ["b.ts", "hash2"],
      ]);

      tree1.build(files1);
      tree2.build(files2);

      expect(tree1.root?.hash).toBe(tree2.root?.hash);
    });

    it("should create different hashes for different file sets", () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();

      tree1.build(
        new Map([
          ["file1.ts", "hash1"],
          ["file2.ts", "hash2"],
        ])
      );

      tree2.build(
        new Map([
          ["file1.ts", "hash1"],
          ["file3.ts", "hash3"],
        ])
      );

      expect(tree1.root?.hash).not.toBe(tree2.root?.hash);
    });

    it("should handle large number of files", () => {
      const tree = new MerkleTree();
      const fileHashes = new Map<string, string>();

      for (let i = 0; i < 100; i++) {
        fileHashes.set(`file${i}.ts`, `hash${i}`);
      }

      tree.build(fileHashes);

      expect(tree.root).toBeDefined();
      expect(tree.root?.hash).toBeTruthy();
    });
  });

  describe("getRootHash", () => {
    it("should return root hash when tree is built", () => {
      const tree = new MerkleTree();
      tree.build(new Map([["file.ts", "hash123"]]));

      expect(tree.getRootHash()).toBeTruthy();
      expect(tree.getRootHash()).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should return undefined when tree is empty", () => {
      const tree = new MerkleTree();
      expect(tree.getRootHash()).toBeUndefined();
    });
  });

  describe("serialize and deserialize", () => {
    it("should serialize and deserialize single node tree", () => {
      const tree = new MerkleTree();
      tree.build(new Map([["file.ts", "hash123"]]));

      const serialized = tree.serialize();
      const newTree = MerkleTree.deserialize(serialized);

      expect(newTree.getRootHash()).toBe(tree.getRootHash());
    });

    it("should serialize and deserialize multi-node tree", () => {
      const tree = new MerkleTree();
      tree.build(
        new Map([
          ["file1.ts", "hash1"],
          ["file2.ts", "hash2"],
          ["file3.ts", "hash3"],
        ])
      );

      const serialized = tree.serialize();
      const newTree = MerkleTree.deserialize(serialized);

      expect(newTree.getRootHash()).toBe(tree.getRootHash());
    });

    it("should handle empty tree serialization", () => {
      const tree = new MerkleTree();
      const serialized = tree.serialize();

      expect(serialized).toBeDefined();

      const newTree = MerkleTree.deserialize(serialized);
      expect(newTree.getRootHash()).toBeUndefined();
    });

    it("should handle complex tree structure", () => {
      const tree = new MerkleTree();
      const fileHashes = new Map<string, string>();

      for (let i = 0; i < 10; i++) {
        fileHashes.set(`file${i}.ts`, `hash${i}`);
      }

      tree.build(fileHashes);

      const serialized = tree.serialize();
      const newTree = MerkleTree.deserialize(serialized);

      expect(newTree.getRootHash()).toBe(tree.getRootHash());
    });

    it("should preserve tree structure through serialize/deserialize", () => {
      const tree = new MerkleTree();
      tree.build(
        new Map([
          ["a.ts", "hash_a"],
          ["b.ts", "hash_b"],
        ])
      );

      const serialized = tree.serialize();
      const deserialized = MerkleTree.deserialize(serialized);

      // Rebuild original and compare
      tree.build(
        new Map([
          ["a.ts", "hash_a"],
          ["b.ts", "hash_b"],
        ])
      );

      expect(deserialized.getRootHash()).toBe(tree.getRootHash());
    });
  });

  describe("compare", () => {
    it("should detect no changes", () => {
      const oldHashes = new Map([
        ["file1.ts", "hash1"],
        ["file2.ts", "hash2"],
      ]);

      const newHashes = new Map([
        ["file1.ts", "hash1"],
        ["file2.ts", "hash2"],
      ]);

      const changes = MerkleTree.compare(oldHashes, newHashes);

      expect(changes.added).toEqual([]);
      expect(changes.modified).toEqual([]);
      expect(changes.deleted).toEqual([]);
    });

    it("should detect added files", () => {
      const oldHashes = new Map([["file1.ts", "hash1"]]);

      const newHashes = new Map([
        ["file1.ts", "hash1"],
        ["file2.ts", "hash2"],
        ["file3.ts", "hash3"],
      ]);

      const changes = MerkleTree.compare(oldHashes, newHashes);

      expect(changes.added).toContain("file2.ts");
      expect(changes.added).toContain("file3.ts");
      expect(changes.modified).toEqual([]);
      expect(changes.deleted).toEqual([]);
    });

    it("should detect deleted files", () => {
      const oldHashes = new Map([
        ["file1.ts", "hash1"],
        ["file2.ts", "hash2"],
        ["file3.ts", "hash3"],
      ]);

      const newHashes = new Map([["file1.ts", "hash1"]]);

      const changes = MerkleTree.compare(oldHashes, newHashes);

      expect(changes.added).toEqual([]);
      expect(changes.modified).toEqual([]);
      expect(changes.deleted).toContain("file2.ts");
      expect(changes.deleted).toContain("file3.ts");
    });

    it("should detect modified files", () => {
      const oldHashes = new Map([
        ["file1.ts", "hash1"],
        ["file2.ts", "hash2"],
      ]);

      const newHashes = new Map([
        ["file1.ts", "hash1_modified"],
        ["file2.ts", "hash2_modified"],
      ]);

      const changes = MerkleTree.compare(oldHashes, newHashes);

      expect(changes.added).toEqual([]);
      expect(changes.modified).toContain("file1.ts");
      expect(changes.modified).toContain("file2.ts");
      expect(changes.deleted).toEqual([]);
    });

    it("should detect mixed changes", () => {
      const oldHashes = new Map([
        ["file1.ts", "hash1"],
        ["file2.ts", "hash2"],
        ["file3.ts", "hash3"],
      ]);

      const newHashes = new Map([
        ["file1.ts", "hash1_modified"], // modified
        ["file2.ts", "hash2"], // unchanged
        ["file4.ts", "hash4"], // added
        // file3.ts deleted
      ]);

      const changes = MerkleTree.compare(oldHashes, newHashes);

      expect(changes.added).toEqual(["file4.ts"]);
      expect(changes.modified).toEqual(["file1.ts"]);
      expect(changes.deleted).toEqual(["file3.ts"]);
    });

    it("should handle empty old hashes", () => {
      const oldHashes = new Map<string, string>();
      const newHashes = new Map([
        ["file1.ts", "hash1"],
        ["file2.ts", "hash2"],
      ]);

      const changes = MerkleTree.compare(oldHashes, newHashes);

      expect(changes.added).toContain("file1.ts");
      expect(changes.added).toContain("file2.ts");
      expect(changes.modified).toEqual([]);
      expect(changes.deleted).toEqual([]);
    });

    it("should handle empty new hashes", () => {
      const oldHashes = new Map([
        ["file1.ts", "hash1"],
        ["file2.ts", "hash2"],
      ]);
      const newHashes = new Map<string, string>();

      const changes = MerkleTree.compare(oldHashes, newHashes);

      expect(changes.added).toEqual([]);
      expect(changes.modified).toEqual([]);
      expect(changes.deleted).toContain("file1.ts");
      expect(changes.deleted).toContain("file2.ts");
    });

    it("should handle both empty maps", () => {
      const oldHashes = new Map<string, string>();
      const newHashes = new Map<string, string>();

      const changes = MerkleTree.compare(oldHashes, newHashes);

      expect(changes.added).toEqual([]);
      expect(changes.modified).toEqual([]);
      expect(changes.deleted).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("should handle single file tree", () => {
      const tree = new MerkleTree();
      tree.build(new Map([["single.ts", "hash"]]));

      expect(tree.root?.hash).toBeTruthy();
      expect(tree.root?.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(tree.root?.left).toBeUndefined();
      expect(tree.root?.right).toBeUndefined();
    });

    it("should handle two file tree", () => {
      const tree = new MerkleTree();
      tree.build(
        new Map([
          ["file1.ts", "hash1"],
          ["file2.ts", "hash2"],
        ])
      );

      expect(tree.root).toBeDefined();
      expect(tree.root?.left).toBeDefined();
      expect(tree.root?.right).toBeDefined();
    });

    it("should handle odd number of files", () => {
      const tree = new MerkleTree();
      tree.build(
        new Map([
          ["file1.ts", "hash1"],
          ["file2.ts", "hash2"],
          ["file3.ts", "hash3"],
        ])
      );

      expect(tree.root).toBeDefined();
    });

    it("should handle very long file paths", () => {
      const tree = new MerkleTree();
      const longPath = `${"/very/long/path/".repeat(50)}file.ts`;

      tree.build(new Map([[longPath, "hash"]]));

      expect(tree.root?.hash).toBeTruthy();
      expect(tree.root?.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle special characters in filenames", () => {
      const tree = new MerkleTree();
      tree.build(
        new Map([
          ["file with spaces.ts", "hash1"],
          ["file-with-dashes.ts", "hash2"],
          ["file_with_underscores.ts", "hash3"],
        ])
      );

      expect(tree.root).toBeDefined();
    });
  });
});
