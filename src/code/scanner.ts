/**
 * FileScanner - Discovers code files in a directory while respecting ignore patterns
 */

import { promises as fs } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import ignore, { type Ignore } from "ignore";
import type { ScannerConfig } from "./types.js";

export class FileScanner {
  private ig: Ignore = ignore();
  private supportedExts: Set<string>;

  constructor(private config: ScannerConfig) {
    this.supportedExts = new Set(config.supportedExtensions);
  }

  /**
   * Load ignore patterns from .gitignore, .dockerignore, .npmignore, and .contextignore
   */
  async loadIgnorePatterns(rootPath: string): Promise<void> {
    const ignoreFiles = [".gitignore", ".dockerignore", ".npmignore", ".contextignore"];

    for (const ignoreFile of ignoreFiles) {
      const ignorePath = join(rootPath, ignoreFile);
      if (await this.fileExists(ignorePath)) {
        try {
          const content = await fs.readFile(ignorePath, "utf-8");
          this.ig.add(content);
        } catch (_error) {
          // Silently skip if file can't be read
        }
      }
    }

    // Add default patterns from config
    if (this.config.ignorePatterns && this.config.ignorePatterns.length > 0) {
      this.ig.add(this.config.ignorePatterns);
    }

    // Add custom patterns
    if (this.config.customIgnorePatterns && this.config.customIgnorePatterns.length > 0) {
      this.ig.add(this.config.customIgnorePatterns);
    }
  }

  /**
   * Scan directory recursively and return all code files
   */
  async scanDirectory(rootPath: string): Promise<string[]> {
    const absoluteRoot = resolve(rootPath);
    const files: string[] = [];

    await this.walkDirectory(absoluteRoot, absoluteRoot, files);

    return files;
  }

  /**
   * Check if a file should be ignored based on patterns
   */
  shouldIgnore(filePath: string, rootPath: string): boolean {
    const relativePath = relative(rootPath, filePath);
    return this.ig.ignores(relativePath);
  }

  /**
   * Get list of supported file extensions
   */
  getSupportedExtensions(): string[] {
    return Array.from(this.supportedExts);
  }

  /**
   * Recursively walk directory tree
   */
  private async walkDirectory(
    currentPath: string,
    rootPath: string,
    files: string[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);
        const relativePath = relative(rootPath, fullPath);

        // Skip ignored paths
        if (this.ig.ignores(relativePath)) {
          continue;
        }

        // Handle symbolic links safely to avoid infinite loops
        if (entry.isSymbolicLink()) {
          continue;
        }

        if (entry.isDirectory()) {
          await this.walkDirectory(fullPath, rootPath, files);
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (this.supportedExts.has(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (_error) {
      // Skip directories that can't be read (permission errors, etc.)
    }
  }

  /**
   * Check if a file exists
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}
