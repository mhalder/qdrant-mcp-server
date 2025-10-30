/**
 * Main entry point - demonstrates various export patterns
 */

// Export everything from a module
export * from "./auth.js";
// Named exports from other modules
export { AuthService, User } from "./auth.js";
// Re-export with alias
export { CONFIG, ConfigManager, Environment, Environment as Env } from "./config.js";
// Default export
export { ConnectionConfig, connect, Database, default, InMemoryDatabase } from "./database.js";
export { capitalize, debounce, isValidEmail, retry, slugify } from "./utils.js";
export { ValidationResult, Validator } from "./validator.js";

// Local exports
export const VERSION = "1.0.0";
export const APP_NAME = "Sample TypeScript App";

export function initializeApp(): void {
  console.log(`Initializing ${APP_NAME} v${VERSION}`);
}

// Named export class
export class Application {
  private initialized = false;

  async start(): Promise<void> {
    if (this.initialized) {
      throw new Error("Application already initialized");
    }
    initializeApp();
    this.initialized = true;
  }

  isRunning(): boolean {
    return this.initialized;
  }
}
