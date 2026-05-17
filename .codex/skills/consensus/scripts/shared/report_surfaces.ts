import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

export type ConsensusCategory = "image" | "music" | "ocr" | "stt" | "tts" | "url" | "video";

type ProviderGroup = "local" | "service";
type RankingSurfaceName = "fastest" | "cheapest" | "highestQuality";

interface RewriteOptions {
  category: ConsensusCategory;
  jsonPath: string;
  markdownPath: string;
}

interface ProviderSummary {
  providerKey: string;
  provider: string;
  model: string | null;
  group: ProviderGroup;
  processingTimeMs: number | null;
  costCents: number | null;
  quality: QualityEvidence | null;
  metrics: Record<string, number | null>;
  source: Record<string, unknown>;
}

interface QualityEvidence {
  kind: "lower-is-better" | "higher-is-better";
  metric: string;
  value: number;
  label: string;
  tieBreakers: number[];
}

interface RankingEntry {
  rank: number;
  providerKey: string;
  provider: string;
  model: string | null;
  group: ProviderGroup;
  metric: string;
  value: number;
  label: string;
}

type SurfaceGroup = Record<RankingSurfaceName, RankingEntry[]> & {
  fastestUnavailableReason: string | null;
  cheapestUnavailableReason: string | null;
  highestQualityUnavailableReason: string | null;
};

interface RankingSurfaces {
  local: SurfaceGroup;
  service: SurfaceGroup;
}

const CATEGORY_TITLES: Record<ConsensusCategory, string> = {
  image: "Image",
  music: "Music",
  ocr: "OCR",
  stt: "STT",
  tts: "TTS",
  url: "URL",
  video: "Video",
};

const SERVICE_GROUP_VALUES = new Set(["cloud", "hosted", "service", "thirdparty", "thirdpartydiarization", "thirdpartynondiarization"]);
const LOCAL_PROVIDER_HINTS = [
  "tesseract",
  "ocrmypdf",
  "paddle",
  "paddle-ocr",
  "whisper",
  "reverb",
  "kitten",
  "kokoro",
  "piper",
  "coqui",
  "local",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function providerKey(record: Record<string, unknown>): string {
  const key = asString(record.providerKey);
  if (key) {
    return key;
  }

  const service = asString(record.ttsService) ?? asString(record.provider) ?? "unknown";
  const model = asString(record.ttsModel) ?? asString(record.model);
  return model ? `${service}-${model}` : service;
}

function providerName(record: Record<string, unknown>, key: string): string {
  return asString(record.provider) ?? asString(record.ttsService) ?? key;
}

function providerModel(record: Record<string, unknown>): string | null {
  return asString(record.model) ?? asString(record.ttsModel);
}

function normalizeGroup(record: Record<string, unknown>, overrideGroup: ProviderGroup | null): ProviderGroup {
  if (overrideGroup) {
    return overrideGroup;
  }

  const rawGroup = (asString(record.group) ?? asString(record.tierGroup) ?? "").replace(/[-_\s]/g, "").toLowerCase();
  if (rawGroup === "local") {
    return "local";
  }
  if (SERVICE_GROUP_VALUES.has(rawGroup)) {
    return "service";
  }

  const identity = `${providerKey(record)} ${providerName(record, "")}`.toLowerCase();
  if (LOCAL_PROVIDER_HINTS.some((hint) => identity.includes(hint))) {
    return "local";
  }

  return "service";
}

function addRecords(
  map: Map<string, ProviderSummary>,
  records: Record<string, unknown>[],
  overrideGroup: ProviderGroup | null,
): void {
  for (const record of records) {
    const key = providerKey(record);
    if (map.has(key)) {
      continue;
    }
    const group = normalizeGroup(record, overrideGroup);
    const summary: ProviderSummary = {
      providerKey: key,
      provider: providerName(record, key),
      model: providerModel(record),
      group,
      processingTimeMs: firstNumber(record, ["processingTimeMs", "actualProcessingTimeMs"]),
      costCents: firstNumber(record, ["costCents", "actualCostCents"]),
      quality: null,
      metrics: {
        wer: asNumber(record.wer),
        cer: asNumber(record.cer),
        speakerAwareWER: asNumber(record.speakerAwareWER),
        textOnlyWER: asNumber(record.textOnlyWER),
        roundtripWER: asNumber(record.roundtripWER),
        contentCoverage: asNumber(record.contentCoverage),
        qualityScore: asNumber(record.qualityScore) ?? asNumber(record.voiceQualityScore),
      },
      source: record,
    };
    map.set(key, summary);
  }
}

function recordsFromNested(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value)) {
    return [];
  }
  return asArray(value.providers);
}

