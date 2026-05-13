#!/usr/bin/env bun

import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import {
  computeProviderSegmentStats,
  durationSecondsFromRun,
  formatCents,
  formatProcessingSeconds,
  loadProviderRuns,
  loadRunJson,
  mapProviderSpeakers,
  normalizeText,
  parseClock,
  parseReferenceTranscript,
  wordWerDetailed,
} from "./transcript_lib.ts";

interface ParsedArgs {
  runDir: string;
  referencePath: string | null;
  markdownOut: string | null;
  jsonOut: string | null;
}

function helpText(): string {
  return [
    "Usage: bun build_reference_report.ts <run_dir> [--reference <path>] [--markdown-out <path>] [--json-out <path>]",
    "",
    "Generate comparison reports scoring each provider against a consensus transcript.",
    "",
    "Options:",
    "  --reference <path>      Path to consensus transcript (default: <run_dir>/consensus-transcription.txt)",
    "  --markdown-out <path>   Write markdown report to <path> (default: <run_dir>/reference-comparison-report.md)",
    "  --json-out <path>       Write JSON report to <path> (default: <run_dir>/reference-comparison-report.json)",
    "  --help, -h              Show this help message",
    "",
    "Examples:",
    "  bun build_reference_report.ts ./runs/my-episode",
    "  bun build_reference_report.ts ./runs/my-episode --reference /tmp/consensus.txt",
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    process.exit(0);
  }

  const positional: string[] = [];
  let referencePath: string | null = null;
  let markdownOut: string | null = null;
  let jsonOut: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--reference") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --reference");
      }
      referencePath = resolve(value);
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
      "Usage: bun build_reference_report.ts <run_dir> [--reference <path>] [--markdown-out <path>] [--json-out <path>]",
    );
  }

  return {
    runDir: resolve(runDir),
    referencePath,
    markdownOut,
    jsonOut,
  };
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function joinProviderNames(providers: Array<{ provider: string }>): string {
  const names = providers.map((provider) => `\`${provider.provider}\``);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const DEAPI_TIMESTAMP_MARKER_RE = /\[\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?\s*-\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?\s*\]/;

function unknownToSearchText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function hasDeapiTimestampMarkers(value: unknown): boolean {
  return DEAPI_TIMESTAMP_MARKER_RE.test(unknownToSearchText(value));
}

function parseTimestampMaybe(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    return parseClock(value.replace(",", "."));
  } catch {
    return null;
  }
}

function rawWhisperMaxEndSeconds(rawResponse: unknown): number | null {
  if (!isRecord(rawResponse) || !Array.isArray(rawResponse["transcription"])) {
    return null;
  }
  let maxEndSeconds: number | null = null;
  for (const entry of rawResponse["transcription"]) {
    if (!isRecord(entry) || !isRecord(entry["timestamps"])) {
      continue;
    }
    const endSeconds = parseTimestampMaybe(entry["timestamps"]["to"]);
    if (endSeconds !== null) {
      maxEndSeconds = maxEndSeconds === null ? endSeconds : Math.max(maxEndSeconds, endSeconds);
    }
  }
  return maxEndSeconds;
}

