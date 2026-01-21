import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ShiftresetClient,
  ShiftresetApiError,
} from "../api/ShiftresetClient.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("ShiftresetClient", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("creates client without parameters", () => {
      const client = new ShiftresetClient();
      expect(client).toBeInstanceOf(ShiftresetClient);
    });

    it("accepts timeout option", () => {
      const client = new ShiftresetClient({ timeoutMs: 60000 });
      expect(client).toBeInstanceOf(ShiftresetClient);
    });
  });

  describe("check/lint - successful responses", () => {
    it("returns success with diagnostics array", async () => {
      const mockResponse = {
        diagnostics: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockResponse,
      });

      const client = new ShiftresetClient();
      const result = await client.check("test content");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.diagnostics).toEqual([]);
      }
    });

    it("returns success with lint errors in diagnostics", async () => {
      const mockResponse = {
        diagnostics: [
          {
            range: { start: { line: 4, character: 0 }, end: { line: 4, character: 10 } },
            severity: 1,
            code: "E001",
            source: "fanuc-tp",
            message: "Syntax error",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockResponse,
      });

      const client = new ShiftresetClient();
      const result = await client.check("invalid content");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.diagnostics).toHaveLength(1);
        expect(result.data.diagnostics[0].message).toBe("Syntax error");
      }
    });

    it("lint() is backward compatible wrapper for check()", async () => {
      const mockResponse = {
        diagnostics: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockResponse,
      });

      const client = new ShiftresetClient();
      const result = await client.lint("content");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.diagnostics).toEqual([]);
      }
    });
  });

  describe("format - successful responses", () => {
    it("returns formatted content as text", async () => {
      const formattedCode = `/PROG TEST
/MN
  1: J P[1] 100% FINE;
/END
`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "text/plain" }),
        text: async () => formattedCode,
      });

      const client = new ShiftresetClient();
      const result = await client.format("unformatted code");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe(formattedCode);
      }
    });
  });

  describe("compliance - successful responses", () => {
    it("returns compliance diagnostics", async () => {
      const mockResponse = {
        diagnostics: [
          {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
            severity: 2,
            code: "C001",
            source: "fanuc-tp-compliance",
            message: "Compliance violation",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockResponse,
      });

      const client = new ShiftresetClient();
      const result = await client.compliance("code");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.diagnostics).toHaveLength(1);
        expect(result.data.diagnostics[0].code).toBe("C001");
      }
    });

    it("accepts rule selection options", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ diagnostics: [] }),
      });

      const client = new ShiftresetClient();
      await client.compliance("code", {
        select: ["rule1", "rule2"],
        ignore: ["rule3"],
        severity: "error",
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      // URL encoding converts comma to %2C
      expect(url).toContain("select=rule1%2Crule2");
      expect(url).toContain("ignore=rule3");
      expect(url).toContain("severity=error");
    });
  });

  describe("error responses", () => {
    it("returns RATE_LIMITED error on 429", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      const client = new ShiftresetClient();
      const result = await client.check("content");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("RATE_LIMITED");
        expect(result.error.statusCode).toBe(429);
      }
    });

    it("returns SERVER_ERROR on 500", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const client = new ShiftresetClient();
      const result = await client.check("content");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("SERVER_ERROR");
        expect(result.error.statusCode).toBe(500);
      }
    });

    it("returns CLIENT_ERROR on 400", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      const client = new ShiftresetClient();
      const result = await client.check("content");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("CLIENT_ERROR");
        expect(result.error.statusCode).toBe(400);
      }
    });

    it("returns INVALID_RESPONSE on malformed JSON", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      });

      const client = new ShiftresetClient();
      const result = await client.check("content");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_RESPONSE");
        expect(result.error.message).toContain("Failed to parse");
      }
    });

    it("returns INVALID_RESPONSE on unexpected Content-Type", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/xml" }),
      });

      const client = new ShiftresetClient();
      const result = await client.check("content");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_RESPONSE");
        expect(result.error.message).toContain("Content-Type");
      }
    });
  });

  describe("network errors", () => {
    it("returns NETWORK_ERROR on fetch failure", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      const client = new ShiftresetClient();
      const result = await client.check("content");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NETWORK_ERROR");
      }
    });

    it("returns ABORTED error when request is aborted", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const client = new ShiftresetClient();
      const result = await client.check("content");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("ABORTED");
      }
    });
  });

  describe("request configuration", () => {
    it("sends content as POST body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ diagnostics: [] }),
      });

      const client = new ShiftresetClient();
      await client.check("my file content here");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("POST");
      expect(options.body).toBe("my file content here");
    });

    it("sets Content-Type header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ diagnostics: [] }),
      });

      const client = new ShiftresetClient();
      await client.check("content");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers["Content-Type"]).toBe("text/plain; charset=utf-8");
    });

    it("uses default base URL (shiftreset.run)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ diagnostics: [] }),
      });

      const client = new ShiftresetClient();
      await client.check("content");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("https://shiftreset.run/check");
    });

    it("sends lsp=true query parameter by default for check", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ diagnostics: [] }),
      });

      const client = new ShiftresetClient();
      await client.check("content");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("lsp=true");
    });

    it("sends fix=true when fix option is set", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ diagnostics: [] }),
      });

      const client = new ShiftresetClient();
      await client.check("content", { fix: true });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("fix=true");
    });

    it("sends fix_unsafe=true when fixUnsafe option is set", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ diagnostics: [] }),
      });

      const client = new ShiftresetClient();
      await client.check("content", { fixUnsafe: true });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("fix_unsafe=true");
    });

    it("calls /format endpoint for format()", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "text/plain" }),
        text: async () => "formatted",
      });

      const client = new ShiftresetClient();
      await client.format("content");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/format");
    });

    it("calls /compliance endpoint for compliance()", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ diagnostics: [] }),
      });

      const client = new ShiftresetClient();
      await client.compliance("content");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/compliance");
    });
  });

  describe("ShiftresetApiError", () => {
    it("is retriable for NETWORK_ERROR", () => {
      const error = new ShiftresetApiError("NETWORK_ERROR", "Network failed");
      expect(error.isRetriable).toBe(true);
    });

    it("is retriable for RATE_LIMITED", () => {
      const error = new ShiftresetApiError("RATE_LIMITED", "Rate limited");
      expect(error.isRetriable).toBe(true);
    });

    it("is retriable for SERVER_ERROR", () => {
      const error = new ShiftresetApiError("SERVER_ERROR", "Server error");
      expect(error.isRetriable).toBe(true);
    });

    it("is not retriable for INVALID_RESPONSE", () => {
      const error = new ShiftresetApiError("INVALID_RESPONSE", "Invalid response");
      expect(error.isRetriable).toBe(false);
    });

    it("is not retriable for ABORTED", () => {
      const error = new ShiftresetApiError("ABORTED", "Aborted");
      expect(error.isRetriable).toBe(false);
    });

    it("is not retriable for CLIENT_ERROR", () => {
      const error = new ShiftresetApiError("CLIENT_ERROR", "Client error");
      expect(error.isRetriable).toBe(false);
    });

    it("preserves error code and status code", () => {
      const error = new ShiftresetApiError("RATE_LIMITED", "Test error", {
        statusCode: 429,
      });
      expect(error.code).toBe("RATE_LIMITED");
      expect(error.statusCode).toBe(429);
      expect(error.name).toBe("ShiftresetApiError");
    });
  });
});
