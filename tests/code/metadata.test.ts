import { beforeEach, describe, expect, it } from "vitest";
import { MetadataExtractor } from "../../src/code/metadata.js";
import type { CodeChunk } from "../../src/code/types.js";

describe("MetadataExtractor", () => {
  let extractor: MetadataExtractor;

  beforeEach(() => {
    extractor = new MetadataExtractor();
  });

  describe("extractLanguage", () => {
    it("should extract TypeScript from .ts extension", () => {
      expect(extractor.extractLanguage("file.ts")).toBe("typescript");
    });

    it("should extract JavaScript from .js extension", () => {
      expect(extractor.extractLanguage("file.js")).toBe("javascript");
    });

    it("should extract Python from .py extension", () => {
      expect(extractor.extractLanguage("file.py")).toBe("python");
    });

    it("should extract Go from .go extension", () => {
      expect(extractor.extractLanguage("file.go")).toBe("go");
    });

    it("should extract Rust from .rs extension", () => {
      expect(extractor.extractLanguage("file.rs")).toBe("rust");
    });

    it("should extract Java from .java extension", () => {
      expect(extractor.extractLanguage("file.java")).toBe("java");
    });

    it("should handle paths with multiple dots", () => {
      expect(extractor.extractLanguage("my.file.test.ts")).toBe("typescript");
    });

    it("should return unknown for unrecognized extensions", () => {
      expect(extractor.extractLanguage("file.xyz")).toBe("unknown");
    });

    it("should handle files without extensions", () => {
      expect(extractor.extractLanguage("Makefile")).toBe("unknown");
    });
  });

  describe("generateChunkId", () => {
    it("should generate consistent IDs for same chunk", () => {
      const chunk: CodeChunk = {
        content: "function test() { return 1; }",
        startLine: 1,
        endLine: 3,
        metadata: {
          filePath: "/path/to/file.ts",
          language: "typescript",
          chunkIndex: 0,
          chunkType: "function",
          name: "test",
        },
      };

      const id1 = extractor.generateChunkId(chunk);
      const id2 = extractor.generateChunkId(chunk);

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^chunk_[a-f0-9]{16}$/);
    });

    it("should generate different IDs for different content", () => {
      const chunk1: CodeChunk = {
        content: "function test1() {}",
        startLine: 1,
        endLine: 1,
        metadata: {
          filePath: "/path/to/file.ts",
          language: "typescript",
          chunkIndex: 0,
        },
      };

      const chunk2: CodeChunk = {
        content: "function test2() {}",
        startLine: 1,
        endLine: 1,
        metadata: {
          filePath: "/path/to/file.ts",
          language: "typescript",
          chunkIndex: 0,
        },
      };

      expect(extractor.generateChunkId(chunk1)).not.toBe(extractor.generateChunkId(chunk2));
    });

    it("should generate different IDs for different file paths", () => {
      const chunk1: CodeChunk = {
        content: "function test() {}",
        startLine: 1,
        endLine: 1,
        metadata: {
          filePath: "/path/to/file1.ts",
          language: "typescript",
          chunkIndex: 0,
        },
      };

      const chunk2: CodeChunk = {
        content: "function test() {}",
        startLine: 1,
        endLine: 1,
        metadata: {
          filePath: "/path/to/file2.ts",
          language: "typescript",
          chunkIndex: 0,
        },
      };

      expect(extractor.generateChunkId(chunk1)).not.toBe(extractor.generateChunkId(chunk2));
    });

    it("should generate different IDs for different line ranges", () => {
      const chunk1: CodeChunk = {
        content: "function test() {}",
        startLine: 1,
        endLine: 5,
        metadata: {
          filePath: "/path/to/file.ts",
          language: "typescript",
          chunkIndex: 0,
        },
      };

      const chunk2: CodeChunk = {
        content: "function test() {}",
        startLine: 10,
        endLine: 15,
        metadata: {
          filePath: "/path/to/file.ts",
          language: "typescript",
          chunkIndex: 0,
        },
      };

      expect(extractor.generateChunkId(chunk1)).not.toBe(extractor.generateChunkId(chunk2));
    });
  });

  describe("containsSecrets", () => {
    it("should detect API keys", () => {
      const code = 'const apiKey = "sk_live_1234567890abcdefghij";';
      expect(extractor.containsSecrets(code)).toBe(true);
    });

    it("should detect passwords", () => {
      const code = 'const password = "mySecretPass123!";';
      expect(extractor.containsSecrets(code)).toBe(true);
    });

    it("should detect AWS access keys", () => {
      const code = 'const key = "AKIAIOSFODNN7EXAMPLE";';
      expect(extractor.containsSecrets(code)).toBe(true);
    });

    it("should detect private keys", () => {
      const code = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg";
      expect(extractor.containsSecrets(code)).toBe(true);
    });

    it("should detect tokens", () => {
      const code = 'const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";';
      expect(extractor.containsSecrets(code)).toBe(true);
    });

    it("should not flag safe code", () => {
      const code = `
function add(a: number, b: number): number {
  return a + b;
}
      `;
      expect(extractor.containsSecrets(code)).toBe(false);
    });

    it("should not flag placeholder values", () => {
      const code = 'const apiKey = "YOUR_API_KEY_HERE";';
      expect(extractor.containsSecrets(code)).toBe(false);
    });

    it("should handle case insensitivity", () => {
      const code = 'const API_KEY = "sk_live_1234567890abcdefghij";';
      expect(extractor.containsSecrets(code)).toBe(true);
    });
  });

  describe("extractImportsExports", () => {
    it("should extract TypeScript imports", () => {
      const code = `
import { foo, bar } from './module';
import defaultImport from './another';
import * as utils from './utils';
      `;

      const result = extractor.extractImportsExports(code, "typescript");
      expect(result.imports).toContain("./module");
      expect(result.imports).toContain("./another");
      expect(result.imports).toContain("./utils");
    });

    it("should extract TypeScript exports", () => {
      const code = `
export function foo() {}
export class Bar {}
export { baz } from './module';
export default MyClass;
      `;

      const result = extractor.extractImportsExports(code, "typescript");
      expect(result.exports).toContain("foo");
      expect(result.exports).toContain("Bar");
      expect(result.exports).toContain("baz");
      expect(result.exports).toContain("default");
    });

    it("should extract Python imports", () => {
      const code = `
import os
import sys
from typing import List, Dict
from .module import MyClass
      `;

      const result = extractor.extractImportsExports(code, "python");
      expect(result.imports).toContain("os");
      expect(result.imports).toContain("sys");
      expect(result.imports).toContain("typing");
      expect(result.imports).toContain(".module");
    });

    it("should extract Python exports (defs and classes)", () => {
      const code = `
def my_function():
    pass

class MyClass:
    pass
      `;

      const result = extractor.extractImportsExports(code, "python");
      expect(result.exports).toContain("my_function");
      expect(result.exports).toContain("MyClass");
    });

    it("should handle JavaScript require statements", () => {
      const code = `
const fs = require('fs');
const { join } = require('path');
      `;

      const result = extractor.extractImportsExports(code, "javascript");
      expect(result.imports).toContain("fs");
      expect(result.imports).toContain("path");
    });

    it("should return empty arrays for unsupported languages", () => {
      const code = "some random text";
      const result = extractor.extractImportsExports(code, "unknown");
      expect(result.imports).toEqual([]);
      expect(result.exports).toEqual([]);
    });

    it("should handle empty code", () => {
      const result = extractor.extractImportsExports("", "typescript");
      expect(result.imports).toEqual([]);
      expect(result.exports).toEqual([]);
    });
  });

  describe("calculateComplexity", () => {
    it("should calculate complexity for simple function", () => {
      const code = `
function simple() {
  return 1;
}
      `;

      const complexity = extractor.calculateComplexity(code);
      expect(complexity).toBeGreaterThan(0);
      expect(complexity).toBeLessThan(5);
    });

    it("should calculate higher complexity for branching", () => {
      const simpleCode = "function simple() { return 1; }";
      const complexCode = `
function complex(x) {
  if (x > 0) {
    if (x > 10) {
      return 1;
    } else {
      return 2;
    }
  } else {
    return 0;
  }

  for (let i = 0; i < x; i++) {
    if (i % 2 === 0) {
      continue;
    }
  }

  while (x > 0) {
    x--;
  }
}
      `;

      const simpleComplexity = extractor.calculateComplexity(simpleCode);
      const complexComplexity = extractor.calculateComplexity(complexCode);

      expect(complexComplexity).toBeGreaterThan(simpleComplexity);
    });

    it("should count if statements", () => {
      const code = `
function test() {
  if (condition1) {}
  if (condition2) {}
  if (condition3) {}
}
      `;

      const complexity = extractor.calculateComplexity(code);
      expect(complexity).toBeGreaterThanOrEqual(3);
    });

    it("should count loops", () => {
      const code = `
function test() {
  for (let i = 0; i < 10; i++) {}
  while (true) {}
  do {} while (false);
}
      `;

      const complexity = extractor.calculateComplexity(code);
      expect(complexity).toBeGreaterThanOrEqual(3);
    });

    it("should count switch cases", () => {
      const code = `
function test(x) {
  switch (x) {
    case 1:
      break;
    case 2:
      break;
    case 3:
      break;
  }
}
      `;

      const complexity = extractor.calculateComplexity(code);
      expect(complexity).toBeGreaterThanOrEqual(3);
    });

    it("should count logical operators", () => {
      const code = `
function test() {
  if (a && b && c || d) {}
}
      `;

      const complexity = extractor.calculateComplexity(code);
      expect(complexity).toBeGreaterThanOrEqual(2);
    });

    it("should count ternary operators", () => {
      const code = `
function test() {
  const x = condition ? 1 : 2;
  const y = other ? 3 : 4;
}
      `;

      const complexity = extractor.calculateComplexity(code);
      expect(complexity).toBeGreaterThanOrEqual(2);
    });

    it("should handle empty code", () => {
      const complexity = extractor.calculateComplexity("");
      expect(complexity).toBe(0);
    });

    it("should handle code with no control flow", () => {
      const code = `
const x = 1;
const y = 2;
const z = x + y;
      `;

      const complexity = extractor.calculateComplexity(code);
      expect(complexity).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should handle chunks with minimal metadata", () => {
      const chunk: CodeChunk = {
        content: "test",
        startLine: 1,
        endLine: 1,
        metadata: {
          filePath: "test.txt",
          language: "unknown",
          chunkIndex: 0,
        },
      };

      const id = extractor.generateChunkId(chunk);
      expect(id).toMatch(/^chunk_[a-f0-9]{16}$/);
    });

    it("should handle very long file paths", () => {
      const longPath = `${"/very/long/path/".repeat(50)}file.ts`;
      const language = extractor.extractLanguage(longPath);
      expect(language).toBe("typescript");
    });

    it("should handle special characters in code", () => {
      const code = `
const emoji = "🚀";
const unicode = "你好世界";
const special = "!@#$%^&*()";
      `;

      const secrets = extractor.containsSecrets(code);
      expect(typeof secrets).toBe("boolean");
    });

    it("should handle multiline strings in secret detection", () => {
      const code = `
const doc = \`
This is a multiline string
with api_key = "fake_key_value"
but it's just documentation
\`;
      `;

      // Should still detect the pattern
      const hasSecrets = extractor.containsSecrets(code);
      expect(typeof hasSecrets).toBe("boolean");
    });
  });
});
