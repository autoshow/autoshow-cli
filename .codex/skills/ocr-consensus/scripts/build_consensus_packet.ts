#!/usr/bin/env bun

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  chooseBaselineProvider,
  formatCents,
  formatProcessingSeconds,
  isLocalOcrService,
  loadOcrProviderRuns,
  loadOcrRunJson,
  textSimilarity,
} from "./ocr_consensus_lib.ts";

interface ParsedArgs {
  runDir: string;
  outPath: string | null;
}

function helpText(): string {
  return [
    "Usage: bun build_consensus_packet.ts <run_dir> [--out <path>]",
    "",
    "Build a consensus evidence packet from a multi-provider AutoShow OCR run.",
    "",
    "Options:",
    "  --out <path>  Write JSON packet to <path> instead of stdout",
    "  --help, -h    Show this help message",
    "",
    "Examples:",
    "  bun build_consensus_packet.ts ./runs/my-document",
    '  bun build_consensus_packet.ts ./runs/my-document --out /tmp/packet.json',
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
      if (!value) {
        throw new Error("Missing value for --out");
      }
      outPath = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    positional.push(arg);
  }

  const runDir = positional[0];
  if (!runDir) {
    throw new Error("Usage: bun build_consensus_packet.ts <run_dir> [--out <path>]");
  }

  return { runDir: resolve(runDir), outPath: outPath ? resolve(outPath) : null };
}

export function buildPacket(runDir: string) {
  const runJson = loadOcrRunJson(runDir);
  const { providers, warnings } = loadOcrProviderRuns(runDir);
  if (providers.length === 0) {
    throw new Error(`No providers/*/result.json files found under ${runDir}`);
  }

  const { baseline, agreement } = chooseBaselineProvider(providers);
  const documentTitle = runJson.metadata?.step1?.title ?? "unknown";
  const totalPages = runJson.metadata?.step1?.pageCount ?? baseline.pages.length;

  const providerStats = [...providers]
    .sort((left, right) => left.directoryName.localeCompare(right.directoryName))
    .map((provider) => ({
      provider: provider.provider,
      providerKey: provider.providerKey,
      group: isLocalOcrService(provider.provider) ? "local" : "cloud",
      agreementScore: Number((agreement[provider.directoryName] ?? 0).toFixed(6)),
      pageCount: provider.pages.length,
      tokenEstimate: provider.tokenEstimate,
      processingTimeMs: provider.processingTimeMs,
      processingTime: formatProcessingSeconds(provider.processingTimeMs),
      actualCostCents: provider.actualCostCents,
      actualCost: formatCents(provider.actualCostCents),
      resultPath: provider.resultPath,
    }));

  // Build page-level evidence using baseline pages as reference
  const allPageNumbers = new Set<number>();
  for (const provider of providers) {
    for (const page of provider.pages) {
      allPageNumbers.add(page.pageNumber);
    }
  }
  const sortedPageNumbers = [...allPageNumbers].sort((a, b) => a - b);

  const pages = sortedPageNumbers.map((pageNumber) => {
    const baselinePage = baseline.pages.find((p) => p.pageNumber === pageNumber);
    const baselineText = baselinePage?.text ?? "";

    const evidence = providers
      .map((provider) => {
        const providerPage = provider.pages.find((p) => p.pageNumber === pageNumber);
        if (!providerPage) {
          return null;
        }
        return {
          provider: provider.provider,
          providerKey: provider.providerKey,
          text: providerPage.text,
          similarity: baselineText
            ? Number(textSimilarity(baselineText, providerPage.text).toFixed(6))
            : 1,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((left, right) => {
        // Baseline first
        if ((left.providerKey === baseline.providerKey) !== (right.providerKey === baseline.providerKey)) {
          return left.providerKey === baseline.providerKey ? -1 : 1;
        }
        // Then by similarity descending
        if (left.similarity !== right.similarity) {
          return right.similarity - left.similarity;
        }
        // Then alphabetically
        return left.providerKey.localeCompare(right.providerKey);
      });

    return { pageNumber, evidence };
  });

  return {
    runDir,
    documentTitle,
    totalPages,
    baselineSelection: {
      provider: baseline.provider,
      providerKey: baseline.providerKey,
      method: "highest mean pairwise text similarity across discovered providers",
    },
    providerStats,
    pages,
    warnings,
  };
}

function main(): number {
  const { runDir, outPath } = parseArgs(process.argv.slice(2));
  const packet = buildPacket(runDir);

  for (const warning of packet.warnings) {
    console.error(`[warn] ${warning}`);
  }

  const serialized = `${JSON.stringify(packet, null, 2)}\n`;
  if (outPath) {
    writeFileSync(outPath, serialized);
  } else {
    process.stdout.write(serialized);
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
