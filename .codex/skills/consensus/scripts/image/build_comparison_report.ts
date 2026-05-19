#!/usr/bin/env bun

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildCostLookup,
  buildTimingLookup,
  discoverImageFiles,
  formatCents,
  formatDimensions,
  formatFileSize,
  formatProcessingSeconds,
  loadImageRunJson,
  makeProviderKey,
  probeImage,
} from "./image_eval_lib.ts";

interface ParsedArgs {
  runDir: string;
  markdownOut: string | null;
  jsonOut: string | null;
}

function helpText(): string {
  return [
    "Usage: bun build_comparison_report.ts <run_dir> [--markdown-out <path>] [--json-out <path>]",
    "",
    "Generate image provider comparison reports using price-speed scoring.",
    "",
    "Options:",
    "  --markdown-out <path>          Write markdown report to <path> (default: <run_dir>/provider-comparison-report.md)",
    "  --json-out <path>              Write JSON report to <path> (default: <run_dir>/provider-comparison-report.json)",
    "  --help, -h                     Show this help message",
    "",
    "Examples:",
    "  bun build_comparison_report.ts ./runs/my-image-run",
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    process.exit(0);
  }

  const positional: string[] = [];
  let markdownOut: string | null = null;
  let jsonOut: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--markdown-out") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --markdown-out");
      }
      markdownOut = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--json-out") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --json-out");
      }
      jsonOut = resolve(value);
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
    throw new Error(
      "Usage: bun build_comparison_report.ts <run_dir> [--markdown-out <path>] [--json-out <path>]",
    );
  }

  return {
    runDir: resolve(runDir),
    markdownOut,
    jsonOut,
  };
}

