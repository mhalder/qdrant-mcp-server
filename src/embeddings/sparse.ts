/**
 * BM25 Sparse Vector Generator
 *
 * This module provides a simple BM25-like sparse vector generation for keyword search.
 * Uses deterministic hash-based vocabulary indices so that the same token always maps
 * to the same index, regardless of when or where the generator is instantiated.
 *
 * For production use, consider using a proper BM25 implementation or Qdrant's built-in
 * sparse vector generation via FastEmbed.
 */

import type { SparseVector } from "../qdrant/client.js";

interface TokenFrequency {
  [token: string]: number;
}

/**
 * Size of the hash-based vocabulary space.
 * Tokens are mapped to indices in [0, VOCAB_SIZE) via deterministic hashing.
 * 1M provides virtually zero hash collisions while adding no overhead
 * since sparse vectors only store non-zero (index, value) pairs.
 */
const VOCAB_SIZE = 1_000_000;

export class BM25SparseVectorGenerator {
  private idfScores: Map<string, number>;
  private documentCount: number;
  private k1: number;
  private b: number;

  constructor(k1: number = 1.2, b: number = 0.75) {
    this.idfScores = new Map();
    this.documentCount = 0;
    this.k1 = k1;
    this.b = b;
  }

  /**
   * Deterministically hash a token to a fixed vocabulary index.
   * The same token will always produce the same index, regardless of
   * generator instance or document processing order.
   */
  private hashToken(token: string): number {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % VOCAB_SIZE;
  }

  /**
   * Tokenize text into words (simple whitespace tokenization + lowercase)
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }

  /**
   * Calculate term frequency for a document
   */
  private getTermFrequency(tokens: string[]): TokenFrequency {
    const tf: TokenFrequency = {};
    for (const token of tokens) {
      tf[token] = (tf[token] || 0) + 1;
    }
    return tf;
  }

  /**
   * Build vocabulary from training documents (optional pre-training step)
   * Computes IDF scores for more accurate BM25 scoring.
   */
  train(documents: string[]): void {
    this.documentCount = documents.length;
    const documentFrequency = new Map<string, number>();

    // Calculate document frequency for each term
    for (const doc of documents) {
      const tokens = this.tokenize(doc);
      const uniqueTokens = new Set(tokens);

      for (const token of uniqueTokens) {
        documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
      }
    }

    // Calculate IDF scores
    for (const [token, df] of documentFrequency.entries()) {
      const idf = Math.log((this.documentCount - df + 0.5) / (df + 0.5) + 1.0);
      this.idfScores.set(token, idf);
    }
  }

  /**
   * Generate sparse vector for a query or document
   * Returns indices and values for non-zero dimensions
   */
  generate(text: string, avgDocLength: number = 50): SparseVector {
    const tokens = this.tokenize(text);
    const tf = this.getTermFrequency(tokens);
    const docLength = tokens.length;

    // Use a map to accumulate scores per index, handling potential hash collisions
    const indexScores = new Map<number, number>();

    // Calculate BM25 score for each term
    for (const [token, freq] of Object.entries(tf)) {
      const index = this.hashToken(token);

      // Use a default IDF if not trained
      const idf = this.idfScores.get(token) || 1.0;

      // BM25 formula
      const numerator = freq * (this.k1 + 1);
      const denominator = freq + this.k1 * (1 - this.b + this.b * (docLength / avgDocLength));
      const score = idf * (numerator / denominator);

      if (score > 0) {
        // Sum scores for colliding hash indices
        indexScores.set(index, (indexScores.get(index) || 0) + score);
      }
    }

    const indices: number[] = [];
    const values: number[] = [];
    for (const [index, score] of indexScores.entries()) {
      indices.push(index);
      values.push(score);
    }

    return { indices, values };
  }

  /**
   * Simple static method for generating sparse vectors without training
   * Useful for quick implementation
   */
  static generateSimple(text: string): SparseVector {
    const generator = new BM25SparseVectorGenerator();
    return generator.generate(text);
  }
}