function rawGeminiLatestEndSeconds(rawResponse: unknown): number | null {
  if (!isRecord(rawResponse) || !Array.isArray(rawResponse["candidates"])) {
    return null;
  }
  for (const candidate of rawResponse["candidates"]) {
    if (!isRecord(candidate) || !isRecord(candidate["content"]) || !Array.isArray(candidate["content"]["parts"])) {
      continue;
    }
    for (const part of candidate["content"]["parts"]) {
      if (!isRecord(part) || typeof part["text"] !== "string") {
        continue;
      }
      try {
        const payload = JSON.parse(part["text"]) as unknown;
        if (!isRecord(payload) || !Array.isArray(payload["segments"])) {
          continue;
        }
        let latestEndSeconds: number | null = null;
        for (const segment of payload["segments"]) {
          if (!isRecord(segment) || typeof segment["end"] !== "number" || !Number.isFinite(segment["end"])) {
            continue;
          }
          latestEndSeconds = latestEndSeconds === null ? segment["end"] : Math.max(latestEndSeconds, segment["end"]);
        }
        if (latestEndSeconds !== null) {
          return latestEndSeconds;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

function normalizedTextHash(text: string): string {
  return createHash("sha256").update(normalizeText(text)).digest("hex").slice(0, 16);
}

interface DuplicateGroup {
  id: string;
  normalizedTextHash: string;
  segmentCount: number;
  providers: string[];
}

function detectDuplicateGroups<T extends { provider: string; text: string; segmentStats: { segmentCount: number } }>(
  providers: T[],
): { duplicateGroups: DuplicateGroup[]; providerGroupIds: Map<string, string> } {
  const buckets = new Map<string, { hash: string; segmentCount: number; providers: string[] }>();
  for (const provider of providers) {
    const hash = normalizedTextHash(provider.text);
    const segmentCount = provider.segmentStats.segmentCount;
    const key = `${hash}:${segmentCount}`;
    const bucket = buckets.get(key) ?? { hash, segmentCount, providers: [] };
    bucket.providers.push(provider.provider);
    buckets.set(key, bucket);
  }

  const duplicateGroups = [...buckets.values()]
    .filter((bucket) => bucket.providers.length > 1)
    .sort((left, right) => left.providers[0]!.localeCompare(right.providers[0]!))
    .map((bucket, index) => ({
      id: `duplicate-${index + 1}`,
      normalizedTextHash: bucket.hash,
      segmentCount: bucket.segmentCount,
      providers: bucket.providers.sort((left, right) => left.localeCompare(right)),
    }));
  const providerGroupIds = new Map<string, string>();
  for (const group of duplicateGroups) {
    for (const provider of group.providers) {
      providerGroupIds.set(provider, group.id);
    }
  }
  return { duplicateGroups, providerGroupIds };
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

const LOCAL_STT_SERVICES = new Set(["whisper", "reverb"]);
type ProviderGroup = "local" | "cloud";
type TierGroupName = "local" | "thirdPartyDiarization" | "thirdPartyNonDiarization";
type DiarizationSupport = "supported" | "not-supported";

function buildQualityWarnings(
  provider: {
    provider: string;
    providerKey: string;
    text: string;
    rawResponse: unknown;
    segmentStats: ReturnType<typeof computeProviderSegmentStats>;
    duplicateGroupId?: string;
  },
  runDurationSeconds: number,
): string[] {
  const warnings: string[] = [];
  const service = provider.providerKey.split("/")[0]?.toLowerCase() ?? "";
  const stats = provider.segmentStats;

  if (service === "deapi") {
    if (hasDeapiTimestampMarkers(provider.text)) {
      warnings.push("deAPI transcript text still contains bracket timestamp markers.");
    } else if (hasDeapiTimestampMarkers(provider.rawResponse)) {
      warnings.push("deAPI raw response used bracket timestamp blocks; report uses cleaned parsed transcript text.");
    }
  }

  if (service === "gemini-stt") {
    const rawLatestEndSeconds = rawGeminiLatestEndSeconds(provider.rawResponse);
    const rawCoverageRatio = rawLatestEndSeconds !== null && runDurationSeconds > 0
      ? rawLatestEndSeconds / runDurationSeconds
      : null;
    if ((stats.durationCoverageRatio !== null && stats.durationCoverageRatio < 0.75 && stats.segmentCount > 2) || (rawCoverageRatio !== null && rawCoverageRatio < 0.75)) {
      warnings.push("Gemini generated compressed timestamps relative to the known audio duration; timing should be treated as coarse/unreliable.");
    }
  }

  if (service === "glm-stt") {
    if (stats.zeroDurationSegmentCount === stats.segmentCount && stats.segmentCount > 1) {
      warnings.push("GLM returned all-zero-duration segment timing.");
    } else if (stats.segmentCount > 1 && stats.timingQuality === "segment_interpolated") {
      warnings.push("GLM segment timing is model-generated; zero-duration output is repaired with adjacent starts when detected, but no native word timing or speaker labels are available.");
    }
  }

  if (service === "openai-stt" && (stats.timingQuality === "coarse" || stats.segmentCount === 1)) {
    warnings.push("OpenAI STT returned coarse single-speaker transcript output without reliable segment timing or speaker labels.");
  }

  if (service === "supadata" && provider.duplicateGroupId) {
    warnings.push(`Supadata output duplicates another provider artifact in ${provider.duplicateGroupId}; ranking is unchanged.`);
  }

  if (service === "whisper") {
    const rawMaxEndSeconds = rawWhisperMaxEndSeconds(provider.rawResponse);
    if ((rawMaxEndSeconds !== null && rawMaxEndSeconds > runDurationSeconds + 0.01) || (stats.lastEndSeconds !== null && stats.lastEndSeconds > runDurationSeconds + 0.01)) {
      warnings.push("Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts.");
    }
  }

  if (stats.zeroDurationSegmentCount > 0 && stats.zeroDurationSegmentCount === stats.segmentCount && service !== "glm-stt" && service !== "openai-stt") {
    warnings.push("All provider segments have zero duration; timing is coarse for overlap-based speaker analysis.");
  }

  return warnings;
}

interface OverallComponents {
  accuracy: {
    score: number;
    source: "speaker-aware-wer";
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
  provider: string;
  providerKey: string;
  tierGroup: TierGroupName;
  groupOverallRank: number;
  groupTier: TierNumber;
  supportsDiarization: boolean;
  diarizationSupport: DiarizationSupport;
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

function isLocalSttProvider(provider: string, providerKey: string): boolean {
  const providerName = provider.toLowerCase();
  const serviceName = providerKey.split("/")[0]?.toLowerCase() ?? providerName;
  return LOCAL_STT_SERVICES.has(serviceName) || [...LOCAL_STT_SERVICES].some((service) => providerName === service || providerName.startsWith(`${service}-`));
}

function isKnownUnknownSpeakerLabel(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "speaker-unknown" || normalized === "unknown" || normalized === "unk";
}

function supportsDiarization(provider: { hasSpeakerLabels: boolean | null; segments: Array<{ speaker: string }> }): boolean {
  if (provider.hasSpeakerLabels === true) {
    return true;
  }
  if (provider.hasSpeakerLabels === false) {
    return false;
  }
  return provider.segments.some((segment) => !isKnownUnknownSpeakerLabel(segment.speaker));
}

function diarizationSupportFor(supports: boolean): DiarizationSupport {
  return supports ? "supported" : "not-supported";
}

function tierGroupForProvider(provider: { group: ProviderGroup; supportsDiarization: boolean }): TierGroupName {
  if (provider.group === "local") {
    return "local";
  }
  return provider.supportsDiarization ? "thirdPartyDiarization" : "thirdPartyNonDiarization";
}

function addOverallScores<T extends {
  provider: string;
  providerKey: string;
  score: number;
  actualProcessingTimeMs: number | null;
  actualCostCents: number | null;
}>(providers: T[]): Array<T & { overallRank: number; overallScore: number; overallComponents: OverallComponents }> {
  const timingValues = providers.map((provider) => provider.actualProcessingTimeMs).filter(isFiniteNumber);
  const costValues = providers
    .map((provider) => isLocalSttProvider(provider.provider, provider.providerKey) ? 0 : provider.actualCostCents)
    .filter(isFiniteNumber);

  const withComponents = providers.map((provider) => {
    const isLocal = isLocalSttProvider(provider.provider, provider.providerKey);
    const costCents = isLocal ? 0 : provider.actualCostCents;
    const costSource = isLocal
      ? "local-zero-cost"
      : provider.actualCostCents === null
        ? "missing-cloud-cost"
        : "reported-cost";
    const overallComponents: OverallComponents = {
      accuracy: {
        score: provider.score,
        source: "speaker-aware-wer",
      },
      processingSpeed: {
        score: normalizeLowerIsBetter(provider.actualProcessingTimeMs, timingValues),
        source: provider.actualProcessingTimeMs === null ? "missing-timing" : "processing-time",
        processingTimeMs: provider.actualProcessingTimeMs,
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
          provider: provider.provider,
          providerKey: provider.providerKey,
          ...annotation,
          supportsDiarization: provider.supportsDiarization,
          diarizationSupport: provider.diarizationSupport,
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
    rankedOverall.filter((provider) => tierGroupForProvider(provider) === "local"),
  );
  const thirdPartyDiarization = buildTierGroup(
    "thirdPartyDiarization",
    rankedOverall.filter((provider) => tierGroupForProvider(provider) === "thirdPartyDiarization"),
  );
  const thirdPartyNonDiarization = buildTierGroup(
    "thirdPartyNonDiarization",
    rankedOverall.filter((provider) => tierGroupForProvider(provider) === "thirdPartyNonDiarization"),
  );
  const providerAnnotations = new Map<string, TierAnnotation>([
    ...local.providerAnnotations,
    ...thirdPartyDiarization.providerAnnotations,
    ...thirdPartyNonDiarization.providerAnnotations,
  ]);
  const tiering: Tiering = {
    metric: TIER_METRIC,
    method: TIER_METHOD,
    remainderPolicy: TIER_REMAINDER_POLICY,
    groups: {
      local: local.group,
      thirdPartyDiarization: thirdPartyDiarization.group,
      thirdPartyNonDiarization: thirdPartyNonDiarization.group,
    },
  };
  return { tiering, providerAnnotations };
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
  if (group === "local") {
    return "Local";
  }
  if (group === "thirdPartyDiarization") {
    return "Third-Party Diarization";
  }
  return "Third-Party Non-Diarization";
}

function formatDiarizationSupport(support: DiarizationSupport): string {
  return support === "supported" ? "supported" : "not supported";
}

export function buildReport(runDir: string, referencePath: string) {
  const runJson = loadRunJson(runDir);
  const { providers, warnings } = loadProviderRuns(runDir);
  if (providers.length === 0) {
    throw new Error(`No providers/*/result.json files found under ${runDir}`);
  }
  const runDurationSeconds = durationSecondsFromRun(runJson, providers);
  const referenceSegments = parseReferenceTranscript(referencePath, runDurationSeconds);

  const scoredProviders = providers.map((provider) => {
      const speakerMap = mapProviderSpeakers(referenceSegments, provider.segments);
      const textOnlyDetailed = wordWerDetailed(referenceSegments, provider.segments, false, undefined, { stripFillers: true });
      const speakerAwareDetailed = wordWerDetailed(referenceSegments, provider.segments, true, speakerMap, { stripFillers: true });
      const textOnlyWer = textOnlyDetailed.wer;
      const speakerAwareWer = speakerAwareDetailed.wer;
      const segmentStats = computeProviderSegmentStats(provider, runDurationSeconds);
      const providerSupportsDiarization = supportsDiarization(provider);
      return {
        provider: provider.directoryName,
        providerKey: provider.providerKey,
        group: isLocalSttProvider(provider.directoryName, provider.providerKey) ? "local" : "cloud",
        supportsDiarization: providerSupportsDiarization,
        diarizationSupport: diarizationSupportFor(providerSupportsDiarization),
        text: provider.text,
        rawResponse: provider.rawResponse,
        tokenCount: provider.tokenCount,
        transcriptTextHash: normalizedTextHash(provider.text),
        segmentStats,
        score: Math.max(0, 100 * (1 - speakerAwareWer)),
        speakerAwareWER: speakerAwareWer,
        textOnlyWER: textOnlyWer,
        textOnlyBreakdown: {
          substitutions: textOnlyDetailed.substitutions,
          deletions: textOnlyDetailed.deletions,
          insertions: textOnlyDetailed.insertions,
          referenceWordCount: textOnlyDetailed.referenceWordCount,
        },
        speakerAwareBreakdown: {
          substitutions: speakerAwareDetailed.substitutions,
          deletions: speakerAwareDetailed.deletions,
          insertions: speakerAwareDetailed.insertions,
          referenceWordCount: speakerAwareDetailed.referenceWordCount,
        },
        actualProcessingTimeMs: provider.processingTimeMs,
        actualCostCents: provider.actualCostCents,
        speakerPenalty: speakerAwareWer - textOnlyWer,
        speakerMap,
      };
    });
  const { duplicateGroups, providerGroupIds } = detectDuplicateGroups(scoredProviders);
  const providersWithQuality = scoredProviders.map((provider) => {
    const duplicateGroupId = providerGroupIds.get(provider.provider);
    const qualityWarnings = buildQualityWarnings(
      {
        provider: provider.provider,
        providerKey: provider.providerKey,
        text: provider.text,
        rawResponse: provider.rawResponse,
        segmentStats: provider.segmentStats,
        ...(duplicateGroupId ? { duplicateGroupId } : {}),
      },
      runDurationSeconds,
    );
    const { text: _text, rawResponse: _rawResponse, ...reportProvider } = provider;
    return {
      ...reportProvider,
      qualityWarnings,
      ...(duplicateGroupId ? { duplicateGroupId } : {}),
    };
  });

  const rankedProvidersWithoutTiers = addOverallScores(providersWithQuality)
    .sort((left, right) => {
      if (left.speakerAwareWER !== right.speakerAwareWER) {
        return left.speakerAwareWER - right.speakerAwareWER;
      }
      if (left.textOnlyWER !== right.textOnlyWER) {
        return left.textOnlyWER - right.textOnlyWER;
      }
      return left.provider.localeCompare(right.provider);
    })
    .map((provider, index) => ({
      ...provider,
      rank: index + 1,
    }));
  const rankedOverallWithoutTiers = [...rankedProvidersWithoutTiers].sort((left, right) => {
    if (left.overallRank !== right.overallRank) {
      return left.overallRank - right.overallRank;
    }
    return left.providerKey.localeCompare(right.providerKey);
  });
  const { tiering, providerAnnotations } = buildTiering(rankedOverallWithoutTiers);
  const rankedProviders = rankedProvidersWithoutTiers.map((provider) => ({
    ...provider,
    ...(providerAnnotations.get(provider.providerKey) ?? {
      tierGroup: tierGroupForProvider(provider),
      groupOverallRank: 0,
      groupTier: 3,
    }),
  }));
  const rankedOverall = rankedOverallWithoutTiers.map((provider) => ({
    ...provider,
    ...(providerAnnotations.get(provider.providerKey) ?? {
      tierGroup: tierGroupForProvider(provider),
      groupOverallRank: 0,
      groupTier: 3,
    }),
  }));

  const bestProvider = rankedProviders[0];
  if (!bestProvider) {
    throw new Error("Could not rank providers");
  }
  const providersWithCost = rankedProviders.filter((provider) => provider.actualCostCents !== null);
  const providersWithTime = rankedProviders.filter((provider) => provider.actualProcessingTimeMs !== null);
  const largestSpeakerPenalty = [...rankedProviders].sort(
    (left, right) => right.speakerPenalty - left.speakerPenalty,
  )[0];
  if (!largestSpeakerPenalty) {
    throw new Error("Could not compute speaker penalty notes");
  }

  const bestOverall = rankedOverall[0];
  const worstOverall = rankedOverall.at(-1);
  const notes = [
    `\`${bestProvider.provider}\` was the most accurate provider on strict speaker-aware WER, scoring ${bestProvider.score.toFixed(2)}/100.`,
  ];

  if (bestOverall) {
    notes.push(
      `Best overall provider: \`${bestOverall.provider}\` scored ${bestOverall.overallScore.toFixed(2)}/100 using balanced overall weighting.`,
    );
  }
  if (worstOverall) {
    notes.push(
      `Worst overall provider: \`${worstOverall.provider}\` scored ${worstOverall.overallScore.toFixed(2)}/100 using balanced overall weighting.`,
    );
  }

  if (providersWithCost.length > 0) {
    const cheapestCost = Math.min(...providersWithCost.map((provider) => provider.actualCostCents as number));
    const cheapestProviders = providersWithCost.filter(
      (provider) => provider.actualCostCents === cheapestCost,
    );
    const subject = cheapestProviders.length === 1 ? "provider was" : "providers were";
    notes.push(
      `The cheapest ${subject} ${joinProviderNames(cheapestProviders)} at ${formatCents(cheapestCost)}.`,
    );
  } else {
    notes.push("Actual provider cost data was unavailable in `run.json`.");
  }

  if (providersWithTime.length > 0) {
    const fastestProvider = [...providersWithTime].sort(
      (left, right) => (left.actualProcessingTimeMs as number) - (right.actualProcessingTimeMs as number),
    )[0];
    notes.push(
      `\`${fastestProvider.provider}\` was the fastest provider in this set at ${((fastestProvider.actualProcessingTimeMs as number) / 1000).toFixed(2)}s.`,
    );
  } else {
    notes.push("Actual provider timing data was unavailable in `run.json`.");
  }

  if (largestSpeakerPenalty.speakerPenalty > 0) {
    notes.push(
      `\`${largestSpeakerPenalty.provider}\` lost the most ground once speaker changes were counted, with ${(largestSpeakerPenalty.speakerPenalty * 100).toFixed(2)} percentage-point gap between text-only and speaker-aware WER.`,
    );
  } else {
    notes.push("No provider scored worse once speaker changes were counted.");
  }

  const reportJson = {
    runDir,
    referenceTranscriptPath: referencePath,
    metric: "speaker-aware-wer",
    scoreFormula: "max(0, 100 * (1 - speakerAwareWER))",
    normalization: {
      lowercase: true,
      contractionsExpanded: true,
      abbreviationsExpanded: true,
      currencySymbolsExpanded: true,
      punctuationStripped: true,
      fillerWordsRemoved: true,
    },
    overallMetric: "balanced-overall",
    overallWeights: OVERALL_WEIGHTS,
    tiering,
    overall: { count: rankedOverall.length, providers: rankedOverall },
    duplicateGroups,
    providers: rankedProviders,
    notes,
  };

  const providerList = rankedProviders.map((provider) => `  - \`${provider.provider}\``).join("\n");
  const overallRankingRows = rankedOverall
    .map(
      (provider) =>
        `| ${provider.overallRank} | \`${provider.provider}\` | ${provider.tierGroup} | ${provider.groupOverallRank} | ${provider.groupTier} | ${formatDiarizationSupport(provider.diarizationSupport)} | ${provider.overallScore.toFixed(2)} | ${provider.overallComponents.accuracy.score.toFixed(2)} | ${provider.overallComponents.processingSpeed.score.toFixed(2)} | ${provider.overallComponents.costEfficiency.score.toFixed(2)} |`,
    )
    .join("\n");
  const tierBreakdownBlock = [
    "Tiers split local providers, diarization-capable third-party providers, and non-diarization third-party providers separately. When a group count is not divisible by three, the remainder is assigned to Tier 3 for that group.",
    "",
    ...(["local", "thirdPartyDiarization", "thirdPartyNonDiarization"] as const).flatMap((groupName) => {
      const group = tiering.groups[groupName];
      return [
        `### ${formatTierGroupName(groupName)} Group (${group.count})`,
        "",
        ...group.tiers.flatMap((tier) => {
          const providerRows = tier.providers
            .map(
              (provider) =>
                `| ${provider.groupOverallRank} | ${provider.overallRank} | \`${provider.provider}\` | ${provider.overallScore.toFixed(2)} | ${provider.overallComponents.accuracy.score.toFixed(2)} | ${provider.overallComponents.processingSpeed.score.toFixed(2)} | ${provider.overallComponents.costEfficiency.score.toFixed(2)} |`,
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
  const rankingRows = rankedProviders
    .map(
      (provider) =>
        `| ${provider.rank} | \`${provider.provider}\` | ${provider.score.toFixed(2)} | ${percentage(provider.speakerAwareWER)} | ${percentage(provider.textOnlyWER)} | ${formatProcessingSeconds(provider.actualProcessingTimeMs)} | ${formatCents(provider.actualCostCents)} |`,
    )
    .join("\n");
  const breakdownRows = rankedProviders
    .map(
      (provider) =>
        `| \`${provider.provider}\` | ${provider.textOnlyBreakdown.substitutions} | ${provider.textOnlyBreakdown.deletions} | ${provider.textOnlyBreakdown.insertions} | ${provider.textOnlyBreakdown.referenceWordCount} |`,
    )
    .join("\n");
  const qualityFlagRows = rankedProviders
    .filter((provider) => provider.qualityWarnings.length > 0)
    .map((provider) => `| \`${provider.provider}\` | ${provider.qualityWarnings.join("<br>")} |`)
    .join("\n");
  const qualityFlagsBlock = qualityFlagRows.length > 0
    ? `| Provider | Quality Flags |\n| --- | --- |\n${qualityFlagRows}`
    : "No provider quality flags were detected.";
  const notesBlock = notes.map((note) => `- ${note}`).join("\n");

  const referenceName = referencePath.split("/").at(-1) ?? referencePath;
  const markdown = `# Consensus Transcript Comparison Report

## Summary

- Reference transcript: \`${referenceName}\`
- Compared providers:
${providerList}
- Ranking metric: strict speaker-aware word error rate (WER)
- Score formula: \`max(0, 100 * (1 - speakerAwareWER))\`
- Overall metric: balanced-overall (50% accuracy, 25% processing speed, 25% cost efficiency)
- WER formula: \`(Substitutions + Deletions + Insertions) / Reference Word Count\`
- Cost and processing time source: actual per-provider billing and timing data from \`run.json\` when available

## Method

- The consolidated transcript in \`${referenceName}\` was treated as the gold reference.
- Timestamps were used to map provider speaker labels onto canonical gold speakers by segment overlap.
- Gold segment end times were derived from the next gold segment start, with the final segment ending at the run duration from \`run.json\`.
- Provider scoring used \`result.json.result.segments\` for all discovered providers under \`providers/\`; \`transcription.txt\` and any pre-existing comparison reports were ignored.
- Text normalization applied before tokenization: lowercasing, curly quote/dash normalization, contraction expansion (it's -> it is), abbreviation expansion (mr. -> mister), currency symbol conversion ($50 -> 50 dollars), filler word removal (um, uh, etc.), and remaining punctuation stripping.
- Tokenization used a word/number regex, so punctuation-only tokens were ignored.
- Text-only WER compares the provider's full ordered word stream against the gold transcript word stream.
- Speaker-aware WER compares those same ordered word streams after inserting synthetic speaker-change tokens and mapping provider speaker IDs onto canonical gold speakers by overlap.
- Ranking uses exact unrounded speaker-aware WER, with text-only WER included for context.
- Overall ranking combines all providers using accuracy score, normalized processing speed, and normalized cost efficiency. Missing timing or missing cloud cost receives a neutral 50/100 component score; whisper and reverb are treated as local zero-cost providers.
- Tier breakdown assigns local providers, diarization-capable third-party providers, and non-diarization third-party providers independently using balanced overall group rank.

## Overall Ranking

| Rank | Provider | Tier Group | Group Rank | Group Tier | Diarization | Overall / 100 | Accuracy | Speed | Cost |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |
${overallRankingRows}

## Tier Breakdown

${tierBreakdownBlock}

## Ranking

| Rank | Provider | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${rankingRows}

## Error Breakdown (Text-only)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
${breakdownRows}

## Quality Flags

${qualityFlagsBlock}

## Notes

${notesBlock}
`;

  return { reportJson, markdown, warnings };
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const referencePath = args.referencePath ?? resolve(args.runDir, "consensus-transcription.txt");
  const markdownOut = args.markdownOut ?? resolve(args.runDir, "reference-comparison-report.md");
  const jsonOut = args.jsonOut ?? resolve(args.runDir, "reference-comparison-report.json");

  const { reportJson, markdown, warnings } = buildReport(args.runDir, referencePath);

  for (const warning of warnings) {
    console.error(`[warn] ${warning}`);
  }

  writeFileSync(jsonOut, `${JSON.stringify(reportJson, null, 2)}\n`);
  writeFileSync(markdownOut, markdown);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