function extractProviders(category: ConsensusCategory, report: Record<string, unknown>): ProviderSummary[] {
  const map = new Map<string, ProviderSummary>();

  addRecords(map, recordsFromNested(report.local), "local");
  addRecords(map, recordsFromNested(report.cloud), "service");
  addRecords(map, recordsFromNested(report.hosted), "service");
  addRecords(map, recordsFromNested(report.service), "service");
  addRecords(map, asArray(report.providers), null);

  if (map.size === 0) {
    addRecords(map, recordsFromNested(report.overall), null);
  }

  const providers = [...map.values()].map((provider) => ({
    ...provider,
    quality: qualityEvidence(category, provider),
  }));

  return providers.sort((left, right) => {
    if (left.group !== right.group) {
      return left.group.localeCompare(right.group);
    }
    return left.providerKey.localeCompare(right.providerKey);
  });
}

function qualityEvidence(category: ConsensusCategory, provider: ProviderSummary): QualityEvidence | null {
  const { metrics } = provider;
  if (category === "ocr" && metrics.wer !== null) {
    return {
      kind: "lower-is-better",
      metric: "WER",
      value: metrics.wer,
      label: `${formatPercent(metrics.wer)} WER`,
      tieBreakers: [metrics.cer ?? Number.POSITIVE_INFINITY],
    };
  }
  if (category === "stt" && metrics.speakerAwareWER !== null) {
    return {
      kind: "lower-is-better",
      metric: "speaker-aware WER",
      value: metrics.speakerAwareWER,
      label: `${formatPercent(metrics.speakerAwareWER)} speaker-aware WER`,
      tieBreakers: [metrics.textOnlyWER ?? Number.POSITIVE_INFINITY],
    };
  }
  if (category === "url" && metrics.wer !== null) {
    return {
      kind: "lower-is-better",
      metric: "WER/CER/coverage",
      value: metrics.wer,
      label: `${formatPercent(metrics.wer)} WER, ${formatPercent(metrics.cer)} CER, ${formatPercent(metrics.contentCoverage)} coverage`,
      tieBreakers: [
        metrics.cer ?? Number.POSITIVE_INFINITY,
        metrics.contentCoverage === null ? Number.POSITIVE_INFINITY : -metrics.contentCoverage,
      ],
    };
  }
  if (category === "tts" && metrics.roundtripWER !== null) {
    return {
      kind: "lower-is-better",
      metric: "roundtrip WER",
      value: metrics.roundtripWER,
      label: `${formatPercent(metrics.roundtripWER)} roundtrip WER`,
      tieBreakers: [],
    };
  }
  if (category === "tts" && metrics.qualityScore !== null) {
    return {
      kind: "higher-is-better",
      metric: "explicit voice quality score",
      value: metrics.qualityScore,
      label: `${metrics.qualityScore.toFixed(2)} explicit quality score`,
      tieBreakers: [],
    };
  }
  if ((category === "image" || category === "music" || category === "video") && metrics.qualityScore !== null) {
    return {
      kind: "higher-is-better",
      metric: "explicit quality score",
      value: metrics.qualityScore,
      label: `${metrics.qualityScore.toFixed(2)} explicit quality score`,
      tieBreakers: [],
    };
  }
  return null;
}

