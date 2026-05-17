#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import {
  characterErrorRateDetailed,
  clamp01,
  contentTokenCoverage,
  formatCents,
  formatPercent,
  formatSeconds,
  isLocalUrlProvider,
  loadUrlProviderRuns,
  markdownToPlainText,
  wordErrorRateDetailed,
} from "./url_consensus_lib.ts";

interface ParsedArgs {
  runDir: string;
  consensusPath: string | null;
  markdownOut: string | null;
  jsonOut: string | null;
}

type ProviderGroup = "local" | "hosted";
type TierNumber = 1 | 2 | 3;

interface OverallComponents {
  accuracy: {
    score: number;
    source: "wer-cer-coverage";
    wer: number;
    cer: number;
    contentCoverage: number;
  };
  processingSpeed: {
    score: number;
    source: "processing-time" | "missing-timing";
    processingTimeMs: number | null;
  };
  costEfficiency: {
    score: number;
    source: "local-zero-cost" | "reported-cost" | "missing-hosted-cost";
    costCents: number | null;
  };
}

interface ProviderScore {
  provider: string;
  model: string;
  providerKey: string;
  group: ProviderGroup;
  directoryName: string;
  rank: number;
  groupRank: number;
  overallRank: number;
  overallScore: number;
  groupTier: TierNumber;
  wer: number;
  cer: number;
  contentCoverage: number;
  accuracyScore: number;
  wordBreakdown: {
    substitutions: number;
    deletions: number;
    insertions: number;
    referenceCount: number;
  };
  characterBreakdown: {
    substitutions: number;
    deletions: number;
    insertions: number;
    referenceCount: number;
  };
  tokenEstimate: number | null;
  processingTimeMs: number | null;
  actualCostCents: number | null;
  overallComponents: OverallComponents;
}

const OVERALL_WEIGHTS = {
  accuracy: 0.5,
  processingSpeed: 0.25,
  costEfficiency: 0.25,
} as const;

function helpText(): string {
  return [
    "Usage: bun build_comparison_report.ts <run_dir> [--consensus <path>] [--markdown-out <path>] [--json-out <path>]",
    "",
    "Generate URL provider comparison reports from a consensus extraction.",
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    process.exit(0);
  }

  const positional: string[] = [];
  let consensusPath: string | null = null;
  let markdownOut: string | null = null;
  let jsonOut: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--consensus") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --consensus");
      consensusPath = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--markdown-out") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --markdown-out");
      markdownOut = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--json-out") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --json-out");
      jsonOut = resolve(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) throw new Error(`Unknown flag: ${arg}`);
    positional.push(arg);
  }

  const runDir = positional[0];
  if (!runDir) throw new Error(helpText());
  return { runDir: resolve(runDir), consensusPath, markdownOut, jsonOut };
}

function lowerIsBetterScore(value: number | null, values: number[], missingScore: number): number {
  if (value === null || !Number.isFinite(value)) return missingScore;
  if (values.length === 0) return 1;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 1;
  return clamp01(1 - ((value - min) / (max - min)));
}

function assignTiers(scores: ProviderScore[]): Map<string, TierNumber> {
  const sorted = scores.slice().sort((left, right) =>
    right.overallScore - left.overallScore || left.providerKey.localeCompare(right.providerKey)
  );
  const tiers = new Map<string, TierNumber>();
  if (sorted.length === 0) return tiers;

  const tierSize = Math.max(1, Math.ceil(sorted.length / 3));
  sorted.forEach((score, index) => {
    const tier = Math.min(3, Math.floor(index / tierSize) + 1) as TierNumber;
    tiers.set(score.providerKey, tier);
  });
  return tiers;
}

