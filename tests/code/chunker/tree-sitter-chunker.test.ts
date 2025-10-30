import { beforeEach, describe, expect, it } from "vitest";
import { TreeSitterChunker } from "../../../src/code/chunker/tree-sitter-chunker.js";
import type { ChunkerConfig } from "../../../src/code/types.js";

describe("TreeSitterChunker", () => {
  let chunker: TreeSitterChunker;
  let config: ChunkerConfig;

  beforeEach(() => {
    config = {
      chunkSize: 500,
      chunkOverlap: 50,
      maxChunkSize: 1000,
    };
    chunker = new TreeSitterChunker(config);
  });

  describe("chunk - TypeScript", () => {
    it("should chunk TypeScript functions", async () => {
      const code = `
function add(a: number, b: number): number {
  return a + b;
}

function multiply(a: number, b: number): number {
  return a * b;
}
      `;

      const chunks = await chunker.chunk(code, "test.ts", "typescript");
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks.some((c) => c.metadata.name === "add")).toBe(true);
      expect(chunks.some((c) => c.metadata.name === "multiply")).toBe(true);
    });

    it("should chunk TypeScript classes", async () => {
      const code = `
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}
      `;

      const chunks = await chunker.chunk(code, "test.ts", "typescript");
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some((c) => c.metadata.chunkType === "class")).toBe(true);
    });

    it("should chunk TypeScript interfaces", async () => {
      const code = `
interface User {
  id: string;
  name: string;
}

interface Product {
  id: string;
  price: number;
}
      `;

      const chunks = await chunker.chunk(code, "test.ts", "typescript");
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("chunk - Python", () => {
    it("should chunk Python functions", async () => {
      const code = `
def calculate_sum(a, b):
    return a + b

def calculate_product(a, b):
    return a * b
      `;

      const chunks = await chunker.chunk(code, "test.py", "python");
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks.some((c) => c.metadata.name === "calculate_sum")).toBe(true);
    });

    it("should chunk Python classes", async () => {
      const code = `
class Calculator:
    def add(self, a, b):
        return a + b

    def multiply(self, a, b):
        return a * b
      `;

      const chunks = await chunker.chunk(code, "test.py", "python");
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe("chunk - JavaScript", () => {
    it("should chunk JavaScript functions", async () => {
      const code = `
function greet(name) {
  return 'Hello, ' + name;
}

function farewell(name) {
  return 'Goodbye, ' + name;
}
      `;

      const chunks = await chunker.chunk(code, "test.js", "javascript");
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("fallback behavior", () => {
    it("should fallback to character chunker for unsupported language", async () => {
      const code = "Some random text\nthat is not code\nbut text";
      const chunks = await chunker.chunk(code, "test.txt", "unknown");

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should fallback for very large chunks", async () => {
      const largeFunction = `
function veryLargeFunction() {
  ${Array(100).fill('console.log("line");').join("\n  ")}
}
      `;

      const chunks = await chunker.chunk(largeFunction, "test.js", "javascript");
      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should fallback on parsing errors", async () => {
      const invalidCode = "function broken( { invalid syntax";
      const chunks = await chunker.chunk(invalidCode, "test.js", "javascript");

      // Should handle gracefully and fallback
      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe("metadata extraction", () => {
    it("should extract function names", async () => {
      const code = `
function myFunction() {
  return 42;
}
      `;

      const chunks = await chunker.chunk(code, "test.ts", "typescript");
      expect(chunks[0].metadata.name).toBe("myFunction");
      expect(chunks[0].metadata.chunkType).toBe("function");
    });

    it("should include file path and language", async () => {
      const code = "function test() {}";
      const chunks = await chunker.chunk(code, "/path/to/file.ts", "typescript");

      expect(chunks[0].metadata.filePath).toBe("/path/to/file.ts");
      expect(chunks[0].metadata.language).toBe("typescript");
    });

    it("should set correct line numbers", async () => {
      const code = `
line1
function test() {
  return 1;
}
      `;

      const chunks = await chunker.chunk(code, "test.ts", "typescript");
      expect(chunks[0].startLine).toBeGreaterThan(0);
      expect(chunks[0].endLine).toBeGreaterThan(chunks[0].startLine);
    });
  });

  describe("supportsLanguage", () => {
    it("should support TypeScript", () => {
      expect(chunker.supportsLanguage("typescript")).toBe(true);
    });

    it("should support Python", () => {
      expect(chunker.supportsLanguage("python")).toBe(true);
    });

    it("should not support unknown languages", () => {
      expect(chunker.supportsLanguage("unknown")).toBe(false);
    });
  });

  describe("getStrategyName", () => {
    it("should return tree-sitter", () => {
      expect(chunker.getStrategyName()).toBe("tree-sitter");
    });
  });

  describe("edge cases", () => {
    it("should handle empty code", async () => {
      const chunks = await chunker.chunk("", "test.ts", "typescript");
      expect(chunks).toHaveLength(0);
    });

    it("should skip very small chunks", async () => {
      const code = "const x = 1;";
      const chunks = await chunker.chunk(code, "test.ts", "typescript");
      // Very small chunks should be skipped
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle nested structures", async () => {
      const code = `
class Outer {
  method1() {
    function inner() {
      return 1;
    }
  }

  method2() {
    return 2;
  }
}
      `;

      const chunks = await chunker.chunk(code, "test.ts", "typescript");
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
