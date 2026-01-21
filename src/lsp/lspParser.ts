/**
 * VS Code-independent module for parsing LSP diagnostic JSON output.
 */

import type { LspDiagnostic, LspDiagnosticResponse } from "../api/ShiftresetClient.js";

/**
 * Provider ID for FANUC TP diagnostics.
 */
export const FANUC_TP_PROVIDER_ID = "fanuc-tp";

/**
 * Parse LSP diagnostic JSON from stdout.
 *
 * Handles:
 * - Valid JSON with diagnostics array
 * - Empty or whitespace-only input (returns empty array)
 * - Invalid JSON (logs warning, returns empty array)
 * - Unexpected non-JSON output (logs warning, returns empty array)
 *
 * @param stdout - Raw stdout from the linter
 * @returns Parsed LspDiagnosticResponse with diagnostics array
 */
export function parseLspResponse(stdout: string): LspDiagnosticResponse {
  const trimmed = stdout.trim();

  // Handle empty input
  if (trimmed === "") {
    return { diagnostics: [] };
  }

  // Attempt JSON parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    console.warn(
      `[lspParser] Failed to parse stdout as JSON: ${error instanceof Error ? error.message : String(error)}`
    );
    return { diagnostics: [] };
  }

  // Validate structure
  if (!isLspDiagnosticResponse(parsed)) {
    console.warn(
      "[lspParser] Parsed JSON does not match expected LspDiagnosticResponse structure"
    );
    return { diagnostics: [] };
  }

  return parsed;
}

/**
 * Type guard to validate LspDiagnosticResponse structure.
 */
function isLspDiagnosticResponse(value: unknown): value is LspDiagnosticResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (!Array.isArray(obj.diagnostics)) {
    return false;
  }

  // Validate each diagnostic has required fields
  for (const diag of obj.diagnostics) {
    if (!isLspDiagnostic(diag)) {
      return false;
    }
  }

  return true;
}

/**
 * Type guard to validate LspDiagnostic structure.
 */
function isLspDiagnostic(value: unknown): value is LspDiagnostic {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Required fields
  if (typeof obj.message !== "string") {
    return false;
  }

  if (typeof obj.severity !== "number" || obj.severity < 1 || obj.severity > 4) {
    return false;
  }

  // Validate range structure
  if (!isLspRange(obj.range)) {
    return false;
  }

  // Optional fields - validate if present
  if (obj.code !== undefined && typeof obj.code !== "string" && typeof obj.code !== "number") {
    return false;
  }

  if (obj.source !== undefined && typeof obj.source !== "string") {
    return false;
  }

  return true;
}

/**
 * Type guard to validate LspRange structure.
 */
function isLspRange(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return isLspPosition(obj.start) && isLspPosition(obj.end);
}

/**
 * Type guard to validate LspPosition structure.
 */
function isLspPosition(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return typeof obj.line === "number" && typeof obj.character === "number";
}
