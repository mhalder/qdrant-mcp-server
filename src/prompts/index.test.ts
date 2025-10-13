import { describe, expect, it } from "vitest";
import * as PromptsModule from "./index.js";

describe("prompts module exports", () => {
  it("should export loadPromptsConfig function", () => {
    expect(PromptsModule.loadPromptsConfig).toBeDefined();
    expect(typeof PromptsModule.loadPromptsConfig).toBe("function");
  });

  it("should export getPrompt function", () => {
    expect(PromptsModule.getPrompt).toBeDefined();
    expect(typeof PromptsModule.getPrompt).toBe("function");
  });

  it("should export listPrompts function", () => {
    expect(PromptsModule.listPrompts).toBeDefined();
    expect(typeof PromptsModule.listPrompts).toBe("function");
  });

  it("should export renderTemplate function", () => {
    expect(PromptsModule.renderTemplate).toBeDefined();
    expect(typeof PromptsModule.renderTemplate).toBe("function");
  });

  it("should export validateArguments function", () => {
    expect(PromptsModule.validateArguments).toBeDefined();
    expect(typeof PromptsModule.validateArguments).toBe("function");
  });
});
