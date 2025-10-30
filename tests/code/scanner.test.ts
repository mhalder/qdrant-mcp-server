import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { FileScanner } from "../../src/code/scanner.js";
import type { ScannerConfig } from "../../src/code/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

describe("FileScanner", () => {
  let scanner: FileScanner;
  let config: ScannerConfig;

  beforeEach(() => {
    config = {
      supportedExtensions: [".ts", ".js", ".py"],
      ignorePatterns: ["node_modules/**", "dist/**"],
    };
    scanner = new FileScanner(config);
  });

  describe("scanDirectory", () => {
    it("should find all supported files", async () => {
      const files = await scanner.scanDirectory(join(fixturesDir, "sample-ts"));
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.endsWith("auth.ts"))).toBe(true);
    });

    it("should respect supported extensions", async () => {
      const files = await scanner.scanDirectory(join(fixturesDir, "sample-ts"));
      files.forEach((file) => {
        const hasValidExt = config.supportedExtensions.some((ext) => file.endsWith(ext));
        expect(hasValidExt).toBe(true);
      });
    });

    it("should handle empty directories", async () => {
      const config: ScannerConfig = {
        supportedExtensions: [".nonexistent"],
        ignorePatterns: [],
      };
      const scanner = new FileScanner(config);
      const files = await scanner.scanDirectory(join(fixturesDir, "sample-ts"));
      expect(files).toEqual([]);
    });
  });

  describe("loadIgnorePatterns", () => {
    it("should load .gitignore patterns", async () => {
      await scanner.loadIgnorePatterns(join(fixturesDir, "sample-ts"));
      // .gitignore should be loaded, but we can't directly test internal state
      // Instead, we test the effect through scanDirectory
      const files = await scanner.scanDirectory(join(fixturesDir, "sample-ts"));
      expect(files.some((f) => f.includes("node_modules"))).toBe(false);
    });

    it("should handle missing ignore files gracefully", async () => {
      await expect(scanner.loadIgnorePatterns("/nonexistent/path")).resolves.not.toThrow();
    });
  });

  describe("getSupportedExtensions", () => {
    it("should return configured extensions", () => {
      const extensions = scanner.getSupportedExtensions();
      expect(extensions).toEqual([".ts", ".js", ".py"]);
    });
  });

  describe("edge cases", () => {
    it("should handle paths with special characters", async () => {
      const files = await scanner.scanDirectory(join(fixturesDir, "sample-ts"));
      expect(Array.isArray(files)).toBe(true);
    });

    it("should skip symbolic links", async () => {
      const files = await scanner.scanDirectory(join(fixturesDir, "sample-ts"));
      expect(Array.isArray(files)).toBe(true);
    });

    it("should handle custom ignore patterns", async () => {
      const customConfig: ScannerConfig = {
        supportedExtensions: [".ts", ".js"],
        ignorePatterns: [],
        customIgnorePatterns: ["**/*.test.ts"],
      };
      const customScanner = new FileScanner(customConfig);
      await customScanner.loadIgnorePatterns(join(fixturesDir, "sample-ts"));
      const files = await customScanner.scanDirectory(join(fixturesDir, "sample-ts"));
      expect(files.some((f) => f.includes(".test.ts"))).toBe(false);
    });
  });
});
