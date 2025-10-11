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
});
