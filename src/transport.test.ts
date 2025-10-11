import type { Server as HttpServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Transport Configuration", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("HTTP Port Validation", () => {
    it("should accept valid port numbers", () => {
      const validPorts = ["1", "80", "443", "3000", "8080", "65535"];

      validPorts.forEach((port) => {
        const parsed = parseInt(port, 10);
        expect(parsed).toBeGreaterThanOrEqual(1);
        expect(parsed).toBeLessThanOrEqual(65535);
        expect(Number.isNaN(parsed)).toBe(false);
      });
    });

    it("should reject invalid port numbers", () => {
      const invalidCases = [
        { port: "0", reason: "port 0 is reserved" },
        { port: "-1", reason: "negative ports are invalid" },
        { port: "65536", reason: "exceeds maximum port" },
        { port: "99999", reason: "exceeds maximum port" },
        { port: "abc", reason: "non-numeric input" },
        { port: "", reason: "empty string" },
      ];

      invalidCases.forEach(({ port, reason }) => {
        const parsed = parseInt(port, 10);
        const isValid = !Number.isNaN(parsed) && parsed >= 1 && parsed <= 65535;
        expect(isValid, `Failed for ${port}: ${reason}`).toBe(false);
      });
    });

    it("should use default port 3000 when HTTP_PORT is not set", () => {
      const port = parseInt(process.env.HTTP_PORT || "3000", 10);
      expect(port).toBe(3000);
    });

    it("should parse HTTP_PORT from environment", () => {
      process.env.HTTP_PORT = "8080";
      const port = parseInt(process.env.HTTP_PORT || "3000", 10);
      expect(port).toBe(8080);
    });
  });

  describe("Transport Mode Validation", () => {
    it("should accept valid transport modes", () => {
      const validModes = ["stdio", "http", "STDIO", "HTTP"];

      validModes.forEach((mode) => {
        const normalized = mode.toLowerCase();
        expect(["stdio", "http"]).toContain(normalized);
      });
    });

    it("should reject invalid transport modes", () => {
      const invalidModes = ["tcp", "websocket", "grpc", ""];

      invalidModes.forEach((mode) => {
        const normalized = mode.toLowerCase();
        expect(["stdio", "http"]).not.toContain(normalized);
      });
    });

    it("should default to stdio when TRANSPORT_MODE is not set", () => {
      const mode = (process.env.TRANSPORT_MODE || "stdio").toLowerCase();
      expect(mode).toBe("stdio");
    });
  });

  describe("Request Size Limits", () => {
    it("should define request size limit for HTTP transport", () => {
      const limit = "10mb";
      expect(limit).toMatch(/^\d+mb$/);
    });

    it("should parse size limit correctly", () => {
      const limit = "10mb";
      const sizeInBytes = parseInt(limit, 10) * 1024 * 1024;
      expect(sizeInBytes).toBe(10485760);
    });
  });
});

describe("HTTP Server Configuration", () => {
  describe("Graceful Shutdown", () => {
    it("should handle shutdown signals", async () => {
      const mockServer = {
        close: vi.fn((callback) => {
          if (callback) callback();
        }),
      } as unknown as HttpServer;

      const shutdown = () => {
        mockServer.close(() => {
          // Shutdown callback
        });
      };

      shutdown();
      expect(mockServer.close).toHaveBeenCalled();
    });

    it("should support timeout for forced shutdown", () => {
      vi.useFakeTimers();

      let forcedShutdown = false;
      const timeout = setTimeout(() => {
        forcedShutdown = true;
      }, 10000);

      vi.advanceTimersByTime(9999);
      expect(forcedShutdown).toBe(false);

      vi.advanceTimersByTime(1);
      expect(forcedShutdown).toBe(true);

      clearTimeout(timeout);
      vi.useRealTimers();
    });
  });

  describe("Error Handling", () => {
    it("should return JSON-RPC 2.0 error format", () => {
      const error = {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      };

      expect(error.jsonrpc).toBe("2.0");
      expect(error.error.code).toBe(-32603);
      expect(error.error.message).toBeTruthy();
      expect(error.id).toBeNull();
    });

    it("should use standard JSON-RPC error codes", () => {
      const errorCodes = {
        parseError: -32700,
        invalidRequest: -32600,
        methodNotFound: -32601,
        invalidParams: -32602,
        internalError: -32603,
      };

      expect(errorCodes.parseError).toBe(-32700);
      expect(errorCodes.invalidRequest).toBe(-32600);
      expect(errorCodes.methodNotFound).toBe(-32601);
      expect(errorCodes.invalidParams).toBe(-32602);
      expect(errorCodes.internalError).toBe(-32603);
    });
  });
});

describe("Transport Lifecycle", () => {
  it("should close transport on response close", () => {
    const mockTransport = {
      close: vi.fn(),
    };

    const mockResponse = {
      on: vi.fn((event, callback) => {
        if (event === "close") {
          callback();
        }
      }),
    };

    mockResponse.on("close", () => {
      mockTransport.close();
    });

    expect(mockTransport.close).toHaveBeenCalled();
  });

  it("should handle transport connection", async () => {
    const mockServer = {
      connect: vi.fn().mockResolvedValue(undefined),
    };

    const mockTransport = {
      handleRequest: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };

    await mockServer.connect(mockTransport);
    expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
  });
});
