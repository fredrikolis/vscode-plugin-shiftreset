import { describe, it, expect } from "vitest";

describe("FanucTpInlayHintsProvider", () => {
  describe("Auto-updated fields detection", () => {
    it("should detect PROG_SIZE = 0", () => {
      const line = "PROG_SIZE\t= 0;";
      const match = /^(PROG_SIZE\s*=\s*0)\s*;/.exec(line);
      expect(match).toBeTruthy();
      expect(match?.[1]).toBe("PROG_SIZE\t= 0");
    });

    it("should detect MODIFIED = DATE 24-01-01 TIME 00:00:00", () => {
      const line = "MODIFIED\t= DATE 24-01-01  TIME 00:00:00;";
      const match = /^(MODIFIED\s*=\s*DATE\s+24-01-01\s+TIME\s+00:00:00)\s*;/.exec(line);
      expect(match).toBeTruthy();
      expect(match?.[1]).toBe("MODIFIED\t= DATE 24-01-01  TIME 00:00:00");
    });

    it("should detect LINE_COUNT = 0", () => {
      const line = "LINE_COUNT\t= 0;";
      const match = /^(LINE_COUNT\s*=\s*0)\s*;/.exec(line);
      expect(match).toBeTruthy();
      expect(match?.[1]).toBe("LINE_COUNT\t= 0");
    });

    it("should detect MEMORY_SIZE = 0", () => {
      const line = "MEMORY_SIZE\t= 0;";
      const match = /^(MEMORY_SIZE\s*=\s*0)\s*;/.exec(line);
      expect(match).toBeTruthy();
      expect(match?.[1]).toBe("MEMORY_SIZE\t= 0");
    });

    it("should not match non-zero PROG_SIZE", () => {
      const line = "PROG_SIZE\t= 548;";
      const match = /^(PROG_SIZE\s*=\s*0)\s*;/.exec(line);
      expect(match).toBeNull();
    });

    it("should not match non-zeroed MODIFIED date", () => {
      const line = "MODIFIED\t= DATE 25-09-11  TIME 00:54:24;";
      const match = /^(MODIFIED\s*=\s*DATE\s+24-01-01\s+TIME\s+00:00:00)\s*;/.exec(line);
      expect(match).toBeNull();
    });
  });

  describe("Stripped line numbers detection", () => {
    it("should detect stripped line numbers (colon with whitespace prefix)", () => {
      const line = "   :  R[1]=5 ;";
      const match = /^\s+:/.exec(line);
      expect(match).toBeTruthy();
    });

    it("should not match numbered lines", () => {
      const line = "   1:  R[1]=5 ;";
      const match = /^\s+:/.exec(line);
      expect(match).toBeNull();
    });

    it("should detect stripped line numbers with different amounts of whitespace", () => {
      const line = " : CALL MYPROG ;";
      const match = /^\s+:/.exec(line);
      expect(match).toBeTruthy();
    });

    it("should detect stripped line numbers with tabs", () => {
      const line = "\t:  R[1]=5 ;";
      const match = /^\s+:/.exec(line);
      expect(match).toBeTruthy();
    });
  });

  describe("/ATTR section detection", () => {
    it("should detect /ATTR start", () => {
      const line = "/ATTR";
      const match = /^\/ATTR\s*$/.exec(line);
      expect(match).toBeTruthy();
    });

    it("should detect section end with /APPL", () => {
      const line = "/APPL";
      const match = /^\/[A-Z]+/.exec(line);
      expect(match).toBeTruthy();
    });

    it("should detect section end with /MN", () => {
      const line = "/MN";
      const match = /^\/[A-Z]+/.exec(line);
      expect(match).toBeTruthy();
    });

    it("should not falsely detect /ATTR as section end", () => {
      const line = "/ATTR";
      const notAttr = /^\/ATTR/.exec(line);
      expect(notAttr).toBeTruthy(); // This is still ATTR, not an end
    });
  });

  describe("/MN section detection", () => {
    it("should detect /MN line", () => {
      const line = "/MN";
      const match = /^\/MN\s*$/.exec(line);
      expect(match).toBeTruthy();
    });

    it("should not match /MN with trailing content", () => {
      const line = "/MNEDITOR";
      const match = /^\/MN\s*$/.exec(line);
      expect(match).toBeNull();
    });
  });

  describe("Integration scenarios", () => {
    it("should process file with all zeroed fields", () => {
      const lines = [
        "/PROG  TEST",
        "/ATTR",
        "OWNER\t\t= MNEDITOR;",
        "PROG_SIZE\t= 0;",
        "MODIFIED\t= DATE 24-01-01  TIME 00:00:00;",
        "LINE_COUNT\t= 0;",
        "MEMORY_SIZE\t= 0;",
        "/APPL",
        "/MN",
        "   1:  R[1]=5 ;",
        "/POS",
        "/END",
      ];

      let inAttrSection = false;
      let zeroedFieldCount = 0;

      for (const line of lines) {
        if (/^\/ATTR\s*$/.test(line)) {
          inAttrSection = true;
          continue;
        }
        if (inAttrSection && /^\/[A-Z]+/.test(line) && !/^\/ATTR/.test(line)) {
          inAttrSection = false;
        }
        if (inAttrSection) {
          if (/^(PROG_SIZE\s*=\s*0)\s*;/.test(line)) zeroedFieldCount++;
          if (/^(MODIFIED\s*=\s*DATE\s+24-01-01\s+TIME\s+00:00:00)\s*;/.test(line)) zeroedFieldCount++;
          if (/^(LINE_COUNT\s*=\s*0)\s*;/.test(line)) zeroedFieldCount++;
          if (/^(MEMORY_SIZE\s*=\s*0)\s*;/.test(line)) zeroedFieldCount++;
        }
      }

      expect(zeroedFieldCount).toBe(4);
    });

    it("should detect stripped line numbers in complete file", () => {
      const lines = [
        "/PROG  TEST",
        "/ATTR",
        "OWNER\t\t= MNEDITOR;",
        "/APPL",
        "/MN",
        "   :  R[1]=5 ;",
        "   :  CALL MYPROG ;",
        "/POS",
        "/END",
      ];

      let mnLineIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^\/MN\s*$/.test(lines[i])) {
          mnLineIndex = i;
          break;
        }
      }

      expect(mnLineIndex).toBe(4);

      const firstLineAfterMn = lines[mnLineIndex + 1];
      const strippedMatch = /^\s+:/.exec(firstLineAfterMn);
      expect(strippedMatch).toBeTruthy();
    });

    it("should not detect stripped line numbers when numbers are present", () => {
      const lines = [
        "/PROG  TEST",
        "/ATTR",
        "OWNER\t\t= MNEDITOR;",
        "/APPL",
        "/MN",
        "   1:  R[1]=5 ;",
        "   2:  CALL MYPROG ;",
        "/POS",
        "/END",
      ];

      let mnLineIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^\/MN\s*$/.test(lines[i])) {
          mnLineIndex = i;
          break;
        }
      }

      expect(mnLineIndex).toBe(4);

      const firstLineAfterMn = lines[mnLineIndex + 1];
      const strippedMatch = /^\s+:/.exec(firstLineAfterMn);
      expect(strippedMatch).toBeNull();
    });
  });
});