function buildScores(consensusText: string, runDir: string): ProviderScore[] {
  const providers = loadUrlProviderRuns(runDir);
  const timingValues = providers
    .map((provider) => provider.processingTimeMs)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const hostedCostValues = providers
    .filter((provider) => !isLocalUrlProvider(provider.provider))
    .map((provider) => provider.actualCostCents)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const initial = providers.map((provider) => {
    const group: ProviderGroup = isLocalUrlProvider(provider.provider) ? "local" : "hosted";
    const wer = wordErrorRateDetailed(consensusText, provider.text);
    const cer = characterErrorRateDetailed(consensusText, provider.text);
    const contentCoverage = contentTokenCoverage(consensusText, provider.text);
    const accuracyScore = clamp01((1 - wer.rate) * 0.5 + (1 - cer.rate) * 0.25 + contentCoverage * 0.25);
    const speedScore = lowerIsBetterScore(provider.processingTimeMs, timingValues, 0);
    const costScore = group === "local"
      ? 1
      : lowerIsBetterScore(provider.actualCostCents, hostedCostValues, 0);
    const overallScore = clamp01(
      accuracyScore * OVERALL_WEIGHTS.accuracy
      + speedScore * OVERALL_WEIGHTS.processingSpeed
      + costScore * OVERALL_WEIGHTS.costEfficiency,
    );

    return {
      provider: provider.provider,
      model: provider.model,
      providerKey: provider.providerKey,
      group,
      directoryName: provider.directoryName,
      rank: 0,
      groupRank: 0,
      overallRank: 0,
      overallScore,
      groupTier: 3 as TierNumber,
      wer: wer.rate,
      cer: cer.rate,
      contentCoverage,
      accuracyScore,
      wordBreakdown: {
        substitutions: wer.substitutions,
        deletions: wer.deletions,
        insertions: wer.insertions,
        referenceCount: wer.referenceCount,
      },
      characterBreakdown: {
        substitutions: cer.substitutions,
        deletions: cer.deletions,
        insertions: cer.insertions,
        referenceCount: cer.referenceCount,
      },
      tokenEstimate: provider.tokenEstimate,
      processingTimeMs: provider.processingTimeMs,
      actualCostCents: provider.actualCostCents,
      overallComponents: {
        accuracy: {
          score: accuracyScore,
          source: "wer-cer-coverage",
          wer: wer.rate,
          cer: cer.rate,
          contentCoverage,
        },
        processingSpeed: {
          score: speedScore,
          source: provider.processingTimeMs === null ? "missing-timing" : "processing-time",
          processingTimeMs: provider.processingTimeMs,
        },
        costEfficiency: {
          score: costScore,
          source: group === "local"
            ? "local-zero-cost"
            : provider.actualCostCents === null
              ? "missing-hosted-cost"
              : "reported-cost",
          costCents: provider.actualCostCents,
        },
      },
    } satisfies ProviderScore;
  });

  const overall = initial.slice().sort((left, right) =>
    right.overallScore - left.overallScore || left.wer - right.wer || left.providerKey.localeCompare(right.providerKey)
  );
  overall.forEach((score, index) => {
    score.overallRank = index + 1;
  });

  const accuracyRanked = initial.slice().sort((left, right) =>
    left.wer - right.wer || left.cer - right.cer || right.contentCoverage - left.contentCoverage || left.providerKey.localeCompare(right.providerKey)
  );
  accuracyRanked.forEach((score, index) => {
    score.rank = index + 1;
  });

  for (const group of ["local", "hosted"] as const) {
    const groupScores = initial
      .filter((score) => score.group === group)
      .sort((left, right) => right.overallScore - left.overallScore || left.providerKey.localeCompare(right.providerKey));
    const tiers = assignTiers(groupScores);
    groupScores.forEach((score, index) => {
      score.groupRank = index + 1;
      score.groupTier = tiers.get(score.providerKey) ?? 3;
    });
  }

  return initial.sort((left, right) => left.overallRank - right.overallRank);
}

function markdownTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function providerRows(scores: ProviderScore[], includeCost: boolean): string[][] {
  return scores.map((score) => [
    String(score.overallRank),
    score.provider,
    formatPercent(score.wer),
    formatPercent(score.cer),
    formatPercent(score.contentCoverage),
    formatSeconds(score.processingTimeMs),
    ...(includeCost ? [formatCents(score.actualCostCents)] : []),
    score.overallScore.toFixed(4),
    `Tier ${score.groupTier}`,
  ]);
}

