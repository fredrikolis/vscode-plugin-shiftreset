/**
 * E2E tests for the shiftreset.run public API.
 * These tests require network access to shiftreset.run.
 *
 * To run these tests:
 *   SHIFTRESET_E2E=true npm test
 *
 * These tests are skipped by default.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { ShiftresetClient } from "../api/ShiftresetClient.js";

// Skip E2E tests by default - these are for manual verification with network access
const ENABLE_E2E = process.env.SHIFTRESET_E2E === "true";
const describeE2E = ENABLE_E2E ? describe : describe.skip;

describeE2E("E2E: shiftreset.run API", () => {
  let client: ShiftresetClient;

  beforeAll(() => {
    client = new ShiftresetClient();
  });

  it("lints valid TP program successfully", async () => {
    const validProgram = `/PROG TEST
/MN
1: J P[1] 100% FINE;
2: L P[2] 500mm/sec FINE;
/END
`;

    const result = await client.lint(validProgram);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.diagnostics)).toBe(true);
    }
  });

  it("returns lint errors for invalid program", async () => {
    const invalidProgram = `/PROG TEST
/MN
1: INVALID SYNTAX @@@
/END
`;

    const result = await client.lint(invalidProgram);

    expect(result.success).toBe(true);
    if (result.success) {
      // Should find errors
      expect(result.data.diagnostics.length).toBeGreaterThan(0);
      expect(result.data.diagnostics[0].message).toBeTruthy();
    }
  });

  it("formats TP program successfully", async () => {
    const program = `/PROG TEST
/MN
1:J P[1] 100% FINE;
/END
`;

    const result = await client.format(program);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.content).toBe("string");
      expect(result.data.content.length).toBeGreaterThan(0);
    }
  });

  it("checks compliance successfully", async () => {
    const program = `/PROG TEST
/MN
1: J P[1] 100% FINE;
/END
`;

    const result = await client.compliance(program);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.diagnostics)).toBe(true);
    }
  });

  it("handles empty program", async () => {
    const emptyProgram = "";

    const result = await client.lint(emptyProgram);

    expect(result.success).toBe(true);
    // Empty input should still return a valid response
    if (result.success) {
      expect(Array.isArray(result.data.diagnostics)).toBe(true);
    }
  });

  it("respects timeout", async () => {
    const result = await client.lint("test", { timeoutMs: 30000 });
    expect(result.success).toBe(true);
  });

  it("supports auto-fix option", async () => {
    const invalidProgram = `/PROG TEST
/MN
1: INVALID @@@
/END
`;

    const result = await client.check(invalidProgram, { fix: true });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.diagnostics)).toBe(true);
    }
  });
});
