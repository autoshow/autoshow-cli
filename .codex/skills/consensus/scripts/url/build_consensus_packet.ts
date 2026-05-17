#!/usr/bin/env bun

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadUrlProviderRuns,
  selectBaselineProvider,
  tokenize,
} from "./url_consensus_lib.ts";

interface ParsedArgs {
  runDir: string;
  outPath: string | null;
}

function helpText(): string {
  return [
    "Usage: bun build_consensus_packet.ts <run_dir> [--out <path>]",
    "",
    "Build an evidence packet from AutoShow URL provider result.json files.",
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    process.exit(0);
  }

  const positional: string[] = [];
  let outPath: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --out");
      outPath = resolve(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) throw new Error(`Unknown flag: ${arg}`);
    positional.push(arg);
  }

  const runDir = positional[0];
  if (!runDir) throw new Error("Usage: bun build_consensus_packet.ts <run_dir> [--out <path>]");
  return { runDir: resolve(runDir), outPath };
}

const args = parseArgs(process.argv.slice(2));
const providers = loadUrlProviderRuns(args.runDir);
const baseline = selectBaselineProvider(providers);
const packet = {
  schemaVersion: 1,
  kind: "url-consensus-packet",
  runDir: args.runDir,
  providerCount: providers.length,
  baselineProvider: {
    provider: baseline.provider,
    model: baseline.model,
    providerKey: baseline.providerKey,
    reason: "Longest normalized article text among discovered successful providers.",
  },
  providers: providers.map((provider) => ({
    provider: provider.provider,
    model: provider.model,
    providerKey: provider.providerKey,
    directoryName: provider.directoryName,
    resultPath: provider.resultPath,
    extractionPath: provider.extractionPath,
    sourceUrl: provider.sourceUrl,
    finalUrl: provider.finalUrl,
    title: provider.title,
    wordCount: tokenize(provider.text).length,
    characterCount: provider.plainText.length,
    tokenEstimate: provider.tokenEstimate,
    processingTimeMs: provider.processingTimeMs,
    actualCostCents: provider.actualCostCents,
    markdown: provider.text,
  })),
};

const json = `${JSON.stringify(packet, null, 2)}\n`;
if (args.outPath) {
  writeFileSync(args.outPath, json);
} else {
  process.stdout.write(json);
}
