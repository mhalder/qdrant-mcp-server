/**
 * Base interface for code chunkers
 */

import { CodeChunk } from '../types.js';

export interface CodeChunker {
  /**
   * Split code into semantic chunks
   */
  chunk(
    code: string,
    filePath: string,
    language: string
  ): Promise<CodeChunk[]>;

  /**
   * Check if language is supported by this chunker
   */
  supportsLanguage(language: string): boolean;

  /**
   * Get chunking strategy name
   */
  getStrategyName(): string;
}