function buildMarkdownReport(runDir: string, consensusPath: string, scores: ProviderScore[]): string {
  const localScores = scores.filter((score) => score.group === "local").sort((left, right) => left.groupRank - right.groupRank);
  const hostedScores = scores.filter((score) => score.group === "hosted").sort((left, right) => left.groupRank - right.groupRank);
  const best = scores[0];
  const worst = scores.at(-1);
  const notes: string[] = [];
  if (scores.some((score) => score.processingTimeMs === null)) notes.push("Some providers are missing timing data.");
  if (hostedScores.some((score) => score.actualCostCents === null)) notes.push("Some hosted providers are missing actual cost data.");

  return [
    "# URL Provider Comparison Report",
    "",
    `Run directory: \`${runDir}\``,
    `Consensus extraction: \`${consensusPath}\``,
    `Providers scored: ${scores.length}`,
    ...(best ? [`Best overall: ${best.provider} (${best.overallScore.toFixed(4)})`] : []),
    ...(worst ? [`Worst overall: ${worst.provider} (${worst.overallScore.toFixed(4)})`] : []),
    "",
    "## Overall Ranking",
    "",
    markdownTable(
      ["Rank", "Provider", "WER", "CER", "Coverage", "Time", "Cost", "Overall", "Tier"],
      providerRows(scores, true),
    ),
    "",
    "## Local Providers",
    "",
    localScores.length > 0
      ? markdownTable(["Rank", "Provider", "WER", "CER", "Coverage", "Time", "Overall", "Tier"], providerRows(localScores, false))
      : "No local providers were scored.",
    "",
    "## Hosted Providers",
    "",
    hostedScores.length > 0
      ? markdownTable(["Rank", "Provider", "WER", "CER", "Coverage", "Time", "Cost", "Overall", "Tier"], providerRows(hostedScores, true))
      : "No hosted providers were scored.",
    "",
    "## Tier Breakdown",
    "",
    ...([1, 2, 3] as const).map((tier) => {
      const tierProviders = scores.filter((score) => score.groupTier === tier).map((score) => score.provider).join(", ") || "None";
      return `Tier ${tier}: ${tierProviders}`;
    }),
    "",
    "## Notes",
    "",
    notes.length > 0 ? notes.map((note) => `- ${note}`).join("\n") : "No missing cost or timing data detected.",
    "",
  ].join("\n");
}

function buildTiering(scores: ProviderScore[]): Record<ProviderGroup, Record<string, string[]>> {
  const result: Record<ProviderGroup, Record<string, string[]>> = {
    local: { tier1: [], tier2: [], tier3: [] },
    hosted: { tier1: [], tier2: [], tier3: [] },
  };
  for (const score of scores) {
    result[score.group][`tier${score.groupTier}`]?.push(score.providerKey);
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));
const consensusPath = args.consensusPath ?? resolve(args.runDir, "consensus-extraction.txt");
if (!existsSync(consensusPath)) {
  throw new Error(`Consensus extraction not found: ${consensusPath}`);
}

const consensusText = markdownToPlainText(readFileSync(consensusPath, "utf8"));
const scores = buildScores(consensusText, args.runDir);
const markdownOut = args.markdownOut ?? resolve(args.runDir, "provider-comparison-report.md");
const jsonOut = args.jsonOut ?? resolve(args.runDir, "provider-comparison-report.json");
const markdownReport = buildMarkdownReport(args.runDir, consensusPath, scores);
const jsonReport = {
  schemaVersion: 1,
  kind: "url-provider-comparison",
  runDir: args.runDir,
  runName: basename(args.runDir),
  consensusPath,
  generatedAt: new Date().toISOString(),
  providerCount: scores.length,
  overallMetric: "balanced-url-extraction",
  overallWeights: OVERALL_WEIGHTS,
  providers: scores,
  overall: scores.map((score) => ({
    rank: score.overallRank,
    provider: score.provider,
    model: score.model,
    providerKey: score.providerKey,
    group: score.group,
    overallScore: score.overallScore,
    overallComponents: score.overallComponents,
  })),
  tiering: {
    metric: "balanced-url-extraction",
    method: "equal-thirds-by-provider-group",
    groups: buildTiering(scores),
  },
};

writeFileSync(markdownOut, markdownReport);
writeFileSync(jsonOut, `${JSON.stringify(jsonReport, null, 2)}\n`);

console.log(`Wrote ${markdownOut}`);
console.log(`Wrote ${jsonOut}`);
