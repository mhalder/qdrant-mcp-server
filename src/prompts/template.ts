/**
 * Simple template rendering engine for prompts
 */

import type { PromptArgument, RenderedPrompt } from "./types.js";

/**
 * Render a template string by replacing {{variable}} placeholders with actual values
 * @param template Template string with {{variable}} placeholders
 * @param args Record of argument values
 * @param definitions Argument definitions with defaults
 * @returns Rendered template
 */
export function renderTemplate(
  template: string,
  args: Record<string, string> = {},
  definitions: PromptArgument[] = []
): RenderedPrompt {
  let rendered = template;

  // Create a map of defaults
  const defaults = new Map<string, string>();
  for (const def of definitions) {
    if (def.default !== undefined) {
      defaults.set(def.name, def.default);
    }
  }

  // Replace all {{variable}} placeholders
  rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    // Check if value is provided in args
    if (args[varName] !== undefined) {
      return args[varName];
    }

    // Check if there's a default value
    if (defaults.has(varName)) {
      return defaults.get(varName)!;
    }

    // If no value and no default, keep the placeholder
    return match;
  });

  return { text: rendered };
}

/**
 * Validate that all required arguments are provided
 * @param args Provided arguments
 * @param definitions Argument definitions
 * @throws Error if required arguments are missing
 */
export function validateArguments(
  args: Record<string, string>,
  definitions: PromptArgument[]
): void {
  const missing: string[] = [];

  for (const def of definitions) {
    if (def.required && (args[def.name] === undefined || args[def.name] === "")) {
      missing.push(def.name);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required arguments: ${missing.join(", ")}`);
  }
}
