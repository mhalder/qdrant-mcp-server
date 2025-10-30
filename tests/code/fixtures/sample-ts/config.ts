/**
 * Configuration constants and settings
 */

export const API_VERSION = "v1";
export const API_BASE_URL = "https://api.example.com";
export const TIMEOUT = 5000;
export const MAX_RETRIES = 3;

export enum Environment {
  Development = "development",
  Staging = "staging",
  Production = "production",
}

export const CONFIG = {
  api: {
    baseUrl: API_BASE_URL,
    version: API_VERSION,
    timeout: TIMEOUT,
  },
  features: {
    analytics: true,
    darkMode: true,
    notifications: false,
  },
  limits: {
    maxUploadSize: 10 * 1024 * 1024, // 10MB
    maxRequests: 100,
    rateWindow: 60000, // 1 minute
  },
} as const;

export type AppConfig = typeof CONFIG;

export class ConfigManager {
  private config: Partial<AppConfig> = {};

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return (this.config[key] || CONFIG[key]) as AppConfig[K];
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
  }

  reset(): void {
    this.config = {};
  }
}

export { Environment as Env };
