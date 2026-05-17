#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import {
  buildCostLookup,
  buildTimingLookup,
  computeSpeakingRate,
  discoverAudioFiles,
  formatCents,
  formatProcessingSeconds,
  isLocalService,
  loadTtsRunJson,
  makeProviderKey,
  probeAudio,
  roundtripWer,
  tokenize,
} from "./tts_eval_lib.ts";

interface ParsedArgs {
  runDir: string;
  inputTextPath: string;
  roundtripDir: string | null;
  markdownOut: string | null;
  jsonOut: string | null;
}

function helpText(): string {
  return [
    "Usage: bun build_comparison_report.ts <run_dir> --input-text <path> [--roundtrip-dir <path>] [--markdown-out <path>] [--json-out <path>]",
    "",
    "Generate TTS provider comparison reports with optional roundtrip STT scoring.",
    "",
    "Options:",
    "  --input-text <path>      Path to the original input text file",
    "  --roundtrip-dir <path>   Directory containing roundtrip STT transcriptions ({audioFileName}.txt)",
    "  --markdown-out <path>    Write markdown report to <path> (default: <run_dir>/provider-comparison-report.md)",
    "  --json-out <path>        Write JSON report to <path> (default: <run_dir>/provider-comparison-report.json)",
    "  --help, -h               Show this help message",
    "",
    "Examples:",
    "  bun build_comparison_report.ts ./runs/my-tts-run --input-text ./input.txt",
    "  bun build_comparison_report.ts ./runs/my-tts-run --input-text ./input.txt --roundtrip-dir ./roundtrip",
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    process.exit(0);
  }

  const positional: string[] = [];
  let inputTextPath: string | null = null;
  let roundtripDir: string | null = null;
  let markdownOut: string | null = null;
  let jsonOut: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input-text") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --input-text");
      }
      inputTextPath = value;
      index += 1;
      continue;
    }
    if (arg === "--roundtrip-dir") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --roundtrip-dir");
      }
      roundtripDir = value;
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
      "Usage: bun build_comparison_report.ts <run_dir> --input-text <path> [--roundtrip-dir <path>] [--markdown-out <path>] [--json-out <path>]",
    );
  }
  if (!inputTextPath) {
    throw new Error("--input-text is required");
  }

  return {
    runDir: resolve(runDir),
    inputTextPath: resolve(inputTextPath),
    roundtripDir: roundtripDir ? resolve(roundtripDir) : null,
    markdownOut,
    jsonOut,
  };
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function joinProviderNames(providers: Array<{ providerKey: string }>): string {
  const names = providers.map((p) => `\`${p.providerKey}\``);
  if (names.length === 0) {
    return "";
  }
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
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

function addOverallScores(providers: ProviderData[]): OverallScoredProvider[] {
  const timingValues = providers.map((provider) => provider.processingTimeMs).filter(isFiniteNumber);
  const costValues = providers
    .map((provider) => isLocalService(provider.ttsService) ? 0 : provider.costCents)
    .filter(isFiniteNumber);

  const withComponents = providers.map((provider) => {
    const costCents = isLocalService(provider.ttsService) ? 0 : provider.costCents;
    const costSource = isLocalService(provider.ttsService)
      ? "local-zero-cost"
      : provider.costCents === null
        ? "missing-cloud-cost"
        : "reported-cost";
    const accuracyScore = provider.roundtripWER !== null ? Math.max(0, 100 * (1 - provider.roundtripWER)) : 50;
    const overallComponents: OverallComponents = {
      accuracy: {
        score: accuracyScore,
        source: provider.roundtripWER !== null ? "roundtrip-wer" : "missing-roundtrip-accuracy",
      },
      processingSpeed: {
        score: normalizeLowerIsBetter(provider.processingTimeMs, timingValues),
        source: provider.processingTimeMs === null ? "missing-timing" : "processing-time",
        processingTimeMs: provider.processingTimeMs,
      },
      costEfficiency: {
        score: normalizeLowerIsBetter(costCents, costValues),
        source: costSource,
        costCents,
      },
    };
    const overallScore =
      overallComponents.accuracy.score * OVERALL_WEIGHTS.accuracy +
      overallComponents.processingSpeed.score * OVERALL_WEIGHTS.processingSpeed +
      overallComponents.costEfficiency.score * OVERALL_WEIGHTS.costEfficiency;
    return {
      ...provider,
      overallScore,
      overallComponents,
    };
  });

  const overallRanks = new Map<string, number>();
  [...withComponents]
    .sort((left, right) => {
      if (left.overallScore !== right.overallScore) {
        return right.overallScore - left.overallScore;
      }
      if (left.overallComponents.accuracy.score !== right.overallComponents.accuracy.score) {
        return right.overallComponents.accuracy.score - left.overallComponents.accuracy.score;
      }
      if (left.overallComponents.processingSpeed.score !== right.overallComponents.processingSpeed.score) {
        return right.overallComponents.processingSpeed.score - left.overallComponents.processingSpeed.score;
      }
      if (left.overallComponents.costEfficiency.score !== right.overallComponents.costEfficiency.score) {
        return right.overallComponents.costEfficiency.score - left.overallComponents.costEfficiency.score;
      }
      return left.providerKey.localeCompare(right.providerKey);
    })
    .forEach((provider, index) => {
      overallRanks.set(provider.providerKey, index + 1);
    });

  return withComponents.map((provider) => ({
    ...provider,
    overallRank: overallRanks.get(provider.providerKey) ?? 0,
  }));
}

type ProviderGroup = "local" | "cloud";
type TierGroupName = "local" | "thirdParty";

interface RankedProvider {
  rank: number;
  group: ProviderGroup;
  providerKey: string;
  ttsService: string;
  ttsModel: string;
  speaker: string | null;
  score: number;
  roundtripWER: number | null;
  speakingRateCharsPerSec: number | null;
  durationSeconds: number | null;
  processingTimeMs: number | null;
  costCents: number | null;
  audioFileSize: number;
  audioFileName: string;
  overallRank: number;
  overallScore: number;
  overallComponents: OverallComponents;
  tierGroup: TierGroupName;
  groupOverallRank: number;
  groupTier: TierNumber;
}

interface OverallComponents {
  accuracy: {
    score: number;
    source: "roundtrip-wer" | "missing-roundtrip-accuracy";
  };
  processingSpeed: {
    score: number;
    source: "processing-time" | "missing-timing";
    processingTimeMs: number | null;
  };
  costEfficiency: {
    score: number;
    source: "local-zero-cost" | "reported-cost" | "missing-cloud-cost";
    costCents: number | null;
  };
}

const OVERALL_WEIGHTS = {
  accuracy: 0.5,
  processingSpeed: 0.25,
  costEfficiency: 0.25,
} as const;

const TIER_METRIC = "balanced-overall";
const TIER_REMAINDER_POLICY = "bottom-tier-extra";
const TIER_METHOD = "equal-thirds-by-group-overall-rank";
const TIER_DESCRIPTIONS = {
  1: "Best balanced options across accuracy, processing speed, and cost efficiency.",
  2: "Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.",
  3: "Lowest balanced options, generally weaker across the combined benchmark categories.",
} as const;

type TierNumber = 1 | 2 | 3;

interface TierCounts {
  tier1: number;
  tier2: number;
  tier3: number;
}

interface TierRankRange {
  start: number | null;
  end: number | null;
}

interface TierBreakdownProvider {
  providerKey: string;
  tierGroup: TierGroupName;
  groupOverallRank: number;
  groupTier: TierNumber;
  overallRank: number;
  overallScore: number;
  overallComponents: OverallComponents;
}

interface TierBreakdown {
  tier: TierNumber;
  label: string;
  description: string;
  rankRange: TierRankRange;
  count: number;
  providers: TierBreakdownProvider[];
}

interface TierGroup {
  count: number;
  counts: TierCounts;
  tiers: TierBreakdown[];
}

interface Tiering {
  metric: typeof TIER_METRIC;
  method: typeof TIER_METHOD;
  remainderPolicy: typeof TIER_REMAINDER_POLICY;
  groups: Record<TierGroupName, TierGroup>;
}

interface TierAnnotation {
  tierGroup: TierGroupName;
  groupOverallRank: number;
  groupTier: TierNumber;
}

type RankedProviderWithoutTier = Omit<RankedProvider, "tierGroup" | "groupOverallRank" | "groupTier">;
type ProviderData = Omit<RankedProviderWithoutTier, "rank" | "overallRank" | "overallScore" | "overallComponents">;
type OverallScoredProvider = ProviderData & Pick<RankedProvider, "overallRank" | "overallScore" | "overallComponents">;

// Natural speaking rate for English: ~120-180 chars/sec
// Deviation from midpoint (150 c/s) is penalized
const NATURAL_RATE_MID = 150;
const NATURAL_RATE_RANGE = 30;

function speakingRateScore(rate: number | null): number {
  if (rate === null || rate <= 0) {
    return 0;
  }
  const deviation = Math.abs(rate - NATURAL_RATE_MID) / NATURAL_RATE_RANGE;
  return Math.max(0, 1 - deviation * 0.5);
}

function tierCountsForProviderCount(count: number): TierCounts {
  if (count <= 0) {
    return { tier1: 0, tier2: 0, tier3: 0 };
  }
  if (count === 1) {
    return { tier1: 1, tier2: 0, tier3: 0 };
  }
  if (count === 2) {
    return { tier1: 1, tier2: 1, tier3: 0 };
  }
  const base = Math.floor(count / 3);
  return {
    tier1: base,
    tier2: base,
    tier3: count - base * 2,
  };
}

function tierCountForNumber(counts: TierCounts, tier: TierNumber): number {
  if (tier === 1) {
    return counts.tier1;
  }
  if (tier === 2) {
    return counts.tier2;
  }
  return counts.tier3;
}

function tierGroupForProviderGroup(group: ProviderGroup): TierGroupName {
  return group === "local" ? "local" : "thirdParty";
}

function buildTierGroup<T extends Omit<TierBreakdownProvider, keyof TierAnnotation>>(
  tierGroup: TierGroupName,
  rankedProviders: T[],
): { group: TierGroup; providerAnnotations: Map<string, TierAnnotation> } {
  const counts = tierCountsForProviderCount(rankedProviders.length);
  const providerAnnotations = new Map<string, TierAnnotation>();
  const tiers: TierBreakdown[] = [];
  let nextRank = 1;

  for (const tier of [1, 2, 3] as const) {
    const count = tierCountForNumber(counts, tier);
    const start = count > 0 ? nextRank : null;
    const end = count > 0 ? nextRank + count - 1 : null;
    const providers = rankedProviders
      .slice(nextRank - 1, nextRank - 1 + count)
      .map((provider, index) => {
        const groupOverallRank = nextRank + index;
        const annotation = { tierGroup, groupOverallRank, groupTier: tier };
        providerAnnotations.set(provider.providerKey, annotation);
        return {
          providerKey: provider.providerKey,
          ...annotation,
          overallRank: provider.overallRank,
          overallScore: provider.overallScore,
          overallComponents: provider.overallComponents,
        };
      });

    tiers.push({
      tier,
      label: `Tier ${tier}`,
      description: TIER_DESCRIPTIONS[tier],
      rankRange: { start, end },
      count,
      providers,
    });
    nextRank += count;
  }

  return { group: { count: rankedProviders.length, counts, tiers }, providerAnnotations };
}

function buildTiering<T extends Omit<TierBreakdownProvider, keyof TierAnnotation> & { group: ProviderGroup }>(
  rankedOverall: T[],
): {
  tiering: Tiering;
  providerAnnotations: Map<string, TierAnnotation>;
} {
  const local = buildTierGroup(
    "local",
    rankedOverall.filter((provider) => tierGroupForProviderGroup(provider.group) === "local"),
  );
  const thirdParty = buildTierGroup(
    "thirdParty",
    rankedOverall.filter((provider) => tierGroupForProviderGroup(provider.group) === "thirdParty"),
  );
  const providerAnnotations = new Map<string, TierAnnotation>([
    ...local.providerAnnotations,
    ...thirdParty.providerAnnotations,
  ]);
  const tiering: Tiering = {
    metric: TIER_METRIC,
    method: TIER_METHOD,
    remainderPolicy: TIER_REMAINDER_POLICY,
    groups: {
      local: local.group,
      thirdParty: thirdParty.group,
    },
  };
  return { tiering, providerAnnotations };
}

function addTierAnnotations(
  rankedProviders: RankedProviderWithoutTier[],
  providerAnnotations: Map<string, TierAnnotation>,
): RankedProvider[] {
  return rankedProviders.map((provider) => ({
    ...provider,
    ...(providerAnnotations.get(provider.providerKey) ?? {
      tierGroup: tierGroupForProviderGroup(provider.group),
      groupOverallRank: 0,
      groupTier: 3,
    }),
  }));
}

function formatRankRange(range: TierRankRange): string {
  if (range.start === null || range.end === null) {
    return "no group ranks";
  }
  if (range.start === range.end) {
    return `group rank ${range.start}`;
  }
  return `group ranks ${range.start}-${range.end}`;
}

function formatTierGroupName(group: TierGroupName): string {
  return group === "local" ? "Local" : "Third-Party";
}

export async function buildReport(
  runDir: string,
  inputTextPath: string,
  roundtripDir: string | null,
) {
  const runJson = loadTtsRunJson(runDir);
  const inputText = readFileSync(inputTextPath, "utf8").trim();
  const charCount = inputText.length;
  const wordCount = tokenize(inputText).length;
  const warnings: string[] = [];

  const { found, missing } = discoverAudioFiles(runDir, runJson.metadata.tts);
  if (missing.length > 0) {
    warnings.push(`Missing audio files: ${missing.join(", ")}`);
  }

  const costLookup = buildCostLookup(runJson);
  const timingLookup = buildTimingLookup(runJson);
  const hasRoundtrip = roundtripDir !== null;

  const providerData: ProviderData[] = [];

  for (const entry of runJson.metadata.tts) {
    const providerKey = makeProviderKey(entry.ttsService, entry.ttsModel);
    const audioPath = found.get(providerKey);

    let durationSeconds: number | null = null;
    if (audioPath) {
      try {
        const props = await probeAudio(audioPath);
        durationSeconds = props.durationSeconds;
      } catch {
        warnings.push(`ffprobe failed for ${entry.audioFileName}`);
      }
    }

    const speakingRate = durationSeconds !== null ? computeSpeakingRate(charCount, durationSeconds) : null;
    const costCents = costLookup.get(providerKey) ?? null;
    const processingTimeMs = timingLookup.get(providerKey) ?? (isFiniteNumber(entry.processingTime) ? entry.processingTime : null);

    let wer: number | null = null;
    if (hasRoundtrip) {
      const roundtripPath = join(roundtripDir!, `${entry.audioFileName}.txt`);
      if (existsSync(roundtripPath)) {
        const transcribed = readFileSync(roundtripPath, "utf8").trim();
        wer = roundtripWer(inputText, transcribed);
      } else {
        warnings.push(`No roundtrip transcription found for ${entry.audioFileName}`);
      }
    }

    let score: number;
    if (wer !== null) {
      score = Math.max(0, 100 * (1 - wer));
    } else {
      // Composite: 60% speaking rate naturalness, 20% cost efficiency, 20% speed
      const rateComponent = speakingRateScore(speakingRate) * 60;

      // Cost component: lower is better, normalize to 0-1 range per provider set
      const costComponent = costCents !== null && costCents === 0 ? 20 : costCents !== null ? Math.max(0, 20 * (1 - costCents / 20)) : 10;

      // Speed component: faster processing is better
      const speedComponent = processingTimeMs !== null && processingTimeMs > 0 ? Math.max(0, 20 * (1 - processingTimeMs / 60000)) : 10;

      score = rateComponent + costComponent + speedComponent;
    }

    providerData.push({
      providerKey,
      ttsService: entry.ttsService,
      ttsModel: entry.ttsModel,
      speaker: entry.speaker ?? null,
      score,
      roundtripWER: wer,
      speakingRateCharsPerSec: speakingRate,
      durationSeconds,
      processingTimeMs,
      costCents,
      audioFileSize: entry.audioFileSize,
      audioFileName: entry.audioFileName,
    });
  }

  // Partition into local and cloud groups
  const providerDataWithOverall = addOverallScores(providerData);
  const localData = providerDataWithOverall.filter((p) => isLocalService(p.ttsService));
  const cloudData = providerDataWithOverall.filter((p) => !isLocalService(p.ttsService));

  function rankGroup(group: OverallScoredProvider[], groupLabel: ProviderGroup): RankedProviderWithoutTier[] {
    return [...group]
      .sort((left, right) => {
        if (left.roundtripWER !== null && right.roundtripWER !== null) {
          if (left.roundtripWER !== right.roundtripWER) {
            return left.roundtripWER - right.roundtripWER;
          }
        }
        if (left.score !== right.score) {
          return right.score - left.score;
        }
        return left.providerKey.localeCompare(right.providerKey);
      })
      .map((provider, index) => ({ ...provider, group: groupLabel, rank: index + 1 }));
  }

  const rankedLocal = rankGroup(localData, "local");
  const rankedCloud = rankGroup(cloudData, "cloud");
  const allRankedWithoutTiers = [...rankedLocal, ...rankedCloud];
  const rankedOverallWithoutTiers = [...allRankedWithoutTiers].sort((left, right) => {
    if (left.overallRank !== right.overallRank) {
      return left.overallRank - right.overallRank;
    }
    return left.providerKey.localeCompare(right.providerKey);
  });
  const { tiering, providerAnnotations } = buildTiering(rankedOverallWithoutTiers);
  const rankedLocalWithTiers = addTierAnnotations(rankedLocal, providerAnnotations);
  const rankedCloudWithTiers = addTierAnnotations(rankedCloud, providerAnnotations);
  const allRanked = [...rankedLocalWithTiers, ...rankedCloudWithTiers];
  const rankedOverall = addTierAnnotations(rankedOverallWithoutTiers, providerAnnotations);

  const scoringMethod = hasRoundtrip && allRanked.some((p) => p.roundtripWER !== null)
    ? "roundtrip-wer"
    : "composite";

  const notes: string[] = [];

  const bestOverall = rankedOverall[0];
  const worstOverall = rankedOverall.at(-1);
  if (bestOverall) {
    notes.push(
      `Best overall provider: \`${bestOverall.providerKey}\` scored ${bestOverall.overallScore.toFixed(2)}/100 using balanced overall weighting.`,
    );
  }
  if (worstOverall) {
    notes.push(
      `Worst overall provider: \`${worstOverall.providerKey}\` scored ${worstOverall.overallScore.toFixed(2)}/100 using balanced overall weighting.`,
    );
  }

  if (rankedLocalWithTiers.length > 0 && rankedLocalWithTiers[0]) {
    notes.push(
      `Best local model: \`${rankedLocalWithTiers[0].providerKey}\` scored ${rankedLocalWithTiers[0].score.toFixed(2)}/100.`,
    );
  }
  if (rankedCloudWithTiers.length > 0 && rankedCloudWithTiers[0]) {
    notes.push(
      `Best cloud service: \`${rankedCloudWithTiers[0].providerKey}\` scored ${rankedCloudWithTiers[0].score.toFixed(2)}/100.`,
    );
  }

  const cloudWithCost = rankedCloudWithTiers.filter((p) => p.costCents !== null);
  if (cloudWithCost.length > 0) {
    const cheapestCost = Math.min(...cloudWithCost.map((p) => p.costCents as number));
    const cheapestProviders = cloudWithCost.filter((p) => p.costCents === cheapestCost);
    const subject = cheapestProviders.length === 1 ? "provider was" : "providers were";
    notes.push(
      `The cheapest cloud ${subject} ${joinProviderNames(cheapestProviders)} at ${formatCents(cheapestCost)}.`,
    );
  }

  const allWithTime = allRanked.filter((p) => p.processingTimeMs !== null && p.processingTimeMs > 0);
  if (allWithTime.length > 0) {
    const fastestLocal = rankedLocalWithTiers.length > 0
      ? [...rankedLocalWithTiers].sort((a, b) => (a.processingTimeMs ?? Infinity) - (b.processingTimeMs ?? Infinity))[0]
      : null;
    const fastestCloud = rankedCloudWithTiers.length > 0
      ? [...rankedCloudWithTiers].sort((a, b) => (a.processingTimeMs ?? Infinity) - (b.processingTimeMs ?? Infinity))[0]
      : null;
    if (fastestLocal) {
      notes.push(
        `Fastest local model: \`${fastestLocal.providerKey}\` at ${formatProcessingSeconds(fastestLocal.processingTimeMs)}.`,
      );
    }
    if (fastestCloud) {
      notes.push(
        `Fastest cloud service: \`${fastestCloud.providerKey}\` at ${formatProcessingSeconds(fastestCloud.processingTimeMs)}.`,
      );
    }
  }

  if (scoringMethod === "composite") {
    notes.push(
      "No roundtrip STT data was available. Existing local/cloud ranking used a composite of speaking rate naturalness (60%), cost (20%), and speed (20%); overall ranking used neutral 50/100 accuracy components for providers without roundtrip data.",
    );
  }

  // Build reports
  const scoreFormula = scoringMethod === "roundtrip-wer"
    ? "max(0, 100 * (1 - roundtripWER))"
    : "composite: 60% speaking-rate-naturalness + 20% cost + 20% speed";

  const reportJson = {
    runDir,
    inputTextPath,
    inputTextCharCount: charCount,
    inputTextWordCount: wordCount,
    metric: scoringMethod,
    scoreFormula,
    overallMetric: "balanced-overall",
    overallWeights: OVERALL_WEIGHTS,
    tiering,
    overall: { count: rankedOverall.length, providers: rankedOverall },
    local: { count: rankedLocalWithTiers.length, providers: rankedLocalWithTiers },
    cloud: { count: rankedCloudWithTiers.length, providers: rankedCloudWithTiers },
    notes,
  };

  const hasWerColumn = allRanked.some((p) => p.roundtripWER !== null);

  function buildOverallRankingTable(providers: RankedProvider[]): string {
    const headerCols = ["Rank", "Provider", "Group", "Group Rank", "Group Tier", "Overall / 100", "Accuracy", "Speed", "Cost"];
    const headerRow = `| ${headerCols.join(" | ")} |`;
    const separatorRow = `| ${headerCols.map(() => "---:").join(" | ")} |`;
    const rows = providers
      .map((p) => {
        const cols = [
          String(p.overallRank),
          `\`${p.providerKey}\``,
          p.group,
          String(p.groupOverallRank),
          String(p.groupTier),
          p.overallScore.toFixed(2),
          p.overallComponents.accuracy.score.toFixed(2),
          p.overallComponents.processingSpeed.score.toFixed(2),
          p.overallComponents.costEfficiency.score.toFixed(2),
        ];
        return `| ${cols.join(" | ")} |`;
      })
      .join("\n");
    return `${headerRow}\n${separatorRow}\n${rows}`;
  }

  function buildRankingTable(providers: RankedProvider[], includeCost: boolean): string {
    const headerCols = ["Rank", "Provider", "Score / 100"];
    if (hasWerColumn) {
      headerCols.push("Roundtrip WER");
    }
    headerCols.push("Speaking Rate", "Duration", "Processing Time");
    if (includeCost) {
      headerCols.push("Cost");
    }
    const headerRow = `| ${headerCols.join(" | ")} |`;
    const separatorRow = `| ${headerCols.map(() => "---:").join(" | ")} |`;
    const rows = providers
      .map((p) => {
        const cols = [
          String(p.rank),
          `\`${p.providerKey}\``,
          p.score.toFixed(2),
        ];
        if (hasWerColumn) {
          cols.push(p.roundtripWER !== null ? percentage(p.roundtripWER) : "n/a");
        }
        cols.push(
          p.speakingRateCharsPerSec !== null ? `${p.speakingRateCharsPerSec.toFixed(1)} c/s` : "n/a",
          p.durationSeconds !== null ? `${p.durationSeconds.toFixed(2)}s` : "n/a",
          formatProcessingSeconds(p.processingTimeMs),
        );
        if (includeCost) {
          cols.push(formatCents(p.costCents));
        }
        return `| ${cols.join(" | ")} |`;
      })
      .join("\n");
    return `${headerRow}\n${separatorRow}\n${rows}`;
  }

  function buildTierBreakdownBlock(groups: Tiering["groups"]): string {
    return [
      "Tiers split local and third-party balanced overall rankings separately. When a group count is not divisible by three, the remainder is assigned to Tier 3 for that group.",
      "",
      ...(["local", "thirdParty"] as const).flatMap((groupName) => {
        const group = groups[groupName];
        return [
          `### ${formatTierGroupName(groupName)} Group (${group.count})`,
          "",
          ...group.tiers.flatMap((tier) => {
            const providerRows = tier.providers
              .map(
                (provider) =>
                  `| ${provider.groupOverallRank} | ${provider.overallRank} | \`${provider.providerKey}\` | ${provider.overallScore.toFixed(2)} | ${provider.overallComponents.accuracy.score.toFixed(2)} | ${provider.overallComponents.processingSpeed.score.toFixed(2)} | ${provider.overallComponents.costEfficiency.score.toFixed(2)} |`,
              )
              .join("\n");
            return [
              `#### ${tier.label} (${formatRankRange(tier.rankRange)})`,
              "",
              tier.description,
              "",
              "| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |",
              "| ---: | ---: | --- | ---: | ---: | ---: | ---: |",
              providerRows || "| n/a | n/a | n/a | n/a | n/a | n/a | n/a |",
              "",
            ];
          }),
          "",
        ];
      }),
    ].join("\n");
  }

  const localList = rankedLocalWithTiers.map((p) => `  - \`${p.providerKey}\``).join("\n");
  const cloudList = rankedCloudWithTiers.map((p) => `  - \`${p.providerKey}\``).join("\n");
  const notesBlock = notes.map((note) => `- ${note}`).join("\n");
  const inputFileName = basename(inputTextPath);

  const methodDescription = hasWerColumn
    ? "- Roundtrip WER was computed by transcribing each provider's audio via STT and comparing against the original input text.\n- Ranking primarily uses roundtrip WER (lower is better)."
    : "- No roundtrip STT transcriptions were available.\n- Existing local/cloud ranking uses a composite score: 60% speaking rate naturalness (120-180 c/s optimal for English), 20% cost efficiency, 20% processing speed.\n- Overall ranking uses neutral 50/100 accuracy components when roundtrip WER is missing.";

  const localSection = rankedLocalWithTiers.length > 0
    ? `### Local Models (${rankedLocalWithTiers.length})

${localList}

${buildRankingTable(rankedLocalWithTiers, false)}
`
    : "";

  const cloudSection = rankedCloudWithTiers.length > 0
    ? `### Cloud Services (${rankedCloudWithTiers.length})

${cloudList}

${buildRankingTable(rankedCloudWithTiers, true)}
`
    : "";

  const markdown = `# TTS Provider Comparison Report

## Summary

- Input text: \`${inputFileName}\` (${charCount} characters, ${wordCount} words)
- Total providers: ${allRanked.length} (${rankedLocalWithTiers.length} local, ${rankedCloudWithTiers.length} cloud)
- Scoring method: ${scoringMethod === "roundtrip-wer" ? "roundtrip WER (TTS audio -> STT -> compare against original text)" : "composite (speaking rate naturalness + cost + speed)"}
- Score formula: \`${scoreFormula}\`
- Overall metric: balanced-overall (50% accuracy, 25% processing speed, 25% cost efficiency)

## Method

- Each provider in \`metadata.tts[]\` was evaluated based on its audio output.
- Audio duration was measured via ffprobe to compute speaking rate (characters per second).
- Cost and processing time were extracted from \`run.json\` metadata.
- Providers are separated into local models and cloud services for independent comparison.
- Overall ranking combines all providers using roundtrip WER accuracy when present, neutral 50/100 accuracy when missing, normalized processing speed, and normalized cost efficiency.
- Tier breakdown assigns local and third-party providers independently using balanced overall group rank.
${methodDescription}

## Overall Ranking

${buildOverallRankingTable(rankedOverall)}

## Tier Breakdown

${buildTierBreakdownBlock(tiering.groups)}

## Ranking

${localSection}${cloudSection}
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
    args.inputTextPath,
    args.roundtripDir,
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