function formatPercent(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(2)}%`;
}

function formatDurationMs(value: number | null): string {
  return value === null ? "n/a" : `${(value / 1000).toFixed(2)}s`;
}

function formatCents(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  if (value === 0) {
    return "$0.00";
  }
  return `$${(value / 100).toFixed(4)}`;
}

function surfaceEntry(provider: ProviderSummary, rank: number, metric: string, value: number, label: string): RankingEntry {
  return {
    rank,
    providerKey: provider.providerKey,
    provider: provider.provider,
    model: provider.model,
    group: provider.group,
    metric,
    value,
    label,
  };
}

function topFastest(providers: ProviderSummary[], group: ProviderGroup): { entries: RankingEntry[]; reason: string | null } {
  if (providers.length === 0) {
    return { entries: [], reason: `No ${group} providers were found.` };
  }
  const withTiming = providers.filter((provider) => provider.processingTimeMs !== null);
  if (withTiming.length === 0) {
    return { entries: [], reason: `No ${group} providers had processing time data.` };
  }
  const entries = withTiming
    .sort((left, right) => (left.processingTimeMs ?? Infinity) - (right.processingTimeMs ?? Infinity) || left.providerKey.localeCompare(right.providerKey))
    .slice(0, 3)
    .map((provider, index) => surfaceEntry(provider, index + 1, "processingTimeMs", provider.processingTimeMs ?? 0, formatDurationMs(provider.processingTimeMs)));
  return { entries, reason: null };
}

function topCheapest(providers: ProviderSummary[], group: ProviderGroup): { entries: RankingEntry[]; reason: string | null } {
  if (providers.length === 0) {
    return { entries: [], reason: `No ${group} providers were found.` };
  }

  if (group === "local") {
    const entries = [...providers]
      .sort((left, right) => left.providerKey.localeCompare(right.providerKey))
      .slice(0, 3)
      .map((provider, index) => surfaceEntry(provider, index + 1, "local monetary cost", 0, "$0.00 local monetary cost"));
    return { entries, reason: null };
  }

  const withCost = providers.filter((provider) => provider.costCents !== null);
  if (withCost.length === 0) {
    return { entries: [], reason: "No service providers had monetary cost data." };
  }
  const entries = withCost
    .sort((left, right) => (left.costCents ?? Infinity) - (right.costCents ?? Infinity) || left.providerKey.localeCompare(right.providerKey))
    .slice(0, 3)
    .map((provider, index) => surfaceEntry(provider, index + 1, "costCents", provider.costCents ?? 0, formatCents(provider.costCents)));
  return { entries, reason: null };
}

function topHighestQuality(
  category: ConsensusCategory,
  providers: ProviderSummary[],
  group: ProviderGroup,
): { entries: RankingEntry[]; reason: string | null } {
  if (providers.length === 0) {
    return { entries: [], reason: `No ${group} providers were found.` };
  }

  const withQuality = providers.filter((provider) => provider.quality !== null);
  if (withQuality.length === 0) {
    return { entries: [], reason: qualityUnavailableReason(category, group) };
  }

  const entries = withQuality
    .sort((left, right) => {
      const leftQuality = left.quality;
      const rightQuality = right.quality;
      if (!leftQuality || !rightQuality) {
        return left.providerKey.localeCompare(right.providerKey);
      }
      const direction = leftQuality.kind === "higher-is-better" ? -1 : 1;
      if (leftQuality.value !== rightQuality.value) {
        return direction * (leftQuality.value - rightQuality.value);
      }
      const maxTieBreakers = Math.max(leftQuality.tieBreakers.length, rightQuality.tieBreakers.length);
      for (let index = 0; index < maxTieBreakers; index += 1) {
        const leftTie = leftQuality.tieBreakers[index] ?? 0;
        const rightTie = rightQuality.tieBreakers[index] ?? 0;
        if (leftTie !== rightTie) {
          return leftTie - rightTie;
        }
      }
      return left.providerKey.localeCompare(right.providerKey);
    })
    .slice(0, 3)
    .map((provider, index) =>
      surfaceEntry(provider, index + 1, provider.quality?.metric ?? "quality", provider.quality?.value ?? 0, provider.quality?.label ?? "n/a")
    );
  return { entries, reason: null };
}

function qualityUnavailableReason(category: ConsensusCategory, group: ProviderGroup): string {
  if (category === "image" || category === "music" || category === "video") {
    return `No explicit ${CATEGORY_TITLES[category].toLowerCase()} quality metric was available for ${group} providers. File size, dimensions, duration, bitrate, and subjective judgment are not used as quality proxies.`;
  }
  if (category === "tts") {
    return `No roundtrip WER or explicit voice-quality metric was available for ${group} providers. Duration, bitrate, and file size are not used as quality proxies.`;
  }
  return `No quality evidence metric was available for ${group} providers.`;
}

function buildRankingSurfaces(category: ConsensusCategory, providers: ProviderSummary[]): RankingSurfaces {
  const buildGroup = (group: ProviderGroup): SurfaceGroup => {
    const groupProviders = providers.filter((provider) => provider.group === group);
    const fastest = topFastest(groupProviders, group);
    const cheapest = topCheapest(groupProviders, group);
    const highestQuality = topHighestQuality(category, groupProviders, group);
    return {
      fastest: fastest.entries,
      cheapest: cheapest.entries,
      highestQuality: highestQuality.entries,
      fastestUnavailableReason: fastest.reason,
      cheapestUnavailableReason: cheapest.reason,
      highestQualityUnavailableReason: highestQuality.reason,
    };
  };

  return {
    local: buildGroup("local"),
    service: buildGroup("service"),
  };
}

function providerDetail(provider: ProviderSummary): Record<string, unknown> {
  return {
    providerKey: provider.providerKey,
    provider: provider.provider,
    model: provider.model,
    group: provider.group,
    processingTimeMs: provider.processingTimeMs,
    costCents: provider.group === "local" ? 0 : provider.costCents,
    qualityMetric: provider.quality?.metric ?? null,
    qualityValue: provider.quality?.value ?? null,
    qualityLabel: provider.quality?.label ?? null,
    metrics: provider.metrics,
    supportsDiarization: provider.source.supportsDiarization ?? null,
    diarizationSupport: provider.source.diarizationSupport ?? null,
    tierGroup: provider.source.tierGroup ?? null,
    groupOverallRank: provider.source.groupOverallRank ?? null,
    groupTier: provider.source.groupTier ?? null,
    qualityWarnings: provider.source.qualityWarnings ?? [],
    segmentStats: provider.source.segmentStats ?? null,
    duplicateGroupId: provider.source.duplicateGroupId ?? null,
    overallComponents: provider.source.overallComponents ?? null,
  };
}

function buildJsonReport(
  category: ConsensusCategory,
  sourceReport: Record<string, unknown>,
  providers: ProviderSummary[],
  rankingSurfaces: RankingSurfaces,
): Record<string, unknown> {
  const runDir = asString(sourceReport.runDir) ?? "";
  const localProviders = providers.filter((provider) => provider.group === "local");
  const serviceProviders = providers.filter((provider) => provider.group === "service");

  return {
    schemaVersion: 2,
    kind: `${category}-provider-comparison`,
    category,
    runDir,
    runName: runDir ? basename(runDir) : null,
    generatedAt: new Date().toISOString(),
    metric: sourceReport.metric ?? null,
    scoreFormula: sourceReport.scoreFormula ?? null,
    overallMetric: sourceReport.overallMetric ?? null,
    overallWeights: sourceReport.overallWeights ?? null,
    tiering: sourceReport.tiering ?? null,
    duplicateGroups: sourceReport.duplicateGroups ?? [],
    normalization: sourceReport.normalization ?? null,
    providerCount: providers.length,
    providerGroups: {
      local: {
        count: localProviders.length,
        providers: localProviders.map(providerDetail),
      },
      service: {
        count: serviceProviders.length,
        providers: serviceProviders.map(providerDetail),
      },
    },
    rankingSurfaces,
    combinedLeaderboardPolicy: "omitted: local and service providers are not ranked against each other",
    notes: Array.isArray(sourceReport.notes) ? sourceReport.notes : [],
  };
}

function markdownTable(entries: RankingEntry[]): string {
  if (entries.length === 0) {
    return "";
  }
  return [
    "| Rank | Provider | Evidence |",
    "| ---: | --- | --- |",
    ...entries.map((entry) => `| ${entry.rank} | \`${entry.providerKey}\` | ${entry.label} |`),
  ].join("\n");
}

