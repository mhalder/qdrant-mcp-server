import { describe, expect, it } from "vitest";
import { BM25SparseVectorGenerator } from "./sparse.js";

describe("BM25SparseVectorGenerator", () => {
  it("should generate sparse vectors for simple text", () => {
    const generator = new BM25SparseVectorGenerator();
    const result = generator.generate("hello world");

    expect(result.indices).toBeDefined();
    expect(result.values).toBeDefined();
    expect(result.indices.length).toBeGreaterThan(0);
    expect(result.values.length).toBe(result.indices.length);
  });

  it("should generate different vectors for different texts", () => {
    const generator = new BM25SparseVectorGenerator();
    const result1 = generator.generate("hello world");
    const result2 = generator.generate("goodbye world");

    // Different texts should have different sparse representations
    expect(result1.indices).not.toEqual(result2.indices);
  });

  it("should generate consistent vectors for the same text", () => {
    const generator = new BM25SparseVectorGenerator();
    const result1 = generator.generate("hello world");
    const result2 = generator.generate("hello world");

    expect(result1.indices).toEqual(result2.indices);
    expect(result1.values).toEqual(result2.values);
  });

  it("should handle empty strings", () => {
    const generator = new BM25SparseVectorGenerator();
    const result = generator.generate("");

    expect(result.indices).toHaveLength(0);
    expect(result.values).toHaveLength(0);
  });

  it("should handle special characters and punctuation", () => {
    const generator = new BM25SparseVectorGenerator();
    const result = generator.generate("hello, world! how are you?");

    expect(result.indices).toBeDefined();
    expect(result.values).toBeDefined();
    expect(result.indices.length).toBeGreaterThan(0);
  });

  it("should train on corpus and generate IDF scores", () => {
    const generator = new BM25SparseVectorGenerator();
    const corpus = ["the quick brown fox", "jumps over the lazy dog", "the fox is quick"];

    generator.train(corpus);
    const result = generator.generate("quick fox");

    expect(result.indices).toBeDefined();
    expect(result.values).toBeDefined();
    expect(result.indices.length).toBeGreaterThan(0);
  });

  it("should use static generateSimple method", () => {
    const result = BM25SparseVectorGenerator.generateSimple("hello world");

    expect(result.indices).toBeDefined();
    expect(result.values).toBeDefined();
    expect(result.indices.length).toBeGreaterThan(0);
  });

  it("should lowercase and tokenize text properly", () => {
    const generator = new BM25SparseVectorGenerator();
    const result1 = generator.generate("HELLO WORLD");
    const result2 = generator.generate("hello world");

    // Should produce same results due to lowercasing
    expect(result1.indices).toEqual(result2.indices);
  });

  it("should generate positive values", () => {
    const generator = new BM25SparseVectorGenerator();
    const result = generator.generate("hello world");

    result.values.forEach((value) => {
      expect(value).toBeGreaterThan(0);
    });
  });

  it("should produce deterministic indices across separate generator instances", () => {
    // This is the core bug fix validation: two independent generators must
    // assign the same index to the same token, so index-time and query-time
    // sparse vectors are compatible.
    const generator1 = new BM25SparseVectorGenerator();
    const generator2 = new BM25SparseVectorGenerator();

    const result1 = generator1.generate("hello world");
    const result2 = generator2.generate("hello world");

    expect(result1.indices).toEqual(result2.indices);
    expect(result1.values).toEqual(result2.values);
  });

  it("should produce matching indices when query tokens are a subset of indexed tokens", () => {
    // Simulates the real hybrid_search flow:
    // 1. Index generator processes multiple documents (builds vocabulary)
    // 2. Query generator is a fresh instance processing the query
    // The query token indices must match the document token indices.
    const indexGenerator = new BM25SparseVectorGenerator();
    indexGenerator.generate("the quick brown fox jumps over the lazy dog");
    indexGenerator.generate("machine learning is a subset of artificial intelligence");
    indexGenerator.generate("sparse vectors enable keyword search in qdrant");

    const queryGenerator = new BM25SparseVectorGenerator();
    const queryResult = queryGenerator.generate("quick fox");

    // Generate the same query with the index generator for comparison
    const indexQueryResult = indexGenerator.generate("quick fox");

    // Indices must be identical -- same tokens, same indices
    const querySorted = [...queryResult.indices].sort((a, b) => a - b);
    const indexSorted = [...indexQueryResult.indices].sort((a, b) => a - b);
    expect(querySorted).toEqual(indexSorted);
  });

  it("should map different tokens to different indices (within hash collision tolerance)", () => {
    const generator = new BM25SparseVectorGenerator();
    // Use a set of clearly distinct tokens
    const tokens = ["apple", "banana", "cherry", "dragon", "elephant",
      "flamingo", "giraffe", "helicopter", "igloo", "jungle"];

    const indices = new Set<number>();
    for (const token of tokens) {
      const result = generator.generate(token);
      // Each single-token text produces exactly one index
      expect(result.indices).toHaveLength(1);
      indices.add(result.indices[0]);
    }

    // With 10 tokens and a 1M-size vocabulary space, collisions should be essentially zero.
    expect(indices.size).toBe(tokens.length);
  });

  it("should generate indices within valid vocabulary range", () => {
    const generator = new BM25SparseVectorGenerator();
    const result = generator.generate("testing various words for index range validation");

    for (const index of result.indices) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(1_000_000);
    }
  });
});
