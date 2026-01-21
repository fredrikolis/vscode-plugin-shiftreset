#!/usr/bin/env node
// scripts/fetch-grammar.js
// Build script to fetch TextMate grammar from shiftreset.run API
// Usage: node scripts/fetch-grammar.js

const fs = require("node:fs");
const path = require("node:path");

const API_URL = "https://shiftreset.run/textmate-syntax";
const OUTPUT_DIR = "syntaxes";
const OUTPUT_FILE = "fanuc-tp.tmLanguage.json";

async function fetchGrammar() {
  console.log("Fetching TextMate grammar from API...");

  const response = await fetch(API_URL, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Parse response as JSON (direct grammar, no wrapper)
  let grammar;
  try {
    grammar = await response.json();
  } catch (parseErr) {
    throw new Error(`Failed to parse grammar JSON: ${parseErr.message}`);
  }

  return grammar;
}

async function writeGrammar(grammar) {
  const outputDir = path.resolve(process.cwd(), OUTPUT_DIR);
  const outputPath = path.join(outputDir, OUTPUT_FILE);

  // Create directory if not exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
  }

  // Write formatted JSON
  const content = JSON.stringify(grammar, null, 2) + "\n";
  fs.writeFileSync(outputPath, content, "utf-8");
  console.log(`Written: ${outputPath}`);
}

async function main() {
  try {
    const grammar = await fetchGrammar();
    await writeGrammar(grammar);
    console.log("Done.");
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