function surfaceMarkdown(title: string, entries: RankingEntry[], reason: string | null): string {
  if (entries.length === 0) {
    return [`### ${title}`, "", `Unavailable: ${reason ?? "No providers qualified for this ranking."}`].join("\n");
  }
  return [`### ${title}`, "", markdownTable(entries)].join("\n");
}

function detailTable(providers: ProviderSummary[], group: ProviderGroup): string {
  if (providers.length === 0) {
    return `No ${group} providers were found.`;
  }
  return [
    "| Provider | Quality Evidence | Processing Time | Monetary Cost |",
    "| --- | --- | ---: | ---: |",
    ...providers.map((provider) => {
      const cost = group === "local" ? "$0.00" : formatCents(provider.costCents);
      return `| \`${provider.providerKey}\` | ${provider.quality?.label ?? "n/a"} | ${formatDurationMs(provider.processingTimeMs)} | ${cost} |`;
    }),
  ].join("\n");
}

function groupMarkdown(label: string, group: ProviderGroup, providers: ProviderSummary[], surfaces: SurfaceGroup): string {
  return [
    `## ${label} Providers`,
    "",
    surfaceMarkdown("Top 3 Fastest", surfaces.fastest, surfaces.fastestUnavailableReason),
    "",
    surfaceMarkdown("Top 3 Cheapest", surfaces.cheapest, surfaces.cheapestUnavailableReason),
    "",
    surfaceMarkdown("Top 3 Highest Quality", surfaces.highestQuality, surfaces.highestQualityUnavailableReason),
    "",
    "### Provider Detail",
    "",
    detailTable(providers, group),
  ].join("\n");
}

