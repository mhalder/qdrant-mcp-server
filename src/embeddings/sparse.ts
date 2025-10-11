/**
 * BM25 Sparse Vector Generator
 *
 * This module provides a simple BM25-like sparse vector generation for keyword search.
 * For production use, consider using a proper BM25 implementation or Qdrant's built-in
 * sparse vector generation via FastEmbed.
 */

import type { SparseVector } from "../qdrant/client.js";

interface TokenFrequency {
  [token: string]: number;
}

export class BM25SparseVectorGenerator {
  private vocabulary: Map<string, number>;
  private idfScores: Map<string, number>;
  private documentCount: number;
  private k1: number;
  private b: number;

  constructor(k1: number = 1.2, b: number = 0.75) {
    this.vocabulary = new Map();
    this.idfScores = new Map();
    this.documentCount = 0;
    this.k1 = k1;
    this.b = b;
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
   * In a simple implementation, we can skip this and use on-the-fly vocabulary
   */
  train(documents: string[]): void {
    this.documentCount = documents.length;
    const documentFrequency = new Map<string, number>();

    // Calculate document frequency for each term
    for (const doc of documents) {
      const tokens = this.tokenize(doc);
      const uniqueTokens = new Set(tokens);

      for (const token of uniqueTokens) {
        if (!this.vocabulary.has(token)) {
          this.vocabulary.set(token, this.vocabulary.size);
        }
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

    const indices: number[] = [];
    const values: number[] = [];

    // Calculate BM25 score for each term
    for (const [token, freq] of Object.entries(tf)) {
      // Ensure token is in vocabulary
      if (!this.vocabulary.has(token)) {
        // For unseen tokens, add them to vocabulary dynamically
        this.vocabulary.set(token, this.vocabulary.size);
      }

      const index = this.vocabulary.get(token)!;

      // Use a default IDF if not trained
      const idf = this.idfScores.get(token) || 1.0;

      // BM25 formula
      const numerator = freq * (this.k1 + 1);
      const denominator = freq + this.k1 * (1 - this.b + this.b * (docLength / avgDocLength));
      const score = idf * (numerator / denominator);

      if (score > 0) {
        indices.push(index);
        values.push(score);
      }
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
