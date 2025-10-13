import { describe, expect, it } from "vitest";
import { renderTemplate, validateArguments } from "./template.js";
import type { PromptArgument } from "./types.js";

describe("renderTemplate", () => {
  it("should render template with provided arguments", () => {
    const template = "Search {{collection}} for {{query}}";
    const args = { collection: "papers", query: "machine learning" };
    const result = renderTemplate(template, args);

    expect(result.text).toBe("Search papers for machine learning");
  });

  it("should handle multiple occurrences of the same variable", () => {
    const template = "{{name}} said hello. {{name}} said goodbye.";
    const args = { name: "Alice" };
    const result = renderTemplate(template, args);

    expect(result.text).toBe("Alice said hello. Alice said goodbye.");
  });

  it("should use default values for missing arguments", () => {
    const template = "Return {{limit}} results";
    const args = {};
    const definitions: PromptArgument[] = [
      { name: "limit", description: "Number of results", required: false, default: "5" },
    ];
    const result = renderTemplate(template, args, definitions);

    expect(result.text).toBe("Return 5 results");
  });

  it("should prefer provided arguments over defaults", () => {
    const template = "Return {{limit}} results";
    const args = { limit: "10" };
    const definitions: PromptArgument[] = [
      { name: "limit", description: "Number of results", required: false, default: "5" },
    ];
    const result = renderTemplate(template, args, definitions);

    expect(result.text).toBe("Return 10 results");
  });

  it("should keep placeholder if no value and no default", () => {
    const template = "Search {{collection}} for {{query}}";
    const args = { collection: "papers" };
    const result = renderTemplate(template, args);

    expect(result.text).toBe("Search papers for {{query}}");
  });

  it("should handle templates with no placeholders", () => {
    const template = "This is a plain text template";
    const args = { foo: "bar" };
    const result = renderTemplate(template, args);

    expect(result.text).toBe("This is a plain text template");
  });

  it("should handle empty template", () => {
    const template = "";
    const args = { foo: "bar" };
    const result = renderTemplate(template, args);

    expect(result.text).toBe("");
  });

  it("should handle empty args", () => {
    const template = "Search {{collection}}";
    const result = renderTemplate(template);

    expect(result.text).toBe("Search {{collection}}");
  });

  it("should handle complex template with multiple variables and defaults", () => {
    const template =
      "Search the '{{collection}}' collection for documents similar to: '{{query}}'. Return the top {{limit}} most relevant results.";
    const args = { collection: "papers", query: "neural networks" };
    const definitions: PromptArgument[] = [
      { name: "collection", description: "Collection name", required: true },
      { name: "query", description: "Search query", required: true },
      { name: "limit", description: "Number of results", required: false, default: "5" },
    ];
    const result = renderTemplate(template, args, definitions);

    expect(result.text).toBe(
      "Search the 'papers' collection for documents similar to: 'neural networks'. Return the top 5 most relevant results."
    );
  });

  it("should handle special characters in argument values", () => {
    const template = "Query: {{query}}";
    const args = { query: "What is $100 + $200?" };
    const result = renderTemplate(template, args);

    expect(result.text).toBe("Query: What is $100 + $200?");
  });

  it("should handle numeric-like values as strings", () => {
    const template = "ID: {{id}}, Count: {{count}}";
    const args = { id: "123", count: "456" };
    const result = renderTemplate(template, args);

    expect(result.text).toBe("ID: 123, Count: 456");
  });

  it("should handle whitespace in variable names", () => {
    const template = "Value: {{key}}";
    const args = { key: "  spaced  " };
    const result = renderTemplate(template, args);

    expect(result.text).toBe("Value:   spaced  ");
  });

  it("should not match invalid placeholder patterns", () => {
    const template = "{{ invalid }} {missing} {{also invalid}} {{valid}}";
    const args = { valid: "yes" };
    const result = renderTemplate(template, args);

    // Only {{valid}} should be replaced, others don't match \w+ pattern
    expect(result.text).toBe("{{ invalid }} {missing} {{also invalid}} yes");
  });
});

describe("validateArguments", () => {
  it("should pass validation when all required arguments are provided", () => {
    const args = { collection: "papers", query: "test" };
    const definitions: PromptArgument[] = [
      { name: "collection", description: "Collection name", required: true },
      { name: "query", description: "Search query", required: true },
    ];

    expect(() => validateArguments(args, definitions)).not.toThrow();
  });

  it("should throw error when required argument is missing", () => {
    const args = { collection: "papers" };
    const definitions: PromptArgument[] = [
      { name: "collection", description: "Collection name", required: true },
      { name: "query", description: "Search query", required: true },
    ];

    expect(() => validateArguments(args, definitions)).toThrow("Missing required arguments: query");
  });

  it("should throw error when required argument is empty string", () => {
    const args = { collection: "papers", query: "" };
    const definitions: PromptArgument[] = [
      { name: "collection", description: "Collection name", required: true },
      { name: "query", description: "Search query", required: true },
    ];

    expect(() => validateArguments(args, definitions)).toThrow("Missing required arguments: query");
  });

  it("should throw error listing multiple missing arguments", () => {
    const args = {};
    const definitions: PromptArgument[] = [
      { name: "collection", description: "Collection name", required: true },
      { name: "query", description: "Search query", required: true },
      { name: "filter", description: "Filter", required: true },
    ];

    expect(() => validateArguments(args, definitions)).toThrow(
      "Missing required arguments: collection, query, filter"
    );
  });

  it("should not throw for missing optional arguments", () => {
    const args = { collection: "papers", query: "test" };
    const definitions: PromptArgument[] = [
      { name: "collection", description: "Collection name", required: true },
      { name: "query", description: "Search query", required: true },
      { name: "limit", description: "Limit", required: false, default: "5" },
    ];

    expect(() => validateArguments(args, definitions)).not.toThrow();
  });

  it("should pass validation with empty definitions", () => {
    const args = { foo: "bar" };
    const definitions: PromptArgument[] = [];

    expect(() => validateArguments(args, definitions)).not.toThrow();
  });

  it("should pass validation with no definitions", () => {
    const args = { foo: "bar" };

    expect(() => validateArguments(args, [])).not.toThrow();
  });

  it("should not require arguments that are not defined", () => {
    const args = { collection: "papers", extra: "data" };
    const definitions: PromptArgument[] = [
      { name: "collection", description: "Collection name", required: true },
    ];

    expect(() => validateArguments(args, definitions)).not.toThrow();
  });

  it("should handle mixed required and optional arguments", () => {
    const args = { name: "test" };
    const definitions: PromptArgument[] = [
      { name: "name", description: "Name", required: true },
      { name: "limit", description: "Limit", required: false },
      { name: "filter", description: "Filter", required: false },
    ];

    expect(() => validateArguments(args, definitions)).not.toThrow();
  });
});