function buildMarkdownReport(
  category: ConsensusCategory,
  sourceReport: Record<string, unknown>,
  providers: ProviderSummary[],
  rankingSurfaces: RankingSurfaces,
): string {
  const runDir = asString(sourceReport.runDir) ?? "";
  const notes = Array.isArray(sourceReport.notes)
    ? sourceReport.notes.filter((note): note is string => typeof note === "string")
    : [];
  const localProviders = providers.filter((provider) => provider.group === "local");
  const serviceProviders = providers.filter((provider) => provider.group === "service");
  const notesBlock = notes.length > 0 ? notes.map((note) => `- ${note}`).join("\n") : "- No additional notes.";

  return [
    `# ${CATEGORY_TITLES[category]} Provider Comparison Report`,
    "",
    "## Summary",
    "",
    `- Run directory: \`${runDir}\``,
    `- Total providers: ${providers.length} (${localProviders.length} local, ${serviceProviders.length} service)`,
    "- Local and service providers are intentionally not ranked against each other.",
    "- Reports expose separate fastest, cheapest, and highest-quality surfaces for each group.",
    "",
    "## Method",
    "",
    "- Fastest rankings use processing time when present.",
    "- Cheapest local rankings use zero monetary cost and compare only local providers.",
    "- Cheapest service rankings use reported monetary cost when present.",
    "- Highest-quality rankings use only explicit quality evidence for the category.",
    "",
    groupMarkdown("Local", "local", localProviders, rankingSurfaces.local),
    "",
    groupMarkdown("Service", "service", serviceProviders, rankingSurfaces.service),
    "",
    "## Notes",
    "",
    notesBlock,
    "",
  ].join("\n");
}

export function rewriteComparisonReports(options: RewriteOptions): void {
  const sourceReport = JSON.parse(readFileSync(options.jsonPath, "utf8")) as unknown;
  if (!isRecord(sourceReport)) {
    throw new Error(`Expected JSON object in ${options.jsonPath}`);
  }

  const providers = extractProviders(options.category, sourceReport);
  const rankingSurfaces = buildRankingSurfaces(options.category, providers);
  const jsonReport = buildJsonReport(options.category, sourceReport, providers, rankingSurfaces);
  const markdownReport = buildMarkdownReport(options.category, sourceReport, providers, rankingSurfaces);

  writeFileSync(options.jsonPath, `${JSON.stringify(jsonReport, null, 2)}\n`);
  writeFileSync(options.markdownPath, markdownReport);
}
