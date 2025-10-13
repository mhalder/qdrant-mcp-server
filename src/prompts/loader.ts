/**
 * Prompt configuration loader
 */

import { readFileSync } from "node:fs";
import { z } from "zod";
import type { PromptDefinition, PromptsConfig } from "./types.js";

// Zod schema for validation
const PromptArgumentSchema = z.object({
  name: z.string().min(1, "Argument name is required"),
  description: z.string().min(1, "Argument description is required"),
  required: z.boolean(),
  default: z.string().optional(),
});

const PromptDefinitionSchema = z.object({
  name: z
    .string()
    .min(1, "Prompt name is required")
    .regex(/^[a-z_][a-z0-9_]*$/, {
      message: "Prompt name must be lowercase letters, numbers, and underscores only",
    }),
  description: z.string().min(1, "Prompt description is required"),
  arguments: z.array(PromptArgumentSchema),
  template: z.string().min(1, "Prompt template is required"),
});

const PromptsConfigSchema = z.object({
  prompts: z.array(PromptDefinitionSchema),
});

/**
 * Load and parse prompts configuration from a JSON file
 * @param filePath Path to the prompts configuration file
 * @returns Parsed prompts configuration
 * @throws Error if file cannot be read or parsed
 */
export function loadPromptsConfig(filePath: string): PromptsConfig {
  try {
    const content = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content);
    const validated = PromptsConfigSchema.parse(parsed);

    // Validate unique prompt names
    const names = new Set<string>();
    for (const prompt of validated.prompts) {
      if (names.has(prompt.name)) {
        throw new Error(`Duplicate prompt name: ${prompt.name}`);
      }
      names.add(prompt.name);

      // Validate unique argument names within each prompt
      const argNames = new Set<string>();
      for (const arg of prompt.arguments) {
        if (argNames.has(arg.name)) {
          throw new Error(`Duplicate argument name in prompt "${prompt.name}": ${arg.name}`);
        }
        argNames.add(arg.name);
      }
    }

    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
      throw new Error(`Invalid prompts configuration:\n${issues.join("\n")}`);
    }
    throw error;
  }
}

/**
 * Get a specific prompt by name
 * @param config Prompts configuration
 * @param name Prompt name
 * @returns Prompt definition or undefined if not found
 */
export function getPrompt(config: PromptsConfig, name: string): PromptDefinition | undefined {
  return config.prompts.find((p) => p.name === name);
}

/**
 * List all available prompts
 * @param config Prompts configuration
 * @returns Array of prompt definitions
 */
export function listPrompts(config: PromptsConfig): PromptDefinition[] {
  return config.prompts;
}
