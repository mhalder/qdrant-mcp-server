/**
 * MetadataExtractor - Extracts metadata from code chunks
 */

import { createHash } from "node:crypto";
import { extname } from "node:path";
import { LANGUAGE_MAP } from "./config.js";
import type { CodeChunk } from "./types.js";

export class MetadataExtractor {
  /**
   * Extract programming language from file path
   */
  extractLanguage(filePath: string): string {
    const ext = extname(filePath);
    return LANGUAGE_MAP[ext] || "unknown";
  }

  /**
   * Generate deterministic chunk ID based on content and location
   * Format: chunk_{sha256(path:start:end:content)[:16]}
   */
  generateChunkId(chunk: CodeChunk): string {
    const { metadata, startLine, endLine, content } = chunk;
    const combined = `${metadata.filePath}:${startLine}:${endLine}:${content}`;
    const hash = createHash("sha256").update(combined).digest("hex");
    return `chunk_${hash.substring(0, 16)}`;
  }

  /**
   * Calculate simple code complexity score (optional)
   * Based on: cyclomatic complexity indicators
   */
  calculateComplexity(code: string): number {
    if (!code || code.trim().length === 0) {
      return 0;
    }

    let complexity = 0;

    // Count control flow statements
    const controlFlowPatterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\b&&\b/g,
      /\b\|\|\b/g,
      /\?[^?]/g, // Ternary operator
    ];

    for (const pattern of controlFlowPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Detect potential secrets in code (basic pattern matching)
   */
  containsSecrets(code: string): boolean {
    const secretPatterns = [
      /api[_-]?key[_-]?=\s*['"][a-zA-Z0-9_-]{20,}['"]/i,
      /secret[_-]?=\s*['"][a-zA-Z0-9_-]{20,}['"]/i,
      /password[_-]?=\s*['"][^'"]{8,}['"]/i,
      /token[_-]?=\s*['"][a-zA-Z0-9_-]{20,}['"]/i,
      /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
      /sk_live_[a-zA-Z0-9]{24,}/, // Stripe secret key
      /AIza[0-9A-Za-z\\-_]{35}/, // Google API key
      /AKIA[0-9A-Z]{16}/, // AWS access key
    ];

    for (const pattern of secretPatterns) {
      if (pattern.test(code)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract imports/exports from code (basic regex-based)
   */
  extractImportsExports(
    code: string,
    language: string
  ): {
    imports: string[];
    exports: string[];
  } {
    const imports: string[] = [];
    const exports: string[] = [];

    if (language === "typescript" || language === "javascript") {
      // Extract imports
      const importMatches = code.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
      for (const match of importMatches) {
        imports.push(match[1]);
      }

      // Extract exports
      const exportMatches = code.matchAll(
        /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g
      );
      for (const match of exportMatches) {
        exports.push(match[1]);
      }
    } else if (language === "python") {
      // Extract imports
      const importMatches = code.matchAll(/(?:from\s+(\S+)\s+)?import\s+([^;\n]+)/g);
      for (const match of importMatches) {
        imports.push(match[1] || match[2]);
      }

      // Extract functions/classes (rough)
      const defMatches = code.matchAll(/^(?:def|class)\s+(\w+)/gm);
      for (const match of defMatches) {
        exports.push(match[1]);
      }
    }

    return { imports, exports };
  }
}
