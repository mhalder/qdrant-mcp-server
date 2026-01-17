/**
 * Prompt registration module for McpServer
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderTemplate, validateArguments } from "./template.js";
import type { PromptArgument, PromptsConfig } from "./types.js";

/**
 * Build a Zod schema object for prompt arguments
 */
function buildArgsSchema(args: PromptArgument[]): Record<string, z.ZodTypeAny> {
  const schema: Record<string, z.ZodTypeAny> = {};

  for (const arg of args) {
    const fieldSchema = z.string().describe(arg.description);
    schema[arg.name] = arg.required ? fieldSchema : fieldSchema.optional();
  }

  return schema;
}

/**
 * Register all prompts from configuration on the server
 */
export function registerAllPrompts(
  server: McpServer,
  config: PromptsConfig | null,
): void {
  if (!config) {
    return; // No prompts = no prompts capability
  }

  for (const prompt of config.prompts) {
    const argsSchema = buildArgsSchema(prompt.arguments);

    server.registerPrompt(
      prompt.name,
      {
        title: prompt.name,
        description: prompt.description,
        argsSchema,
      },
      (args) => {
        // Validate arguments
        const argsRecord = (args || {}) as Record<string, string>;
        validateArguments(argsRecord, prompt.arguments);

        // Render template
        const rendered = renderTemplate(
          prompt.template,
          argsRecord,
          prompt.arguments,
        );

        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: rendered.text,
              },
            },
          ],
        };
      },
    );
  }
}
