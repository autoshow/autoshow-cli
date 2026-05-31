#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildCostLookup,
  buildTimingLookup,
  discoverVideoFiles,
  entryProcessingTime,
  formatCents,
  formatDurationSeconds,
  formatFileSize,
  formatProcessingSeconds,
  isFiniteNumber,
  loadVideoRunJson,
  makeProviderKey,
  normalizeLowerIsBetter,
  nullableNumber,
} from "./video_eval_lib.ts";

interface ParsedArgs {
  runDir: string;
  markdownOut: string | null;
  jsonOut: string | null;
}

interface RankedProvider {
  rank: number;
  providerKey: string;
  videoGenService: string;
  videoGenModel: string;
  score: number;
  costEfficiencyScore: number;
  processingSpeedScore: number;
  videoFileName: string;
  videoExists: boolean;
  artifactFileSize: number | null;
  metadataFileSize: number | null;
  videoDurationSeconds: number | null;
  processingTimeMs: number | null;
  costCents: number | null;
  qualityScore: number | null;
  humanQualityScore: number | null;
}

function helpText(): string {
  return [
    "Usage: bun build_comparison_report.ts <run_dir> [--markdown-out <path>] [--json-out <path>]",
    "",
    "Generate video provider comparison reports using price-speed scoring.",
    "",
    "Options:",
    "  --markdown-out <path>  Write markdown report to <path> (default: <run_dir>/provider-comparison-report.md)",
    "  --json-out <path>      Write JSON report to <path> (default: <run_dir>/provider-comparison-report.json)",
    "  --help, -h             Show this help message",
    "",
    "Examples:",
    "  bun build_comparison_report.ts ./runs/my-video-run",
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
    throw new Error("Usage: bun build_comparison_report.ts <run_dir> [--markdown-out <path>] [--json-out <path>]");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function numberField(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function loadVideoQualityScores(
  runDir: string,
  warnings: string[],
): Map<string, { qualityScore: number | null; humanQualityScore: number | null }> {
  const qualityReportPath = resolve(runDir, "video-quality-report.json");
  const scores = new Map<string, { qualityScore: number | null; humanQualityScore: number | null }>();

  if (!existsSync(qualityReportPath)) {
    return scores;
  }

  let report: unknown;
  try {
    report = JSON.parse(readFileSync(qualityReportPath, "utf8")) as unknown;
  } catch (error) {
    warnings.push(`Could not read video-quality-report.json: ${error instanceof Error ? error.message : String(error)}`);
    return scores;
  }

  if (!isRecord(report) || !Array.isArray(report.providers)) {
    warnings.push("video-quality-report.json did not contain a providers array.");
    return scores;
  }

  for (const provider of report.providers) {
    if (!isRecord(provider)) {
      continue;
    }

    const providerKey = stringField(provider, ["providerKey"])
      ?? (() => {
        const service = stringField(provider, ["provider", "videoGenService", "videoService"]);
        const model = stringField(provider, ["model", "videoGenModel", "videoModel"]);
        return service && model ? makeProviderKey(service, model) : null;
      })();

    if (!providerKey) {
      continue;
    }

    const metrics = isRecord(provider.metrics) ? provider.metrics : {};
    const qualityScore = numberField(provider, ["qualityScore"]) ?? numberField(metrics, ["qualityScore"]);
    const humanQualityScore = numberField(provider, ["humanQualityScore"]) ?? numberField(metrics, ["humanQualityScore"]);

    if (qualityScore !== null || humanQualityScore !== null) {
      scores.set(providerKey, { qualityScore, humanQualityScore });
    }
  }

  return scores;
}

export async function buildReport(runDir: string) {
  const runJson = loadVideoRunJson(runDir);
  const warnings: string[] = [];

  const { found, missing } = discoverVideoFiles(runDir, runJson.metadata.video);
  if (missing.length > 0) {
    warnings.push(`Missing video files: ${missing.join(", ")}`);
  }

  const costLookup = buildCostLookup(runJson);
  const timingLookup = buildTimingLookup(runJson);
  const qualityScores = loadVideoQualityScores(runDir, warnings);
  const providerData: Array<Omit<RankedProvider, "rank">> = [];

  for (const entry of runJson.metadata.video) {
    const providerKey = makeProviderKey(entry.videoGenService, entry.videoGenModel);
    const videoPath = found.get(providerKey) ?? "";
    const videoExists = videoPath.length > 0;
    const costCents = costLookup.get(providerKey) ?? null;
    const processingTimeMs = timingLookup.get(providerKey) ?? entryProcessingTime(entry);
    const quality = qualityScores.get(providerKey);

    providerData.push({
      providerKey,
      videoGenService: entry.videoGenService,
      videoGenModel: entry.videoGenModel,
      score: 0,
      costEfficiencyScore: 50,
      processingSpeedScore: 50,
      videoFileName: entry.videoFileName,
      videoExists,
      artifactFileSize: videoExists ? Bun.file(videoPath).size : null,
      metadataFileSize: nullableNumber(entry.videoFileSize),
      videoDurationSeconds: nullableNumber(entry.videoDuration),
      processingTimeMs,
      costCents,
      qualityScore: quality?.qualityScore ?? null,
      humanQualityScore: quality?.humanQualityScore ?? null,
    });
  }

  const costValues = providerData.map((p) => p.costCents).filter(isFiniteNumber);
  const timingValues = providerData.map((p) => p.processingTimeMs).filter(isFiniteNumber);

  for (const provider of providerData) {
    provider.costEfficiencyScore = normalizeLowerIsBetter(provider.costCents, costValues);
    provider.processingSpeedScore = normalizeLowerIsBetter(provider.processingTimeMs, timingValues);
    provider.score = (provider.costEfficiencyScore * 0.5) + (provider.processingSpeedScore * 0.5);
  }

  const ranked: RankedProvider[] = [...providerData]
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      if (left.costEfficiencyScore !== right.costEfficiencyScore) return right.costEfficiencyScore - left.costEfficiencyScore;
      if (left.processingSpeedScore !== right.processingSpeedScore) return right.processingSpeedScore - left.processingSpeedScore;
      return left.providerKey.localeCompare(right.providerKey);
    })
    .map((provider, index) => ({ ...provider, rank: index + 1 }));

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

  notes.push("Ranking used price-speed scoring: cost efficiency (50%) and processing speed (50%).");
  if (ranked.some((p) => p.qualityScore !== null || p.humanQualityScore !== null)) {
    notes.push("Video quality rankings use only explicit qualityScore or humanQualityScore evidence when available.");
  } else {
    notes.push("No explicit qualityScore or humanQualityScore evidence was found; video quality is not inferred from artifact metadata.");
  }
  notes.push("Video artifact existence, file size, duration, dimensions, format, and bitrate are reported as evidence only and are not used as quality proxies.");

  const scoreFormula = "50% cost-efficiency + 50% processing-speed";
  const reportJson = {
    runDir,
    metric: "price-speed",
    scoreFormula,
    weights: {
      costEfficiency: 0.5,
      processingSpeed: 0.5,
    },
    providerCount: ranked.length,
    providers: ranked,
    notes,
  };

  const headerCols = ["Rank", "Provider", "Score / 100", "Cost Score", "Speed Score", "Artifact", "File Size", "Duration", "Processing Time", "Cost"];
  const headerRow = `| ${headerCols.join(" | ")} |`;
  const separatorRow = `| ${headerCols.map(() => "---:").join(" | ")} |`;
  const rows = ranked.map((p) => {
    const cols = [
      String(p.rank),
      `\`${p.providerKey}\``,
      p.score.toFixed(2),
      p.costEfficiencyScore.toFixed(2),
      p.processingSpeedScore.toFixed(2),
      p.videoExists ? p.videoFileName : `${p.videoFileName} (missing)`,
      formatFileSize(p.artifactFileSize ?? p.metadataFileSize),
      formatDurationSeconds(p.videoDurationSeconds),
      formatProcessingSeconds(p.processingTimeMs),
      formatCents(p.costCents),
    ];
    return `| ${cols.join(" | ")} |`;
  }).join("\n");

  const rankingTable = `${headerRow}\n${separatorRow}\n${rows}`;
  const providerList = ranked.map((p) => `  - \`${p.providerKey}\``).join("\n");
  const notesBlock = notes.map((note) => `- ${note}`).join("\n");

  const markdown = `# Video Provider Comparison Report

## Summary

- Total providers: ${ranked.length}
- Scoring method: price-speed (cost + speed)
- Score formula: \`${scoreFormula}\`

## Method

- Each provider in \`metadata.video[]\` was evaluated from one AutoShow video run directory.
- Cost and processing time were extracted from \`run.json\` metadata.
- Ranking uses price-speed scoring: 50% cost efficiency and 50% processing speed.
- Lower cost and lower processing time are better; missing cost or timing receives a neutral component score of 50.
- If all available values for a metric are equal, providers with that metric receive 100 for that component.
- Explicit qualityScore and humanQualityScore values are retained for grouped quality rankings when available.
- Artifact existence, file size, duration, dimensions, format, and bitrate are reported for context only and are not used as quality proxies.

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
