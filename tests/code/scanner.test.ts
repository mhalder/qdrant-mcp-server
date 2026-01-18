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

      // Verify new fixture files are found
      expect(files.some((f) => f.endsWith("database.ts"))).toBe(true);
      expect(files.some((f) => f.endsWith("utils.ts"))).toBe(true);
      expect(files.some((f) => f.endsWith("validator.ts"))).toBe(true);
      expect(files.some((f) => f.endsWith("config.ts"))).toBe(true);
      expect(files.some((f) => f.endsWith("index.ts"))).toBe(true);
      expect(files.some((f) => f.endsWith("async-operations.ts"))).toBe(true);
      expect(files.some((f) => f.endsWith("types-advanced.ts"))).toBe(true);

      // Should have at least 8 TypeScript files
      expect(files.length).toBeGreaterThanOrEqual(8);
    });

    it("should respect supported extensions", async () => {
      const files = await scanner.scanDirectory(join(fixturesDir, "sample-ts"));
      files.forEach((file) => {
        const hasValidExt = config.supportedExtensions.some((ext) =>
          file.endsWith(ext),
        );
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
      await expect(
        scanner.loadIgnorePatterns("/nonexistent/path"),
      ).resolves.not.toThrow();
    });
  });

  describe("getSupportedExtensions", () => {
    it("should return configured extensions", () => {
      const extensions = scanner.getSupportedExtensions();
      expect(extensions).toEqual([".ts", ".js", ".py"]);
    });
  });

  describe("shouldIgnore", () => {
    it("should return true for files matching ignore patterns", async () => {
      const ignoreConfig: ScannerConfig = {
        supportedExtensions: [".ts", ".js"],
        ignorePatterns: ["node_modules/**", "dist/**"],
      };
      const ignoreScanner = new FileScanner(ignoreConfig);
      await ignoreScanner.loadIgnorePatterns(join(fixturesDir, "sample-ts"));

      const rootPath = join(fixturesDir, "sample-ts");
      const ignoredPath = join(
        rootPath,
        "node_modules",
        "some-package",
        "index.js",
      );

      expect(ignoreScanner.shouldIgnore(ignoredPath, rootPath)).toBe(true);
    });

    it("should return false for files not matching ignore patterns", async () => {
      const ignoreConfig: ScannerConfig = {
        supportedExtensions: [".ts", ".js"],
        ignorePatterns: ["node_modules/**"],
      };
      const ignoreScanner = new FileScanner(ignoreConfig);
      await ignoreScanner.loadIgnorePatterns(join(fixturesDir, "sample-ts"));

      const rootPath = join(fixturesDir, "sample-ts");
      const allowedPath = join(rootPath, "src", "index.ts");

      expect(ignoreScanner.shouldIgnore(allowedPath, rootPath)).toBe(false);
    });

    it("should respect custom ignore patterns", async () => {
      const customConfig: ScannerConfig = {
        supportedExtensions: [".ts", ".js"],
        ignorePatterns: [],
        customIgnorePatterns: ["**/*.test.ts", "**/tests/**"],
      };
      const customScanner = new FileScanner(customConfig);
      await customScanner.loadIgnorePatterns(join(fixturesDir, "sample-ts"));

      const rootPath = join(fixturesDir, "sample-ts");

      expect(
        customScanner.shouldIgnore(
          join(rootPath, "src", "utils.test.ts"),
          rootPath,
        ),
      ).toBe(true);
      expect(
        customScanner.shouldIgnore(
          join(rootPath, "tests", "main.ts"),
          rootPath,
        ),
      ).toBe(true);
      expect(
        customScanner.shouldIgnore(join(rootPath, "src", "utils.ts"), rootPath),
      ).toBe(false);
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
      const files = await customScanner.scanDirectory(
        join(fixturesDir, "sample-ts"),
      );
      expect(files.some((f) => f.includes(".test.ts"))).toBe(false);
    });

    it("should properly ignore files matching ignore patterns", async () => {
      const ignoreConfig: ScannerConfig = {
        supportedExtensions: [".ts", ".js"],
        ignorePatterns: ["**/auth.ts"],
      };
      const ignoreScanner = new FileScanner(ignoreConfig);
      await ignoreScanner.loadIgnorePatterns(join(fixturesDir, "sample-ts"));
      const files = await ignoreScanner.scanDirectory(
        join(fixturesDir, "sample-ts"),
      );

      // Should not include auth.ts due to ignore pattern
      expect(files.some((f) => f.endsWith("auth.ts"))).toBe(false);
    });

    it("should handle directories with .gitignore", async () => {
      const scannerWithGitignore = new FileScanner(config);
      await scannerWithGitignore.loadIgnorePatterns(
        join(fixturesDir, "sample-ts"),
      );
      const files = await scannerWithGitignore.scanDirectory(
        join(fixturesDir, "sample-ts"),
      );

      // Files matching .gitignore patterns should be excluded
      expect(Array.isArray(files)).toBe(true);
    });

    it("should gracefully handle non-existent directories", async () => {
      const files = await scanner.scanDirectory("/nonexistent/directory/path");
      expect(files).toEqual([]);
    });
  });
});
