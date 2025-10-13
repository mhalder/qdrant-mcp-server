/**
 * Configuration types for MCP prompts
 */

/**
 * Argument definition for a prompt
 */
export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
  default?: string;
}

/**
 * Individual prompt definition
 */
export interface PromptDefinition {
  name: string;
  description: string;
  arguments: PromptArgument[];
  template: string;
}

/**
 * Root configuration structure
 */
export interface PromptsConfig {
  prompts: PromptDefinition[];
}

/**
 * Parsed template with resolved arguments
 */
export interface RenderedPrompt {
  text: string;
}
