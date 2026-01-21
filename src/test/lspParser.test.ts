import { describe, it, expect } from "vitest";
import { parseLspResponse } from "../lsp/lspParser.js";
import type { LspDiagnostic, LspDiagnosticResponse } from "../api/ShiftresetClient.js";

describe("parseLspResponse", () => {
  describe("parsing LSP diagnostic JSON", () => {
    it("parses valid JSON with diagnostics array", () => {
      const response: LspDiagnosticResponse = {
        diagnostics: [
          {
            range: { start: { line: 24, character: 0 }, end: { line: 24, character: 10 } },
            severity: 1,
            message: "[E091] Unexpected end of file",
          },
        ],
      };
      const result = parseLspResponse(JSON.stringify(response));

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toEqual<LspDiagnostic>({
        range: { start: { line: 24, character: 0 }, end: { line: 24, character: 10 } },
        severity: 1,
        message: "[E091] Unexpected end of file",
      });
    });

    it("parses multiple diagnostics", () => {
      const response: LspDiagnosticResponse = {
        diagnostics: [
          {
            range: { start: { line: 24, character: 0 }, end: { line: 24, character: 10 } },
            severity: 1,
            message: "[E091] Unexpected end of file",
          },
          {
            range: { start: { line: 7, character: 5 }, end: { line: 7, character: 15 } },
            severity: 2,
            message: "[STD002] Numeric register R[5] should have a descriptive comment",
          },
          {
            range: { start: { line: 10, character: 0 }, end: { line: 10, character: 5 } },
            severity: 3,
            message: "Consider using a named constant",
          },
        ],
      };

      const result = parseLspResponse(JSON.stringify(response));

      expect(result.diagnostics).toHaveLength(3);
      expect(result.diagnostics[0].severity).toBe(1); // Error
      expect(result.diagnostics[1].severity).toBe(2); // Warning
      expect(result.diagnostics[2].severity).toBe(3); // Information
    });

    it("handles empty diagnostics array", () => {
      const response: LspDiagnosticResponse = { diagnostics: [] };
      const result = parseLspResponse(JSON.stringify(response));

      expect(result.diagnostics).toHaveLength(0);
    });

    it("preserves optional fields like code and source", () => {
      const response: LspDiagnosticResponse = {
        diagnostics: [
          {
            range: { start: { line: 5, character: 0 }, end: { line: 5, character: 10 } },
            severity: 1,
            code: "E001",
            source: "fanuc-tp",
            message: "Syntax error",
          },
        ],
      };

      const result = parseLspResponse(JSON.stringify(response));

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].code).toBe("E001");
      expect(result.diagnostics[0].source).toBe("fanuc-tp");
    });

    it("handles JSON with missing optional fields gracefully", () => {
      // Diagnostic with only required fields (range, severity, message) - no code, no source
      const response: LspDiagnosticResponse = {
        diagnostics: [
          {
            range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } },
            severity: 2,
            message: "Warning without code or source",
          },
        ],
      };

      const result = parseLspResponse(JSON.stringify(response));

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].message).toBe("Warning without code or source");
      expect(result.diagnostics[0].code).toBeUndefined();
      expect(result.diagnostics[0].source).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("returns empty diagnostics array for empty string", () => {
      const result = parseLspResponse("");
      expect(result.diagnostics).toHaveLength(0);
    });

    it("returns empty diagnostics array for whitespace-only input", () => {
      const result = parseLspResponse("   \n\n  \t  \n");
      expect(result.diagnostics).toHaveLength(0);
    });

    it("returns empty diagnostics array for malformed JSON", () => {
      const result = parseLspResponse("{diagnostics: [}");
      expect(result.diagnostics).toHaveLength(0);
    });

    it("returns empty diagnostics array for unexpected non-JSON string (plain text error)", () => {
      const result = parseLspResponse("Error: Failed to connect to server\nPlease check your network connection.");
      expect(result.diagnostics).toHaveLength(0);
    });

    it("returns empty diagnostics array for JSON without diagnostics field", () => {
      const result = parseLspResponse('{"someOtherField": true}');
      expect(result.diagnostics).toHaveLength(0);
    });

    it("handles JSON with extra whitespace", () => {
      const response: LspDiagnosticResponse = {
        diagnostics: [
          {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
            severity: 1,
            message: "Error",
          },
        ],
      };
      const result = parseLspResponse("  \n" + JSON.stringify(response) + "\n  ");

      expect(result.diagnostics).toHaveLength(1);
    });
  });

  describe("severity values", () => {
    it("handles all LSP severity levels", () => {
      const response: LspDiagnosticResponse = {
        diagnostics: [
          {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
            severity: 1,
            message: "Error",
          },
          {
            range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } },
            severity: 2,
            message: "Warning",
          },
          {
            range: { start: { line: 2, character: 0 }, end: { line: 2, character: 1 } },
            severity: 3,
            message: "Information",
          },
          {
            range: { start: { line: 3, character: 0 }, end: { line: 3, character: 1 } },
            severity: 4,
            message: "Hint",
          },
        ],
      };

      const result = parseLspResponse(JSON.stringify(response));

      expect(result.diagnostics).toHaveLength(4);
      expect(result.diagnostics.map((d) => d.severity)).toEqual([1, 2, 3, 4]);
    });
  });
});
