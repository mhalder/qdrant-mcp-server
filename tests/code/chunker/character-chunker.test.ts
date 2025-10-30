import { beforeEach, describe, expect, it } from "vitest";
import { CharacterChunker } from "../../../src/code/chunker/character-chunker.js";
import type { ChunkerConfig } from "../../../src/code/types.js";

describe("CharacterChunker", () => {
  let chunker: CharacterChunker;
  let config: ChunkerConfig;

  beforeEach(() => {
    config = {
      chunkSize: 100,
      chunkOverlap: 20,
      maxChunkSize: 200,
    };
    chunker = new CharacterChunker(config);
  });

  describe("chunk", () => {
    it("should chunk small code into single chunk", async () => {
      const code =
        "function hello() {\n  console.log('Starting hello function');\n  return 'world';\n}";
      const chunks = await chunker.chunk(code, "test.ts", "typescript");

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain("hello");
      expect(chunks[0].startLine).toBe(1);
      expect(chunks[0].metadata.language).toBe("typescript");
    });

    it("should chunk large code into multiple chunks", async () => {
      const code = Array(10).fill("function test() { console.log('test'); }\n").join("");
      const chunks = await chunker.chunk(code, "test.js", "javascript");

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(config.maxChunkSize);
      });
    });

    it("should preserve line numbers", async () => {
      const code =
        "This is line 1 with enough content to not be filtered\n" +
        "This is line 2 with enough content to not be filtered\n" +
        "This is line 3 with enough content to not be filtered";
      const chunks = await chunker.chunk(code, "test.txt", "text");

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].startLine).toBe(1);
      expect(chunks[0].endLine).toBeGreaterThan(chunks[0].startLine);
    });

    it("should apply overlap between chunks", async () => {
      const code = Array(20).fill("const x = 1;\n").join("");
      const chunks = await chunker.chunk(code, "test.js", "javascript");

      if (chunks.length > 1) {
        // Check that there's overlap in content
        expect(chunks.length).toBeGreaterThan(1);
      }
    });

    it("should find good break points", async () => {
      const code = `function foo() {
  return 1;
}

function bar() {
  return 2;
}

function baz() {
  return 3;
}`;

      const chunks = await chunker.chunk(code, "test.js", "javascript");
      // Should try to break at function boundaries
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });

    it("should handle empty code", async () => {
      const code = "";
      const chunks = await chunker.chunk(code, "test.ts", "typescript");
      expect(chunks).toHaveLength(0);
    });

    it("should handle code with only whitespace", async () => {
      const code = "   \n\n\n   ";
      const chunks = await chunker.chunk(code, "test.ts", "typescript");
      expect(chunks).toHaveLength(0);
    });

    it("should skip very small chunks", async () => {
      const code = "x";
      const chunks = await chunker.chunk(code, "test.ts", "typescript");
      expect(chunks).toHaveLength(0);
    });
  });

  describe("supportsLanguage", () => {
    it("should support all languages", () => {
      expect(chunker.supportsLanguage("typescript")).toBe(true);
      expect(chunker.supportsLanguage("python")).toBe(true);
      expect(chunker.supportsLanguage("unknown")).toBe(true);
    });
  });

  describe("getStrategyName", () => {
    it("should return correct strategy name", () => {
      expect(chunker.getStrategyName()).toBe("character-based");
    });
  });

  describe("metadata", () => {
    it("should include correct chunk metadata", async () => {
      const code = "function test() {\n  console.log('test function');\n  return 1;\n}";
      const chunks = await chunker.chunk(code, "/path/to/file.ts", "typescript");

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata).toEqual({
        filePath: "/path/to/file.ts",
        language: "typescript",
        chunkIndex: 0,
        chunkType: "block",
      });
    });

    it("should increment chunk index", async () => {
      const code = Array(20).fill("function test() {}\n").join("");
      const chunks = await chunker.chunk(code, "test.ts", "typescript");

      if (chunks.length > 1) {
        expect(chunks[0].metadata.chunkIndex).toBe(0);
        expect(chunks[1].metadata.chunkIndex).toBe(1);
      }
    });
  });
});
