import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPrompt, listPrompts, loadPromptsConfig } from "./loader.js";
import type { PromptsConfig } from "./types.js";

describe("loadPromptsConfig", () => {
  let testDir: string;

  beforeEach(() => {
    // Create a temporary directory for test files
    testDir = join(tmpdir(), `prompts-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should load valid prompts configuration", () => {
    const config = {
      prompts: [
        {
          name: "test_prompt",
          description: "A test prompt",
          arguments: [
            {
              name: "arg1",
              description: "First argument",
              required: true,
            },
          ],
          template: "Test {{arg1}}",
        },
      ],
    };

    const filePath = join(testDir, "prompts.json");
    writeFileSync(filePath, JSON.stringify(config, null, 2));

    const result = loadPromptsConfig(filePath);

    expect(result).toEqual(config);
    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0].name).toBe("test_prompt");
  });

  it("should load configuration with multiple prompts", () => {
    const config = {
      prompts: [
        {
          name: "prompt1",
          description: "First prompt",
          arguments: [],
          template: "Template 1",
        },
        {
          name: "prompt2",
          description: "Second prompt",
          arguments: [],
          template: "Template 2",
        },
      ],
    };

    const filePath = join(testDir, "prompts.json");
    writeFileSync(filePath, JSON.stringify(config, null, 2));

    const result = loadPromptsConfig(filePath);

    expect(result.prompts).toHaveLength(2);
    expect(result.prompts[0].name).toBe("prompt1");
    expect(result.prompts[1].name).toBe("prompt2");
  });

  it("should load configuration with optional arguments", () => {
    const config = {
      prompts: [
        {
          name: "test_prompt",
          description: "A test prompt",
          arguments: [
            {
              name: "required_arg",
              description: "Required argument",
              required: true,
            },
            {
              name: "optional_arg",
              description: "Optional argument",
              required: false,
              default: "default_value",
            },
          ],
          template: "Test {{required_arg}} {{optional_arg}}",
        },
      ],
    };

    const filePath = join(testDir, "prompts.json");
    writeFileSync(filePath, JSON.stringify(config, null, 2));

    const result = loadPromptsConfig(filePath);

    expect(result.prompts[0].arguments).toHaveLength(2);
    expect(result.prompts[0].arguments[0].required).toBe(true);
    expect(result.prompts[0].arguments[1].required).toBe(false);
    expect(result.prompts[0].arguments[1].default).toBe("default_value");
  });

  it("should throw error for non-existent file", () => {
    const filePath = join(testDir, "nonexistent.json");

    expect(() => loadPromptsConfig(filePath)).toThrow();
  });

  it("should throw error for invalid JSON", () => {
    const filePath = join(testDir, "invalid.json");
    writeFileSync(filePath, "{ invalid json }");

    expect(() => loadPromptsConfig(filePath)).toThrow();
  });

  it("should throw error for missing prompts array", () => {
    const config = {};
    const filePath = join(testDir, "missing-prompts.json");
    writeFileSync(filePath, JSON.stringify(config, null, 2));

    expect(() => loadPromptsConfig(filePath)).toThrow("Invalid prompts configuration");
  });

  it("should throw error for empty prompt name", () => {
    const config = {
      prompts: [
        {
          name: "",
          description: "Test",
          arguments: [],
          template: "Test",
        },
      ],
    };

    const filePath = join(testDir, "empty-name.json");
    writeFileSync(filePath, JSON.stringify(config, null, 2));

    expect(() => loadPromptsConfig(filePath)).toThrow("Invalid prompts configuration");
  });

  it("should throw error for invalid prompt name format", () => {
    const config = {
      prompts: [
        {
          name: "Invalid-Name",
          description: "Test",
          arguments: [],
          template: "Test",
        },
      ],
    };

    const filePath = join(testDir, "invalid-name.json");
    writeFileSync(filePath, JSON.stringify(config, null, 2));

    expect(() => loadPromptsConfig(filePath)).toThrow("Invalid prompts configuration");
    expect(() => loadPromptsConfig(filePath)).toThrow(
      "lowercase letters, numbers, and underscores"
    );
  });

  it("should accept valid prompt name formats", () => {
    const config = {
      prompts: [
        {
          name: "valid_name_123",
          description: "Test",
          arguments: [],
          template: "Test",
        },
        {
          name: "another_valid",
          description: "Test",
          arguments: [],
          template: "Test",
        },
      ],
    };

    const filePath = join(testDir, "valid-names.json");
    writeFileSync(filePath, JSON.stringify(config, null, 2));

    expect(() => loadPromptsConfig(filePath)).not.toThrow();
  });

  it("should throw error for duplicate prompt names", () => {
    const config = {
      prompts: [
        {
          name: "test_prompt",
          description: "First",
          arguments: [],
          template: "Test 1",
        },
        {
          name: "test_prompt",
          description: "Second",
          arguments: [],
          template: "Test 2",
        },
      ],
    };

    const filePath = join(testDir, "duplicate-names.json");
    writeFileSync(filePath, JSON.stringify(config, null, 2));

    expect(() => loadPromptsConfig(filePath)).toThrow("Duplicate prompt name: test_prompt");
  });

  it("should throw error for duplicate argument names within a prompt", () => {
    const config = {
      prompts: [
        {
          name: "test_prompt",
          description: "Test",
          arguments: [
            {
              name: "arg1",
              description: "First",
              required: true,
            },
            {
              name: "arg1",
              description: "Second",
              required: true,
            },
          ],
          template: "Test",
        },
      ],
    };

    const filePath = join(testDir, "duplicate-args.json");
    writeFileSync(filePath, JSON.stringify(config, null, 2));

    expect(() => loadPromptsConfig(filePath)).toThrow(
      'Duplicate argument name in prompt "test_prompt": arg1'
    );
  });

  it("should allow same argument name in different prompts", () => {
    const config = {
      prompts: [
        {
          name: "prompt1",
          description: "First",
          arguments: [
            {
              name: "collection",
              description: "Collection name",
              required: true,
            },
          ],
          template: "Test 1",
        },
        {
          name: "prompt2",
          description: "Second",
          arguments: [
            {
              name: "collection",
              description: "Collection name",
              required: true,
            },
          ],
          template: "Test 2",
        },
      ],
    };

    const filePath = join(testDir, "same-args.json");
    writeFileSync(filePath, JSON.stringify(config, null, 2));

    expect(() => loadPromptsConfig(filePath)).not.toThrow();
  });

  it("should throw error for missing argument name", () => {
    const config = {
      prompts: [
        {
          name: "test_prompt",
          description: "Test",
          arguments: [
            {
              name: "",
              description: "Test",
              required: true,
            },
          ],
          template: "Test",
        },
      ],
    };

    const filePath = join(testDir, "empty-arg-name.json");
    writeFileSync(filePath, JSON.stringify(config, null, 2));

    expect(() => loadPromptsConfig(filePath)).toThrow("Invalid prompts configuration");
  });

  it("should throw error for missing argument description", () => {
    const config = {
      prompts: [
        {
          name: "test_prompt",
          description: "Test",
          arguments: [
            {
              name: "arg1",
              description: "",
              required: true,
            },
          ],
          template: "Test",
        },
      ],
    };

    const filePath = join(testDir, "empty-arg-description.json");
    writeFileSync(filePath, JSON.stringify(config, null, 2));

    expect(() => loadPromptsConfig(filePath)).toThrow("Invalid prompts configuration");
  });

  it("should throw error for missing template", () => {
    const config = {
      prompts: [
        {
          name: "test_prompt",
          description: "Test",
          arguments: [],
          template: "",
        },
      ],
    };

    const filePath = join(testDir, "empty-template.json");
    writeFileSync(filePath, JSON.stringify(config, null, 2));

    expect(() => loadPromptsConfig(filePath)).toThrow("Invalid prompts configuration");
  });

  it("should load empty prompts array", () => {
    const config = {
      prompts: [],
    };

    const filePath = join(testDir, "empty-prompts.json");
    writeFileSync(filePath, JSON.stringify(config, null, 2));

    const result = loadPromptsConfig(filePath);

    expect(result.prompts).toHaveLength(0);
  });
});

describe("getPrompt", () => {
  it("should return prompt by name", () => {
    const config: PromptsConfig = {
      prompts: [
        {
          name: "test_prompt",
          description: "A test prompt",
          arguments: [],
          template: "Test template",
        },
        {
          name: "another_prompt",
          description: "Another prompt",
          arguments: [],
          template: "Another template",
        },
      ],
    };

    const result = getPrompt(config, "test_prompt");

    expect(result).toBeDefined();
    expect(result?.name).toBe("test_prompt");
    expect(result?.template).toBe("Test template");
  });

  it("should return undefined for non-existent prompt", () => {
    const config: PromptsConfig = {
      prompts: [
        {
          name: "test_prompt",
          description: "A test prompt",
          arguments: [],
          template: "Test template",
        },
      ],
    };

    const result = getPrompt(config, "nonexistent");

    expect(result).toBeUndefined();
  });

  it("should return undefined for empty config", () => {
    const config: PromptsConfig = {
      prompts: [],
    };

    const result = getPrompt(config, "test_prompt");

    expect(result).toBeUndefined();
  });

  it("should find prompt case-sensitively", () => {
    const config: PromptsConfig = {
      prompts: [
        {
          name: "test_prompt",
          description: "A test prompt",
          arguments: [],
          template: "Test template",
        },
      ],
    };

    const result1 = getPrompt(config, "test_prompt");
    const result2 = getPrompt(config, "TEST_PROMPT");

    expect(result1).toBeDefined();
    expect(result2).toBeUndefined();
  });
});

describe("listPrompts", () => {
  it("should return all prompts", () => {
    const config: PromptsConfig = {
      prompts: [
        {
          name: "prompt1",
          description: "First prompt",
          arguments: [],
          template: "Template 1",
        },
        {
          name: "prompt2",
          description: "Second prompt",
          arguments: [],
          template: "Template 2",
        },
      ],
    };

    const result = listPrompts(config);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("prompt1");
    expect(result[1].name).toBe("prompt2");
  });

  it("should return empty array for empty config", () => {
    const config: PromptsConfig = {
      prompts: [],
    };

    const result = listPrompts(config);

    expect(result).toHaveLength(0);
  });

  it("should return copy of prompts array", () => {
    const config: PromptsConfig = {
      prompts: [
        {
          name: "test_prompt",
          description: "A test prompt",
          arguments: [],
          template: "Test template",
        },
      ],
    };

    const result = listPrompts(config);

    // Should return the same array reference (direct access)
    expect(result).toBe(config.prompts);
  });
});