function joinProviderNames(providers: Array<{ providerKey: string }>): string {
  const names = providers.map((p) => `\`${p.providerKey}\``);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeLowerIsBetter(value: number | null, availableValues: number[]): number {
  if (!isFiniteNumber(value)) {
    return 50;
  }
  const finiteValues = availableValues.filter(isFiniteNumber);
  if (finiteValues.length === 0) {
    return 50;
  }
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  if (min === max) {
    return 100;
  }
  return Math.max(0, Math.min(100, 100 * (1 - (value - min) / (max - min))));
}

interface RankedProvider {
  rank: number;
  providerKey: string;
  imageService: string;
  imageModel: string;
  score: number;
  costEfficiencyScore: number;
  processingSpeedScore: number;
  width: number;
  height: number;
  totalFileSize: number;
  imageCount: number;
  processingTimeMs: number | null;
  costCents: number | null;
}

export async function buildReport(runDir: string) {
  const runJson = loadImageRunJson(runDir);
  const warnings: string[] = [];

  const { found, missing } = discoverImageFiles(runDir, runJson.metadata.image);
  if (missing.length > 0) {
    warnings.push(`Missing image files: ${missing.join(", ")}`);
  }

  const costLookup = buildCostLookup(runJson);
  const timingLookup = buildTimingLookup(runJson);

  const providerData: Array<Omit<RankedProvider, "rank">> = [];

  for (const entry of runJson.metadata.image) {
    const providerKey = makeProviderKey(entry.imageService, entry.imageModel);
    const imagePaths = found.get(providerKey) ?? [];

    let width = 0;
    let height = 0;
    let totalFileSize = 0;

    if (imagePaths.length > 0) {
      // Use the first image for representative dimensions
      try {
        const props = await probeImage(imagePaths[0]!);
        width = props.width;
        height = props.height;
      } catch {
        warnings.push(`Image probe failed for ${entry.imageFileNames[0]}`);
      }
      // Sum file sizes across all images
      for (const imagePath of imagePaths) {
        totalFileSize += Bun.file(imagePath).size;
      }
    }

    const costCents = costLookup.get(providerKey) ?? null;
    const processingTimeMs = timingLookup.get(providerKey) ?? (typeof entry.processingTime === "number" ? entry.processingTime : null);

    providerData.push({
      providerKey,
      imageService: entry.imageService,
      imageModel: entry.imageModel,
      score: 0, // computed below
      costEfficiencyScore: 50,
      processingSpeedScore: 50,
      width,
      height,
      totalFileSize,
      imageCount: entry.imageCount,
      processingTimeMs,
      costCents,
    });
  }

  const costValues = providerData.map((p) => p.costCents).filter(isFiniteNumber);
  const timingValues = providerData.map((p) => p.processingTimeMs).filter(isFiniteNumber);

  // Score each provider
  for (const provider of providerData) {
    provider.costEfficiencyScore = normalizeLowerIsBetter(provider.costCents, costValues);
    provider.processingSpeedScore = normalizeLowerIsBetter(provider.processingTimeMs, timingValues);
    provider.score = (provider.costEfficiencyScore * 0.5) + (provider.processingSpeedScore * 0.5);
  }

  // Rank providers by score descending
  const ranked: RankedProvider[] = [...providerData]
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      if (left.costEfficiencyScore !== right.costEfficiencyScore) return right.costEfficiencyScore - left.costEfficiencyScore;
      if (left.processingSpeedScore !== right.processingSpeedScore) return right.processingSpeedScore - left.processingSpeedScore;
      return left.providerKey.localeCompare(right.providerKey);
    })
    .map((provider, index) => ({ ...provider, rank: index + 1 }));

  const scoringMethod = "price-speed";

  const notes: string[] = [];
  if (ranked[0]) {
    notes.push(`Best overall: \`${ranked[0].providerKey}\` scored ${ranked[0].score.toFixed(2)}/100.`);
  }

  const withCost = ranked.filter((p) => p.costCents !== null);
  if (withCost.length > 0) {
    const cheapestCost = Math.min(...withCost.map((p) => p.costCents as number));
    const cheapestProviders = withCost.filter((p) => p.costCents === cheapestCost);
    const subject = cheapestProviders.length === 1 ? "provider was" : "providers were";
    notes.push(`The cheapest ${subject} ${joinProviderNames(cheapestProviders)} at ${formatCents(cheapestCost)}.`);
  }

  const withTime = ranked.filter((p) => p.processingTimeMs !== null);
  if (withTime.length > 0) {
    const fastest = [...withTime].sort((a, b) => (a.processingTimeMs ?? Infinity) - (b.processingTimeMs ?? Infinity))[0]!;
    notes.push(`Fastest provider: \`${fastest.providerKey}\` at ${formatProcessingSeconds(fastest.processingTimeMs)}.`);
  }

  notes.push(
    "Ranking used price-speed scoring: cost efficiency (50%) and processing speed (50%).",
  );
  notes.push(
    "Image existence, dimensions, and file size are reported as evidence only; they are not scoring inputs.",
  );

  // Build reports
  const scoreFormula = "50% cost-efficiency + 50% processing-speed";

  const reportJson = {
    runDir,
    metric: scoringMethod,
    scoreFormula,
    weights: {
      costEfficiency: 0.5,
      processingSpeed: 0.5,
    },
    providerCount: ranked.length,
    providers: ranked,
    notes,
  };

  // Markdown report
  const headerCols = ["Rank", "Provider", "Score / 100", "Cost Score", "Speed Score", "Dimensions", "File Size", "Images", "Processing Time", "Cost"];

  const headerRow = `| ${headerCols.join(" | ")} |`;
  const separatorRow = `| ${headerCols.map(() => "---:").join(" | ")} |`;

  const rows = ranked.map((p) => {
    const cols = [
      String(p.rank),
      `\`${p.providerKey}\``,
      p.score.toFixed(2),
      p.costEfficiencyScore.toFixed(2),
      p.processingSpeedScore.toFixed(2),
    ];
    cols.push(
      formatDimensions(p.width, p.height),
      formatFileSize(p.totalFileSize),
      String(p.imageCount),
      formatProcessingSeconds(p.processingTimeMs),
      formatCents(p.costCents),
    );
    return `| ${cols.join(" | ")} |`;
  }).join("\n");

  const rankingTable = `${headerRow}\n${separatorRow}\n${rows}`;

  const providerList = ranked.map((p) => `  - \`${p.providerKey}\``).join("\n");
  const notesBlock = notes.map((note) => `- ${note}`).join("\n");

  const methodDescription = "- Ranking uses price-speed scoring: 50% cost efficiency and 50% processing speed.\n- Lower cost and lower processing time are better; missing cost or timing receives a neutral component score of 50.\n- If all available values for a metric are equal, providers with that metric receive 100 for that component.\n- Image existence, dimensions, and file size are reported for context only.";

  const markdown = `# Image Provider Comparison Report

## Summary

- Total providers: ${ranked.length}
- Scoring method: price-speed (cost + speed)
- Score formula: \`${scoreFormula}\`

## Method

- Each provider in \`metadata.image[]\` was evaluated based on its image output.
- Image dimensions were measured by probing file headers directly.
- Cost and processing time were extracted from \`run.json\` metadata.
${methodDescription}

## Providers (${ranked.length})

${providerList}

## Ranking

${rankingTable}

## Notes

${notesBlock}
`;

  return { reportJson, markdown, warnings };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const markdownOut = args.markdownOut ?? resolve(args.runDir, "provider-comparison-report.md");
  const jsonOut = args.jsonOut ?? resolve(args.runDir, "provider-comparison-report.json");

  const { reportJson, markdown, warnings } = await buildReport(args.runDir);

  for (const warning of warnings) {
    console.error(`[warn] ${warning}`);
  }

  writeFileSync(jsonOut, `${JSON.stringify(reportJson, null, 2)}\n`);
  writeFileSync(markdownOut, markdown);
  return 0;
}

if (import.meta.main) {
  main().then((code) => process.exit(code));
}
