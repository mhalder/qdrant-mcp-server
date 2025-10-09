#!/usr/bin/env node

/**
 * Provider Verification Script
 *
 * This script verifies that all embedding providers can be instantiated
 * correctly and that the factory pattern works as expected.
 */

import { EmbeddingProviderFactory } from "../build/embeddings/factory.js";

console.log("=".repeat(60));
console.log("QDRANT MCP SERVER - PROVIDER VERIFICATION");
console.log("=".repeat(60));
console.log();

const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    results.passed++;
    results.tests.push({ name, status: "PASS" });
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: "FAIL", error: error.message });
  }
}

console.log("Testing Provider Factory...\n");

// Test 1: Factory should reject unknown providers
test("Factory rejects unknown provider", () => {
  try {
    EmbeddingProviderFactory.create({
      provider: "unknown-provider",
      apiKey: "test-key",
    });
    throw new Error("Should have thrown error for unknown provider");
  } catch (error) {
    if (!error.message.includes("Unknown embedding provider")) {
      throw error;
    }
  }
});

// Test 2: OpenAI provider requires API key
test("OpenAI provider requires API key", () => {
  try {
    EmbeddingProviderFactory.create({
      provider: "openai",
    });
    throw new Error("Should have thrown error for missing API key");
  } catch (error) {
    if (!error.message.includes("API key is required")) {
      throw error;
    }
  }
});

// Test 3: Cohere provider requires API key
test("Cohere provider requires API key", () => {
  try {
    EmbeddingProviderFactory.create({
      provider: "cohere",
    });
    throw new Error("Should have thrown error for missing API key");
  } catch (error) {
    if (!error.message.includes("API key is required")) {
      throw error;
    }
  }
});

// Test 4: Voyage AI provider requires API key
test("Voyage AI provider requires API key", () => {
  try {
    EmbeddingProviderFactory.create({
      provider: "voyage",
    });
    throw new Error("Should have thrown error for missing API key");
  } catch (error) {
    if (!error.message.includes("API key is required")) {
      throw error;
    }
  }
});

// Test 5: Ollama provider does NOT require API key
test("Ollama provider does not require API key", () => {
  const provider = EmbeddingProviderFactory.create({
    provider: "ollama",
  });
  if (!provider) {
    throw new Error("Failed to create Ollama provider");
  }
  if (provider.getModel() !== "nomic-embed-text") {
    throw new Error(
      `Expected default model 'nomic-embed-text', got '${provider.getModel()}'`,
    );
  }
  if (provider.getDimensions() !== 768) {
    throw new Error(
      `Expected default dimensions 768, got ${provider.getDimensions()}`,
    );
  }
});

// Test 6: OpenAI provider with valid config
test("OpenAI provider instantiates with API key", () => {
  const provider = EmbeddingProviderFactory.create({
    provider: "openai",
    apiKey: "test-key-123",
  });
  if (!provider) {
    throw new Error("Failed to create OpenAI provider");
  }
  if (provider.getModel() !== "text-embedding-3-small") {
    throw new Error(
      `Expected default model 'text-embedding-3-small', got '${provider.getModel()}'`,
    );
  }
  if (provider.getDimensions() !== 1536) {
    throw new Error(
      `Expected default dimensions 1536, got ${provider.getDimensions()}`,
    );
  }
});

// Test 7: Cohere provider with valid config
test("Cohere provider instantiates with API key", () => {
  const provider = EmbeddingProviderFactory.create({
    provider: "cohere",
    apiKey: "test-key-123",
  });
  if (!provider) {
    throw new Error("Failed to create Cohere provider");
  }
  if (provider.getModel() !== "embed-english-v3.0") {
    throw new Error(
      `Expected default model 'embed-english-v3.0', got '${provider.getModel()}'`,
    );
  }
  if (provider.getDimensions() !== 1024) {
    throw new Error(
      `Expected default dimensions 1024, got ${provider.getDimensions()}`,
    );
  }
});

// Test 8: Voyage AI provider with valid config
test("Voyage AI provider instantiates with API key", () => {
  const provider = EmbeddingProviderFactory.create({
    provider: "voyage",
    apiKey: "test-key-123",
  });
  if (!provider) {
    throw new Error("Failed to create Voyage AI provider");
  }
  if (provider.getModel() !== "voyage-2") {
    throw new Error(
      `Expected default model 'voyage-2', got '${provider.getModel()}'`,
    );
  }
  if (provider.getDimensions() !== 1024) {
    throw new Error(
      `Expected default dimensions 1024, got ${provider.getDimensions()}`,
    );
  }
});

// Test 9: Custom model configuration
test("Custom model configuration works", () => {
  const provider = EmbeddingProviderFactory.create({
    provider: "openai",
    apiKey: "test-key-123",
    model: "text-embedding-3-large",
  });
  if (provider.getModel() !== "text-embedding-3-large") {
    throw new Error(
      `Expected model 'text-embedding-3-large', got '${provider.getModel()}'`,
    );
  }
  if (provider.getDimensions() !== 3072) {
    throw new Error(
      `Expected dimensions 3072 for large model, got ${provider.getDimensions()}`,
    );
  }
});

// Test 10: Custom dimensions override
test("Custom dimensions override works", () => {
  const provider = EmbeddingProviderFactory.create({
    provider: "openai",
    apiKey: "test-key-123",
    dimensions: 512,
  });
  if (provider.getDimensions() !== 512) {
    throw new Error(
      `Expected custom dimensions 512, got ${provider.getDimensions()}`,
    );
  }
});

console.log();
console.log("=".repeat(60));
console.log("RESULTS");
console.log("=".repeat(60));
console.log(`Total Tests: ${results.passed + results.failed}`);
console.log(`Passed: ${results.passed} ✅`);
console.log(`Failed: ${results.failed} ${results.failed > 0 ? "❌" : ""}`);
console.log(
  `Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`,
);
console.log("=".repeat(60));

if (results.failed > 0) {
  console.log();
  console.log("Failed Tests:");
  results.tests
    .filter((t) => t.status === "FAIL")
    .forEach((t) => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
  process.exit(1);
} else {
  console.log();
  console.log("✅ All provider instantiation tests passed!");
  console.log("Multi-provider architecture is working correctly.");
  process.exit(0);
}
