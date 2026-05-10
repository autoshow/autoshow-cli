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
  qualityRankings: Map<string, number> | null;
  markdownOut: string | null;
  jsonOut: string | null;
}

function helpText(): string {
  return [
    "Usage: bun build_comparison_report.ts <run_dir> [--quality-rankings <rankings>] [--markdown-out <path>] [--json-out <path>]",
    "",
    "Generate image provider comparison reports with optional user quality rankings.",
    "",
    "Options:",
    "  --quality-rankings <rankings>  Comma-separated providerKey=rank pairs (e.g., gemini/imagen-4.0-generate-001=1,openai/gpt-image-1=2)",
    "  --markdown-out <path>          Write markdown report to <path> (default: <run_dir>/provider-comparison-report.md)",
    "  --json-out <path>              Write JSON report to <path> (default: <run_dir>/provider-comparison-report.json)",
    "  --help, -h                     Show this help message",
    "",
    "Examples:",
    "  bun build_comparison_report.ts ./runs/my-image-run",
    '  bun build_comparison_report.ts ./runs/my-image-run --quality-rankings "gemini/imagen-4.0-generate-001=1,openai/gpt-image-1=2"',
  ].join("\n");
}

function parseQualityRankings(raw: string): Map<string, number> {
  const rankings = new Map<string, number>();
  for (const pair of raw.split(",")) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.lastIndexOf("=");
    if (eqIndex === -1) {
      throw new Error(`Invalid quality ranking format: "${trimmed}" (expected providerKey=rank)`);
    }
    const key = trimmed.slice(0, eqIndex);
    const rank = Number(trimmed.slice(eqIndex + 1));
    if (!key || Number.isNaN(rank) || rank < 1) {
      throw new Error(`Invalid quality ranking: "${trimmed}"`);
    }
    rankings.set(key, rank);
  }
  return rankings;
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    process.exit(0);
  }

  const positional: string[] = [];
  let qualityRankings: Map<string, number> | null = null;
  let markdownOut: string | null = null;
  let jsonOut: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--quality-rankings") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --quality-rankings");
      }
      qualityRankings = parseQualityRankings(value);
      index += 1;
      continue;
    }
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
      "Usage: bun build_comparison_report.ts <run_dir> [--quality-rankings <rankings>] [--markdown-out <path>] [--json-out <path>]",
    );
  }

  return {
    runDir: resolve(runDir),
    qualityRankings,
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

interface RankedProvider {
  rank: number;
  providerKey: string;
  imageService: string;
  imageModel: string;
  score: number;
  qualityRank: number | null;
  width: number;
  height: number;
  totalFileSize: number;
  imageCount: number;
  bytesPerPixel: number;
  processingTimeMs: number;
  costCents: number | null;
}

export async function buildReport(
  runDir: string,
  qualityRankings: Map<string, number> | null,
) {
  const runJson = loadImageRunJson(runDir);
  const warnings: string[] = [];

  const { found, missing } = discoverImageFiles(runDir, runJson.metadata.image);
  if (missing.length > 0) {
    warnings.push(`Missing image files: ${missing.join(", ")}`);
  }

  const costLookup = buildCostLookup(runJson);
  const timingLookup = buildTimingLookup(runJson);
  const hasQualityRankings = qualityRankings !== null && qualityRankings.size > 0;
  const providerCount = runJson.metadata.image.length;

  const providerData: Array<Omit<RankedProvider, "rank">> = [];

  for (const entry of runJson.metadata.image) {
    const providerKey = makeProviderKey(entry.imageService, entry.imageModel);
    const imagePaths = found.get(providerKey) ?? [];

    let width = 0;
    let height = 0;
    let totalFileSize = 0;
    let bytesPerPixel = 0;

    if (imagePaths.length > 0) {
      // Use the first image for representative dimensions
      try {
        const props = await probeImage(imagePaths[0]!);
        width = props.width;
        height = props.height;
        bytesPerPixel = props.bytesPerPixel;
      } catch {
        warnings.push(`Image probe failed for ${entry.imageFileNames[0]}`);
      }
      // Sum file sizes across all images
      for (const imagePath of imagePaths) {
        totalFileSize += Bun.file(imagePath).size;
      }
    }

    const costCents = costLookup.get(providerKey) ?? null;
    const processingTimeMs = timingLookup.get(providerKey) ?? entry.processingTime;
    const qualityRank = hasQualityRankings ? (qualityRankings!.get(providerKey) ?? null) : null;

    providerData.push({
      providerKey,
      imageService: entry.imageService,
      imageModel: entry.imageModel,
      score: 0, // computed below
      qualityRank,
      width,
      height,
      totalFileSize,
      imageCount: entry.imageCount,
      bytesPerPixel,
      processingTimeMs,
      costCents,
    });
  }

  // Compute normalization bounds
  const maxCostCents = Math.max(...providerData.map((p) => p.costCents ?? 0), 1);
  const maxProcessingTimeMs = Math.max(...providerData.map((p) => p.processingTimeMs), 1);
  const maxBytesPerPixel = Math.max(...providerData.map((p) => p.bytesPerPixel), 1);

  // Score each provider
  for (const provider of providerData) {
    if (hasQualityRankings && provider.qualityRank !== null) {
      // Quality-ranked scoring: 50% quality, 25% cost, 25% speed
      const qualityComponent = providerCount > 1
        ? 50 * (1 - (provider.qualityRank - 1) / (providerCount - 1))
        : 50;
      const costComponent = provider.costCents !== null
        ? 25 * Math.max(0, 1 - provider.costCents / maxCostCents)
        : 12.5;
      const speedComponent = provider.processingTimeMs > 0
        ? 25 * Math.max(0, 1 - provider.processingTimeMs / maxProcessingTimeMs)
        : 12.5;
      provider.score = qualityComponent + costComponent + speedComponent;
    } else {
      // Composite scoring: 33% cost, 33% speed, 34% file size efficiency
      const costComponent = provider.costCents !== null
        ? 33 * Math.max(0, 1 - provider.costCents / maxCostCents)
        : 16.5;
      const speedComponent = provider.processingTimeMs > 0
        ? 33 * Math.max(0, 1 - provider.processingTimeMs / maxProcessingTimeMs)
        : 16.5;
      const fileSizeComponent = provider.bytesPerPixel > 0
        ? 34 * Math.max(0, 1 - provider.bytesPerPixel / maxBytesPerPixel)
        : 17;
      provider.score = costComponent + speedComponent + fileSizeComponent;
    }
  }

  // Rank providers by score descending
  const ranked: RankedProvider[] = [...providerData]
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      return left.providerKey.localeCompare(right.providerKey);
    })
    .map((provider, index) => ({ ...provider, rank: index + 1 }));

  const scoringMethod = hasQualityRankings ? "quality-ranked" : "composite";

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

  const withTime = ranked.filter((p) => p.processingTimeMs > 0);
  if (withTime.length > 0) {
    const fastest = [...withTime].sort((a, b) => a.processingTimeMs - b.processingTimeMs)[0]!;
    notes.push(`Fastest provider: \`${fastest.providerKey}\` at ${formatProcessingSeconds(fastest.processingTimeMs)}.`);
  }

  if (scoringMethod === "composite") {
    notes.push(
      "No user quality rankings were provided. Ranking used a composite of cost efficiency (33%), processing speed (33%), and file size efficiency (34%).",
    );
    notes.push(
      "File size efficiency measures bytes per pixel (compression ratio), not visual quality. The agent cannot view images.",
    );
  } else {
    notes.push(
      "User quality rankings were provided. Ranking used quality rank (50%), cost efficiency (25%), and processing speed (25%).",
    );
  }

  // Build reports
  const scoreFormula = scoringMethod === "quality-ranked"
    ? "50% quality-rank + 25% cost-efficiency + 25% speed"
    : "33% cost-efficiency + 33% speed + 34% file-size-efficiency";

  const reportJson = {
    runDir,
    metric: scoringMethod,
    scoreFormula,
    providerCount: ranked.length,
    providers: ranked,
    notes,
  };

  // Markdown report
  const hasQualityColumn = ranked.some((p) => p.qualityRank !== null);

  const headerCols = ["Rank", "Provider", "Score / 100"];
  if (hasQualityColumn) headerCols.push("Quality Rank");
  headerCols.push("Dimensions", "File Size", "Images", "Processing Time", "Cost");

  const headerRow = `| ${headerCols.join(" | ")} |`;
  const separatorRow = `| ${headerCols.map(() => "---:").join(" | ")} |`;

  const rows = ranked.map((p) => {
    const cols = [
      String(p.rank),
      `\`${p.providerKey}\``,
      p.score.toFixed(2),
    ];
    if (hasQualityColumn) {
      cols.push(p.qualityRank !== null ? `#${p.qualityRank}` : "n/a");
    }
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

  const methodDescription = hasQualityRankings
    ? "- User quality rankings were provided and used as the primary signal (50% weight).\n- Cost efficiency (25%) and processing speed (25%) complete the score."
    : "- No user quality rankings were available.\n- Ranking uses a composite score: 33% cost efficiency, 33% processing speed, 34% file size efficiency (bytes per pixel).\n- File size efficiency measures compression ratio, not visual quality.";

  const markdown = `# Image Provider Comparison Report

## Summary

- Total providers: ${ranked.length}
- Scoring method: ${scoringMethod === "quality-ranked" ? "quality-ranked (user rankings + cost + speed)" : "composite (cost + speed + file size efficiency)"}
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

  const { reportJson, markdown, warnings } = await buildReport(
    args.runDir,
    args.qualityRankings,
  );

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
