import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

export type ConsensusCategory = "image" | "music" | "ocr" | "stt" | "tts" | "url" | "video";

type ProviderGroup = "local" | "service";
type RankingSurfaceName = "fastest" | "cheapest" | "highestQuality";
type FullRankingSurfaceName = "price" | "speed" | "automatedQuality" | "humanQuality";
type MetricRankingName = "price" | "speed" | "qualityScore";
type OcrMetricRankingGroupName = "local" | "thirdPartyService";
type SttMetricRankingGroupName = "local" | "thirdPartyServiceNonDiarization" | "thirdPartyServiceDiarization";
type MetricRankingGroupName = OcrMetricRankingGroupName | SttMetricRankingGroupName;

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
  value: number | null;
  label: string;
}

interface MetricRankingEntry {
  rank: number;
  providerKey: string;
  provider: string;
  model: string | null;
  group: MetricRankingGroupName;
  metric: MetricRankingName;
  value: number | null;
  label: string;
  actualCostCents: number | null;
  processingTimeMs: number | null;
  score: number | null;
  wer: number | null;
  cer: number | null;
  speakerAwareWER: number | null;
  textOnlyWER: number | null;
  supportsDiarization: boolean | null;
  diarizationSupport: string | null;
}

type MetricRankingGroup = Record<MetricRankingName, MetricRankingEntry[]>;
type OcrMetricRankings = Record<OcrMetricRankingGroupName, MetricRankingGroup>;
type SttMetricRankings = Record<SttMetricRankingGroupName, MetricRankingGroup>;
type MetricRankings = OcrMetricRankings | SttMetricRankings;

type SurfaceGroup = Record<RankingSurfaceName, RankingEntry[]> & {
  fastestUnavailableReason: string | null;
  cheapestUnavailableReason: string | null;
  highestQualityUnavailableReason: string | null;
} & Record<FullRankingSurfaceName, RankingEntry[]> & {
  priceUnavailableReason: string | null;
  speedUnavailableReason: string | null;
  automatedQualityUnavailableReason: string | null;
  humanQualityUnavailableReason: string | null;
};

interface RankingSurfaces {
  local: SurfaceGroup;
  service: SurfaceGroup;
}

type ProviderGroups = Record<string, {
  count: number;
  providers: Array<Record<string, unknown>>;
}>;

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

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function markdownTableCell(value: string): string {
  return value
    .replace(/\r?\n/g, "<br>")
    .replace(/\|/g, "\\|");
}

function markdownCode(value: string): string {
  return `<code>${htmlEscape(value).replace(/\|/g, "&#124;")}</code>`;
}

function markdownRow(cells: string[]): string {
  return `| ${cells.map(markdownTableCell).join(" | ")} |`;
}

function looksLikeRawModelPath(value: string): boolean {
  return value.includes("/Users/")
    || value.includes(" | ")
    || value.includes(".bin")
    || value.includes(".mlmodelc")
    || value.includes("coreml:");
}

function localWhisperDisplayName(providerKey: string, provider: string | null, model: string | null): string | null {
  if (provider?.startsWith("whisper-")) {
    return provider;
  }
  if (provider !== "whisper" && !providerKey.startsWith("whisper/")) {
    return null;
  }

  const identity = [providerKey, model ?? ""].join(" ");
  const ggmlMatch = identity.match(/ggml-([^/|\s]+)\.bin/);
  if (ggmlMatch?.[1]) {
    return `whisper-${ggmlMatch[1]}`;
  }

  if (model && !looksLikeRawModelPath(model)) {
    const simpleModel = basename(model).replace(/^ggml-/, "").replace(/\.bin$/, "");
    return simpleModel === "whisper" || simpleModel.startsWith("whisper-")
      ? simpleModel
      : `whisper-${simpleModel}`;
  }

  return null;
}

function normalizedIdentifier(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function modelDisplayToken(model: string): string {
  return basename(model).replace(/^ggml-/, "").replace(/\.bin$/, "");
}

function providerAlreadyIncludesModel(provider: string, model: string): boolean {
  const normalizedProvider = normalizedIdentifier(provider);
  const normalizedModel = normalizedIdentifier(model);
  const normalizedModelToken = normalizedIdentifier(modelDisplayToken(model));
  return normalizedProvider.includes(normalizedModel) || normalizedProvider.includes(normalizedModelToken);
}

function providerDisplayName(providerKey: string, provider: string | null, model: string | null): string {
  const whisperName = localWhisperDisplayName(providerKey, provider, model);
  if (whisperName) {
    return whisperName;
  }
  if (provider && provider !== providerKey && !looksLikeRawModelPath(provider)) {
    if (!model || provider === model || providerAlreadyIncludesModel(provider, model)) {
      return provider;
    }
    if (!looksLikeRawModelPath(model)) {
      return providerKey;
    }
  }
  if (looksLikeRawModelPath(providerKey) && model && !looksLikeRawModelPath(model)) {
    return model;
  }
  return providerKey;
}

function providerMarkdownCode(provider: { providerKey: string; provider?: string | null; model?: string | null }): string {
  return markdownCode(providerDisplayName(provider.providerKey, provider.provider ?? null, provider.model ?? null));
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
    const nestedMetrics = isRecord(record.metrics) ? record.metrics : {};
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
        wer: asNumber(record.wer) ?? asNumber(nestedMetrics.wer),
        cer: asNumber(record.cer) ?? asNumber(nestedMetrics.cer),
        speakerAwareWER: asNumber(record.speakerAwareWER) ?? asNumber(nestedMetrics.speakerAwareWER),
        textOnlyWER: asNumber(record.textOnlyWER) ?? asNumber(nestedMetrics.textOnlyWER),
        roundtripWER: asNumber(record.roundtripWER) ?? asNumber(nestedMetrics.roundtripWER),
        contentCoverage: asNumber(record.contentCoverage) ?? asNumber(nestedMetrics.contentCoverage),
        score: asNumber(record.score) ?? asNumber(nestedMetrics.score),
        qualityScore: asNumber(record.qualityScore) ?? asNumber(record.voiceQualityScore) ?? asNumber(nestedMetrics.qualityScore),
        humanQualityScore: asNumber(record.humanQualityScore) ?? asNumber(nestedMetrics.humanQualityScore),
        humanSpeechScore: asNumber(record.humanSpeechScore) ?? asNumber(nestedMetrics.humanSpeechScore),
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

function addProviderGroupRecords(map: Map<string, ProviderSummary>, value: unknown): void {
  if (!isRecord(value)) {
    return;
  }
  for (const [groupName, groupValue] of Object.entries(value)) {
    const normalizedGroup = groupName === "local" ? "local" : "service";
    addRecords(map, recordsFromNested(groupValue), normalizedGroup);
  }
}

function extractProviders(category: ConsensusCategory, report: Record<string, unknown>): ProviderSummary[] {
  const map = new Map<string, ProviderSummary>();

  addRecords(map, recordsFromNested(report.local), "local");
  addRecords(map, recordsFromNested(report.cloud), "service");
  addRecords(map, recordsFromNested(report.hosted), "service");
  addRecords(map, recordsFromNested(report.service), "service");
  addProviderGroupRecords(map, report.providerGroups);
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
  if (category === "tts" && metrics.humanSpeechScore !== null) {
    return {
      kind: "higher-is-better",
      metric: "humanSpeechScore",
      value: metrics.humanSpeechScore,
      label: `${metrics.humanSpeechScore.toFixed(2)} humanSpeechScore`,
      tieBreakers: [],
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

function surfaceEntry(provider: ProviderSummary, rank: number, metric: string, value: number | null, label: string): RankingEntry {
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

function supportsDiarization(provider: ProviderSummary): boolean | null {
  if (typeof provider.source.supportsDiarization === "boolean") {
    return provider.source.supportsDiarization;
  }
  const support = asString(provider.source.diarizationSupport);
  if (support === "supported") {
    return true;
  }
  if (support === "not-supported") {
    return false;
  }
  return null;
}

function metricGroupForProvider(category: ConsensusCategory, provider: ProviderSummary): MetricRankingGroupName {
  if (category === "ocr") {
    return provider.group === "local" ? "local" : "thirdPartyService";
  }
  if (provider.group === "local") {
    return "local";
  }
  return supportsDiarization(provider) === true ? "thirdPartyServiceDiarization" : "thirdPartyServiceNonDiarization";
}

function metricGroupLabels(category: ConsensusCategory): Array<{ key: MetricRankingGroupName; label: string }> {
  if (category === "ocr") {
    return [
      { key: "local", label: "Local" },
      { key: "thirdPartyService", label: "Third-Party Service" },
    ];
  }
  return [
    { key: "local", label: "Local" },
    { key: "thirdPartyServiceNonDiarization", label: "Third-Party Service Non-Diarization" },
    { key: "thirdPartyServiceDiarization", label: "Third-Party Service Diarization" },
  ];
}

function metricRankingEntry(
  category: ConsensusCategory,
  provider: ProviderSummary,
  rank: number,
  metric: MetricRankingName,
  value: number | null,
  label: string,
): MetricRankingEntry {
  return {
    rank,
    providerKey: provider.providerKey,
    provider: provider.provider,
    model: provider.model,
    group: metricGroupForProvider(category, provider),
    metric,
    value,
    label,
    actualCostCents: provider.group === "local" ? 0 : provider.costCents,
    processingTimeMs: provider.processingTimeMs,
    score: provider.metrics.score ?? null,
    wer: provider.metrics.wer ?? null,
    cer: provider.metrics.cer ?? null,
    speakerAwareWER: provider.metrics.speakerAwareWER ?? null,
    textOnlyWER: provider.metrics.textOnlyWER ?? null,
    supportsDiarization: supportsDiarization(provider),
    diarizationSupport: asString(provider.source.diarizationSupport),
  };
}

function compareNullableAscending(left: number | null, right: number | null): number {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left - right;
}

function buildPriceMetricRanking(category: ConsensusCategory, providers: ProviderSummary[]): MetricRankingEntry[] {
  return [...providers]
    .sort((left, right) => {
      const leftPrice = left.group === "local" ? 0 : left.costCents;
      const rightPrice = right.group === "local" ? 0 : right.costCents;
      return compareNullableAscending(leftPrice, rightPrice) || left.providerKey.localeCompare(right.providerKey);
    })
    .map((provider, index) => {
      const value = provider.group === "local" ? 0 : provider.costCents;
      const label = provider.group === "local" ? "$0.00 local monetary cost" : formatCents(value);
      return metricRankingEntry(category, provider, index + 1, "price", value, label);
    });
}

function buildSpeedMetricRanking(category: ConsensusCategory, providers: ProviderSummary[]): MetricRankingEntry[] {
  return [...providers]
    .sort((left, right) =>
      compareNullableAscending(left.processingTimeMs, right.processingTimeMs) || left.providerKey.localeCompare(right.providerKey)
    )
    .map((provider, index) =>
      metricRankingEntry(category, provider, index + 1, "speed", provider.processingTimeMs, formatDurationMs(provider.processingTimeMs))
    );
}

function buildQualityMetricRanking(category: ConsensusCategory, providers: ProviderSummary[]): MetricRankingEntry[] {
  return [...providers]
    .sort((left, right) => {
      const leftScore = left.metrics.score;
      const rightScore = right.metrics.score;
      if (leftScore === null && rightScore !== null) {
        return 1;
      }
      if (leftScore !== null && rightScore === null) {
        return -1;
      }
      if (leftScore !== null && rightScore !== null && leftScore !== rightScore) {
        return rightScore - leftScore;
      }
      if (category === "ocr") {
        const werOrder = compareNullableAscending(left.metrics.wer, right.metrics.wer);
        if (werOrder !== 0) {
          return werOrder;
        }
        const cerOrder = compareNullableAscending(left.metrics.cer, right.metrics.cer);
        if (cerOrder !== 0) {
          return cerOrder;
        }
      }
      if (category === "stt") {
        const speakerAwareOrder = compareNullableAscending(left.metrics.speakerAwareWER, right.metrics.speakerAwareWER);
        if (speakerAwareOrder !== 0) {
          return speakerAwareOrder;
        }
        const textOnlyOrder = compareNullableAscending(left.metrics.textOnlyWER, right.metrics.textOnlyWER);
        if (textOnlyOrder !== 0) {
          return textOnlyOrder;
        }
      }
      return left.providerKey.localeCompare(right.providerKey);
    })
    .map((provider, index) => {
      const score = provider.metrics.score;
      const label = score === null ? "n/a" : `${score.toFixed(2)}/100 quality score`;
      return metricRankingEntry(category, provider, index + 1, "qualityScore", score, label);
    });
}

function buildMetricRankings(category: ConsensusCategory, providers: ProviderSummary[]): MetricRankings | null {
  if (category !== "ocr" && category !== "stt") {
    return null;
  }

  const rankings: Partial<Record<MetricRankingGroupName, MetricRankingGroup>> = {};
  for (const { key } of metricGroupLabels(category)) {
    const groupProviders = providers.filter((provider) => metricGroupForProvider(category, provider) === key);
    rankings[key] = {
      price: buildPriceMetricRanking(category, groupProviders),
      speed: buildSpeedMetricRanking(category, groupProviders),
      qualityScore: buildQualityMetricRanking(category, groupProviders),
    };
  }
  return rankings as MetricRankings;
}

function fullSpeedRanking(providers: ProviderSummary[], group: ProviderGroup): { entries: RankingEntry[]; reason: string | null } {
  if (providers.length === 0) {
    return { entries: [], reason: `No ${group} providers were found.` };
  }
  const entries = [...providers]
    .sort((left, right) =>
      compareNullableAscending(left.processingTimeMs, right.processingTimeMs) || left.providerKey.localeCompare(right.providerKey)
    )
    .map((provider, index) => surfaceEntry(provider, index + 1, "processingTimeMs", provider.processingTimeMs, formatDurationMs(provider.processingTimeMs)));
  return { entries, reason: null };
}

function fullPriceRanking(providers: ProviderSummary[], group: ProviderGroup): { entries: RankingEntry[]; reason: string | null } {
  if (providers.length === 0) {
    return { entries: [], reason: `No ${group} providers were found.` };
  }

  if (group === "local") {
    const entries = [...providers]
      .sort((left, right) => left.providerKey.localeCompare(right.providerKey))
      .map((provider, index) => surfaceEntry(provider, index + 1, "local monetary cost", 0, "$0.00 local monetary cost"));
    return { entries, reason: null };
  }

  const entries = [...providers]
    .sort((left, right) => compareNullableAscending(left.costCents, right.costCents) || left.providerKey.localeCompare(right.providerKey))
    .map((provider, index) => surfaceEntry(provider, index + 1, "costCents", provider.costCents, formatCents(provider.costCents)));
  return { entries, reason: null };
}

function urlAccuracyScore(provider: ProviderSummary): number | null {
  const wer = provider.metrics.wer;
  const cer = provider.metrics.cer;
  const coverage = provider.metrics.contentCoverage;
  if (wer === null || cer === null || coverage === null) {
    return null;
  }
  const score = ((1 - wer) * 0.5) + ((1 - cer) * 0.25) + (coverage * 0.25);
  return Math.min(100, Math.max(0, score * 100));
}

function automatedQualityReason(category: ConsensusCategory, group: ProviderGroup): string {
  if (category === "tts") {
    return `No roundtrip WER was available for ${group} providers. Duration, bitrate, and file size are not used as automated quality proxies.`;
  }
  if (category === "url") {
    return `No WER/CER/coverage evidence was available for ${group} providers. Cost and speed are not used as automated quality proxies.`;
  }
  return `No explicit ${CATEGORY_TITLES[category].toLowerCase()} qualityScore was available for ${group} providers. File size, dimensions, duration, bitrate, cost, and speed are not used as automated quality proxies.`;
}

function fullAutomatedQualityRanking(
  category: ConsensusCategory,
  providers: ProviderSummary[],
  group: ProviderGroup,
): { entries: RankingEntry[]; reason: string | null } {
  if (providers.length === 0) {
    return { entries: [], reason: `No ${group} providers were found.` };
  }

  if (category === "url") {
    const withAccuracy = providers.filter((provider) => urlAccuracyScore(provider) !== null);
    if (withAccuracy.length === 0) {
      return { entries: [], reason: automatedQualityReason(category, group) };
    }
    const entries = withAccuracy
      .sort((left, right) => {
        const leftScore = urlAccuracyScore(left) ?? Number.NEGATIVE_INFINITY;
        const rightScore = urlAccuracyScore(right) ?? Number.NEGATIVE_INFINITY;
        if (leftScore !== rightScore) {
          return rightScore - leftScore;
        }
        return compareNullableAscending(left.metrics.wer, right.metrics.wer)
          || compareNullableAscending(left.metrics.cer, right.metrics.cer)
          || compareNullableAscending(
            left.metrics.contentCoverage === null ? null : -left.metrics.contentCoverage,
            right.metrics.contentCoverage === null ? null : -right.metrics.contentCoverage,
          )
          || left.providerKey.localeCompare(right.providerKey);
      })
      .map((provider, index) => {
        const accuracy = urlAccuracyScore(provider) ?? 0;
        return surfaceEntry(
          provider,
          index + 1,
          "WER/CER/coverage accuracy",
          accuracy,
          `${accuracy.toFixed(2)} accuracy (${formatPercent(provider.metrics.wer)} WER, ${formatPercent(provider.metrics.cer)} CER, ${formatPercent(provider.metrics.contentCoverage)} coverage)`,
        );
      });
    return { entries, reason: null };
  }

  if (category === "image" || category === "music" || category === "video") {
    const withQualityScore = providers.filter((provider) => provider.metrics.qualityScore !== null);
    if (withQualityScore.length === 0) {
      return { entries: [], reason: automatedQualityReason(category, group) };
    }
    const entries = withQualityScore
      .sort((left, right) =>
        (right.metrics.qualityScore ?? Number.NEGATIVE_INFINITY) - (left.metrics.qualityScore ?? Number.NEGATIVE_INFINITY)
        || left.providerKey.localeCompare(right.providerKey)
      )
      .map((provider, index) =>
        surfaceEntry(
          provider,
          index + 1,
          "qualityScore",
          provider.metrics.qualityScore,
          `${(provider.metrics.qualityScore ?? 0).toFixed(2)}/100 explicit quality score`,
        )
      );
    return { entries, reason: null };
  }

  const withWer = providers.filter((provider) => provider.metrics.roundtripWER !== null);
  if (withWer.length === 0) {
    return { entries: [], reason: automatedQualityReason(category, group) };
  }
  const entries = withWer
    .sort((left, right) => {
      const leftWer = left.metrics.roundtripWER ?? Number.POSITIVE_INFINITY;
      const rightWer = right.metrics.roundtripWER ?? Number.POSITIVE_INFINITY;
      if (leftWer !== rightWer) {
        return leftWer - rightWer;
      }
      return left.providerKey.localeCompare(right.providerKey);
    })
    .map((provider, index) => {
      const wer = provider.metrics.roundtripWER ?? 1;
      const accuracy = Math.max(0, 100 * (1 - wer));
      return surfaceEntry(
        provider,
        index + 1,
        "roundtrip WER accuracy",
        accuracy,
        `${accuracy.toFixed(2)} accuracy (${formatPercent(wer)} roundtrip WER)`,
      );
    });
  return { entries, reason: null };
}

function humanQualityValue(category: ConsensusCategory, provider: ProviderSummary): number | null {
  return category === "tts" ? provider.metrics.humanSpeechScore : provider.metrics.humanQualityScore;
}

function humanQualityMetric(category: ConsensusCategory): string {
  return category === "tts" ? "humanSpeechScore" : "humanQualityScore";
}

function humanQualityReason(category: ConsensusCategory, group: ProviderGroup): string {
  if (category === "tts") {
    return `No humanSpeechScore from voice-quality-report.json was available for ${group} providers. Duration, bitrate, and file size are not used as human quality proxies.`;
  }
  return `No explicit humanQualityScore was available for ${group} providers. Generic quality scores, cost, speed, and artifact metadata are not used as human quality proxies.`;
}

function fullHumanQualityRanking(
  category: ConsensusCategory,
  providers: ProviderSummary[],
  group: ProviderGroup,
): { entries: RankingEntry[]; reason: string | null } {
  if (providers.length === 0) {
    return { entries: [], reason: `No ${group} providers were found.` };
  }
  const withHumanScore = providers.filter((provider) => humanQualityValue(category, provider) !== null);
  if (withHumanScore.length === 0) {
    return { entries: [], reason: humanQualityReason(category, group) };
  }
  const entries = withHumanScore
    .sort((left, right) => {
      const leftScore = humanQualityValue(category, left) ?? Number.NEGATIVE_INFINITY;
      const rightScore = humanQualityValue(category, right) ?? Number.NEGATIVE_INFINITY;
      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }
      return left.providerKey.localeCompare(right.providerKey);
    })
    .map((provider, index) =>
      surfaceEntry(
        provider,
        index + 1,
        humanQualityMetric(category),
        humanQualityValue(category, provider),
        `${(humanQualityValue(category, provider) ?? 0).toFixed(2)} ${humanQualityMetric(category)}`,
      )
    );
  return { entries, reason: null };
}

function dropCombinedOverallFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(dropCombinedOverallFields);
  }
  if (!isRecord(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "overallRank" || key === "overallScore" || key === "overallComponents") {
      continue;
    }
    sanitized[key] = dropCombinedOverallFields(child);
  }
  return sanitized;
}

function reportNotes(sourceReport: Record<string, unknown>): string[] {
  if (!Array.isArray(sourceReport.notes)) {
    return [];
  }
  return sourceReport.notes.filter((note): note is string => {
    if (typeof note !== "string") {
      return false;
    }
    return !/^Best overall(?: provider)?:/i.test(note)
      && !/^Worst overall(?: provider)?:/i.test(note)
      && !/^Fastest provider:/i.test(note)
      && !/^The cheapest providers? (?:was|were) /i.test(note)
      && !/^Ranking used /i.test(note);
  });
}

function buildRankingSurfaces(category: ConsensusCategory, providers: ProviderSummary[]): RankingSurfaces {
  const buildGroup = (group: ProviderGroup): SurfaceGroup => {
    const groupProviders = providers.filter((provider) => provider.group === group);
    const price = fullPriceRanking(groupProviders, group);
    const speed = fullSpeedRanking(groupProviders, group);
    const automatedQuality = fullAutomatedQualityRanking(category, groupProviders, group);
    const humanQuality = fullHumanQualityRanking(category, groupProviders, group);
    const qualityAlias = humanQuality.entries.length > 0 ? humanQuality : automatedQuality;
    return {
      fastest: speed.entries,
      cheapest: price.entries,
      highestQuality: qualityAlias.entries,
      fastestUnavailableReason: speed.reason,
      cheapestUnavailableReason: price.reason,
      highestQualityUnavailableReason: qualityAlias.reason,
      price: price.entries,
      speed: speed.entries,
      automatedQuality: automatedQuality.entries,
      humanQuality: humanQuality.entries,
      priceUnavailableReason: price.reason,
      speedUnavailableReason: speed.reason,
      automatedQualityUnavailableReason: automatedQuality.reason,
      humanQualityUnavailableReason: humanQuality.reason,
    };
  };

  return {
    local: buildGroup("local"),
    service: buildGroup("service"),
  };
}

function providerDetailMetrics(category: ConsensusCategory, metrics: Record<string, number | null>): Record<string, number | null> {
  if (category === "ocr" || category === "stt") {
    return metrics;
  }
  const { score: _score, ...rest } = metrics;
  return rest;
}

function providerDetail(category: ConsensusCategory, provider: ProviderSummary): Record<string, unknown> {
  const detail: Record<string, unknown> = {
    providerKey: provider.providerKey,
    provider: provider.provider,
    model: provider.model,
    group: category === "ocr" || category === "stt" ? metricGroupForProvider(category, provider) : provider.group,
    processingTimeMs: provider.processingTimeMs,
    costCents: provider.group === "local" ? 0 : provider.costCents,
    qualityMetric: provider.quality?.metric ?? null,
    qualityValue: provider.quality?.value ?? null,
    qualityLabel: provider.quality?.label ?? null,
    metrics: providerDetailMetrics(category, provider.metrics),
    supportsDiarization: provider.source.supportsDiarization ?? null,
    diarizationSupport: provider.source.diarizationSupport ?? null,
    qualityWarnings: provider.source.qualityWarnings ?? [],
    segmentStats: provider.source.segmentStats ?? null,
    duplicateGroupId: provider.source.duplicateGroupId ?? null,
  };
  if (category === "ocr" || category === "stt") {
    detail.tokenEstimate = provider.source.tokenEstimate ?? null;
    detail.tokenCount = provider.source.tokenCount ?? null;
    detail.werBreakdown = provider.source.werBreakdown ?? null;
    detail.cerBreakdown = provider.source.cerBreakdown ?? null;
    detail.textOnlyBreakdown = provider.source.textOnlyBreakdown ?? null;
    detail.speakerAwareBreakdown = provider.source.speakerAwareBreakdown ?? null;
  }
  if (category !== "ocr" && category !== "stt") {
    detail.tierGroup = provider.source.tierGroup ?? null;
    detail.groupOverallRank = provider.source.groupOverallRank ?? null;
    detail.groupTier = provider.source.groupTier ?? null;
  }
  return detail;
}

function buildProviderGroups(category: ConsensusCategory, providers: ProviderSummary[]): ProviderGroups {
  if (category === "ocr" || category === "stt") {
    const groups: ProviderGroups = {};
    for (const { key } of metricGroupLabels(category)) {
      const groupProviders = providers.filter((provider) => metricGroupForProvider(category, provider) === key);
      groups[key] = {
        count: groupProviders.length,
        providers: groupProviders.map((provider) => providerDetail(category, provider)),
      };
    }
    return groups;
  }

  const localProviders = providers.filter((provider) => provider.group === "local");
  const serviceProviders = providers.filter((provider) => provider.group === "service");
  return {
    local: {
      count: localProviders.length,
      providers: localProviders.map((provider) => providerDetail(category, provider)),
    },
    service: {
      count: serviceProviders.length,
      providers: serviceProviders.map((provider) => providerDetail(category, provider)),
    },
  };
}

function buildJsonReport(
  category: ConsensusCategory,
  sourceReport: Record<string, unknown>,
  providers: ProviderSummary[],
  rankingSurfaces: RankingSurfaces,
): Record<string, unknown> {
  const runDir = asString(sourceReport.runDir) ?? "";
  const providerGroups = buildProviderGroups(category, providers);

  if (category === "ocr" || category === "stt") {
    const metricRankings = buildMetricRankings(category, providers);
    return {
      schemaVersion: asNumber(sourceReport.schemaVersion) ?? 2,
      kind: `${category}-provider-comparison`,
      category,
      runDir,
      runName: runDir ? basename(runDir) : null,
      generatedAt: new Date().toISOString(),
      metric: sourceReport.metric ?? null,
      scoreFormula: sourceReport.scoreFormula ?? null,
      ...(sourceReport.werFormula ? { werFormula: sourceReport.werFormula } : {}),
      ...(sourceReport.consensusExtractionPath ? { consensusExtractionPath: sourceReport.consensusExtractionPath } : {}),
      ...(sourceReport.consensusCharCount ? { consensusCharCount: sourceReport.consensusCharCount } : {}),
      ...(sourceReport.consensusWordCount ? { consensusWordCount: sourceReport.consensusWordCount } : {}),
      ...(sourceReport.referenceTranscriptPath ? { referenceTranscriptPath: sourceReport.referenceTranscriptPath } : {}),
      normalization: sourceReport.normalization ?? null,
      duplicateGroups: sourceReport.duplicateGroups ?? [],
      providerCount: providers.length,
      providerGroups,
      metricRankings,
      rankingPolicy: "grouped full metric rankings; local and third-party service providers are not ranked against each other",
      notes: reportNotes(sourceReport),
    };
  }

  return {
    schemaVersion: 2,
    kind: `${category}-provider-comparison`,
    category,
    runDir,
    runName: runDir ? basename(runDir) : null,
    generatedAt: new Date().toISOString(),
    metric: sourceReport.metric ?? null,
    scoreFormula: sourceReport.scoreFormula ?? null,
    ...(category === "tts" ? { tiering: dropCombinedOverallFields(sourceReport.tiering ?? null) } : {}),
    duplicateGroups: sourceReport.duplicateGroups ?? [],
    normalization: sourceReport.normalization ?? null,
    providerCount: providers.length,
    providerGroups,
    rankingSurfaces,
    combinedLeaderboardPolicy: "omitted: local and service providers are not ranked against each other",
    notes: reportNotes(sourceReport),
  };
}

function markdownTable(entries: RankingEntry[]): string {
  if (entries.length === 0) {
    return "";
  }
  return [
    "| Rank | Provider | Evidence |",
    "| ---: | --- | --- |",
    ...entries.map((entry) => markdownRow([String(entry.rank), providerMarkdownCode(entry), entry.label])),
  ].join("\n");
}

function metricMarkdownTable(category: ConsensusCategory, entries: MetricRankingEntry[]): string {
  if (category === "ocr") {
    const header = "| Rank | Provider | Value | Score / 100 | WER | CER | Processing Time | Actual Cost |";
    const alignment = "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |";
    if (entries.length === 0) {
      return [header, alignment, "| n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |"].join("\n");
    }
    return [
      header,
      alignment,
      ...entries.map((entry) =>
        markdownRow([
          String(entry.rank),
          providerMarkdownCode(entry),
          entry.label,
          formatNullableScore(entry.score),
          formatPercent(entry.wer),
          formatPercent(entry.cer),
          formatDurationMs(entry.processingTimeMs),
          formatCents(entry.actualCostCents),
        ])
      ),
    ].join("\n");
  }

  const header = "| Rank | Provider | Value | Score / 100 | Speaker-aware WER | Text-only WER | Diarization | Processing Time | Actual Cost |";
  const alignment = "| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |";
  if (entries.length === 0) {
    return [header, alignment, "| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |"].join("\n");
  }

  return [
    header,
    alignment,
    ...entries.map((entry) =>
      markdownRow([
        String(entry.rank),
        providerMarkdownCode(entry),
        entry.label,
        formatNullableScore(entry.score),
        formatPercent(entry.speakerAwareWER),
        formatPercent(entry.textOnlyWER),
        entry.diarizationSupport ?? "n/a",
        formatDurationMs(entry.processingTimeMs),
        formatCents(entry.actualCostCents),
      ])
    ),
  ].join("\n");
}

function metricSurfaceMarkdown(category: ConsensusCategory, title: string, entries: MetricRankingEntry[]): string {
  return [`#### ${title}`, "", metricMarkdownTable(category, entries)].join("\n");
}

function metricRankingsMarkdown(category: ConsensusCategory, providers: ProviderSummary[]): string {
  const rankings = buildMetricRankings(category, providers);
  if (!rankings) {
    return "";
  }
  const rankingGroups = rankings as Partial<Record<MetricRankingGroupName, MetricRankingGroup>>;
  return [
    "## Metric Rankings",
    "",
    ...metricGroupLabels(category).flatMap(({ key, label }) => {
      const group = rankingGroups[key];
      return [
        `### ${label}`,
        "",
        metricSurfaceMarkdown(category, "Price", group?.price ?? []),
        "",
        metricSurfaceMarkdown(category, "Speed", group?.speed ?? []),
        "",
        metricSurfaceMarkdown(category, "Quality Score", group?.qualityScore ?? []),
        "",
      ];
    }),
  ].join("\n");
}

function metricGroupLabel(category: ConsensusCategory, provider: ProviderSummary): string {
  const group = metricGroupForProvider(category, provider);
  return metricGroupLabels(category).find((entry) => entry.key === group)?.label ?? group;
}

function ocrProviderDetailTable(providers: ProviderSummary[]): string {
  return [
    "| Provider | Group | Score / 100 | WER | CER | Processing Time | Actual Cost |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...providers.map((provider) => {
      const cost = provider.group === "local" ? "$0.00" : formatCents(provider.costCents);
      return markdownRow([
        providerMarkdownCode(provider),
        metricGroupLabel("ocr", provider),
        formatNullableScore(provider.metrics.score),
        formatPercent(provider.metrics.wer),
        formatPercent(provider.metrics.cer),
        formatDurationMs(provider.processingTimeMs),
        cost,
      ]);
    }),
  ].join("\n");
}

function sttProviderDetailTable(providers: ProviderSummary[]): string {
  return [
    "| Provider | Group | Diarization | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Actual Cost |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...providers.map((provider) => {
      const cost = provider.group === "local" ? "$0.00" : formatCents(provider.costCents);
      return markdownRow([
        providerMarkdownCode(provider),
        metricGroupLabel("stt", provider),
        asString(provider.source.diarizationSupport) ?? "n/a",
        formatNullableScore(provider.metrics.score),
        formatPercent(provider.metrics.speakerAwareWER),
        formatPercent(provider.metrics.textOnlyWER),
        formatDurationMs(provider.processingTimeMs),
        cost,
      ]);
    }),
  ].join("\n");
}

function formatNullableScore(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(2);
}

function breakdownNumber(record: Record<string, unknown> | null, key: string): string {
  const value = record ? asNumber(record[key]) : null;
  return value === null ? "n/a" : String(value);
}

function ocrErrorBreakdownTable(providers: ProviderSummary[]): string {
  return [
    "| Provider | Substitutions | Deletions | Insertions | Ref. Words |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...providers.map((provider) => {
      const breakdown = isRecord(provider.source.werBreakdown) ? provider.source.werBreakdown : null;
      return markdownRow([
        providerMarkdownCode(provider),
        breakdownNumber(breakdown, "substitutions"),
        breakdownNumber(breakdown, "deletions"),
        breakdownNumber(breakdown, "insertions"),
        breakdownNumber(breakdown, "referenceCount"),
      ]);
    }),
  ].join("\n");
}

function sttErrorBreakdownTable(providers: ProviderSummary[], key: "textOnlyBreakdown" | "speakerAwareBreakdown"): string {
  return [
    "| Provider | Substitutions | Deletions | Insertions | Ref. Words |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...providers.map((provider) => {
      const breakdown = isRecord(provider.source[key]) ? provider.source[key] : null;
      return markdownRow([
        providerMarkdownCode(provider),
        breakdownNumber(breakdown, "substitutions"),
        breakdownNumber(breakdown, "deletions"),
        breakdownNumber(breakdown, "insertions"),
        breakdownNumber(breakdown, "referenceWordCount"),
      ]);
    }),
  ].join("\n");
}

function qualityFlagsTable(providers: ProviderSummary[]): string {
  const rows = providers
    .map((provider) => {
      const warnings = Array.isArray(provider.source.qualityWarnings)
        ? provider.source.qualityWarnings.filter((warning): warning is string => typeof warning === "string")
        : [];
      return warnings.length > 0
        ? markdownRow([providerMarkdownCode(provider), warnings.join("<br>")])
        : null;
    })
    .filter((row): row is string => row !== null);
  if (rows.length === 0) {
    return "No provider quality flags were detected.";
  }
  return ["| Provider | Quality Flags |", "| --- | --- |", ...rows].join("\n");
}

function duplicateGroupsTable(sourceReport: Record<string, unknown>): string {
  const groups = asArray(sourceReport.duplicateGroups);
  if (groups.length === 0) {
    return "No duplicate transcript groups were detected.";
  }
  return [
    "| Group | Providers |",
    "| --- | --- |",
    ...groups.map((group) => {
      const providers = Array.isArray(group.providers)
        ? group.providers.filter((provider): provider is string => typeof provider === "string")
        : [];
      return markdownRow([
        asString(group.id) ?? "duplicate",
        providers.map((provider) => markdownCode(providerDisplayName(provider, null, null))).join(", ") || "n/a",
      ]);
    }),
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
      return markdownRow([
        providerMarkdownCode(provider),
        provider.quality?.label ?? "n/a",
        formatDurationMs(provider.processingTimeMs),
        cost,
      ]);
    }),
  ].join("\n");
}

function groupMarkdown(label: string, group: ProviderGroup, providers: ProviderSummary[], surfaces: SurfaceGroup): string {
  return [
    `## ${label} Providers`,
    "",
    surfaceMarkdown("Price", surfaces.price, surfaces.priceUnavailableReason),
    "",
    surfaceMarkdown("Speed", surfaces.speed, surfaces.speedUnavailableReason),
    "",
    surfaceMarkdown("Automated Quality", surfaces.automatedQuality, surfaces.automatedQualityUnavailableReason),
    "",
    surfaceMarkdown("Human Quality", surfaces.humanQuality, surfaces.humanQualityUnavailableReason),
    "",
    "### Provider Detail",
    "",
    detailTable(providers, group),
  ].join("\n");
}

function ttsGroupMarkdown(label: string, group: ProviderGroup, providers: ProviderSummary[], surfaces: SurfaceGroup): string {
  return [
    `## ${label}`,
    "",
    surfaceMarkdown("Price", surfaces.price ?? [], surfaces.priceUnavailableReason ?? null),
    "",
    surfaceMarkdown("Speed", surfaces.speed ?? [], surfaces.speedUnavailableReason ?? null),
    "",
    surfaceMarkdown("Automated Quality", surfaces.automatedQuality ?? [], surfaces.automatedQualityUnavailableReason ?? null),
    "",
    surfaceMarkdown("Human Quality", surfaces.humanQuality ?? [], surfaces.humanQualityUnavailableReason ?? null),
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
  const notes = reportNotes(sourceReport);
  const localProviders = providers.filter((provider) => provider.group === "local");
  const serviceProviders = providers.filter((provider) => provider.group === "service");
  const notesBlock = notes.length > 0 ? notes.map((note) => `- ${note}`).join("\n") : "- No additional notes.";

  if (category === "ocr") {
    return [
      "# OCR Provider Comparison Report",
      "",
      "## Summary",
      "",
      `- Run directory: \`${runDir}\``,
      `- Total providers: ${providers.length} (${localProviders.length} local, ${serviceProviders.length} third-party service)`,
      "- Local and third-party service providers are ranked separately for price, speed, and quality score.",
      "- Quality score uses WER-derived extraction accuracy, with CER retained as supporting evidence and tie-breaker context.",
      "",
      "## Method",
      "",
      "- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.",
      "- Speed rankings use processing time when present; missing timing stays in the ranking at the end.",
      "- Quality Score rankings sort by the existing WER-derived provider score from highest to lowest.",
      "",
      metricRankingsMarkdown(category, providers),
      "",
      "## Provider Detail",
      "",
      ocrProviderDetailTable(providers),
      "",
      "## Error Breakdown (WER)",
      "",
      ocrErrorBreakdownTable(providers),
      "",
      "## Notes",
      "",
      notesBlock,
      "",
    ].join("\n");
  }

  if (category === "stt") {
    return [
      "# Consensus Transcript Comparison Report",
      "",
      "## Summary",
      "",
      `- Run directory: \`${runDir}\``,
      `- Total providers: ${providers.length} (${localProviders.length} local, ${serviceProviders.length} third-party service)`,
      "- Local, third-party non-diarization, and third-party diarization providers are ranked separately for price, speed, and quality score.",
      "- Quality score uses speaker-aware WER-derived transcript accuracy, with text-only WER retained as supporting evidence.",
      "",
      "## Method",
      "",
      "- Price rankings use zero monetary cost for local providers and reported monetary cost for third-party services; missing service price stays in the ranking at the end.",
      "- Speed rankings use processing time when present; missing timing stays in the ranking at the end.",
      "- Quality Score rankings sort by the existing speaker-aware WER-derived provider score from highest to lowest.",
      "- Third-party service rankings are split by whether the normalized provider result supports diarization.",
      "",
      metricRankingsMarkdown(category, providers),
      "",
      "## Provider Detail",
      "",
      sttProviderDetailTable(providers),
      "",
      "## Error Breakdown (Speaker-aware)",
      "",
      sttErrorBreakdownTable(providers, "speakerAwareBreakdown"),
      "",
      "## Error Breakdown (Text-only)",
      "",
      sttErrorBreakdownTable(providers, "textOnlyBreakdown"),
      "",
      "## Quality Flags",
      "",
      qualityFlagsTable(providers),
      "",
      "## Duplicate Groups",
      "",
      duplicateGroupsTable(sourceReport),
      "",
      "## Notes",
      "",
      notesBlock,
      "",
    ].join("\n");
  }

  if (category === "tts") {
    return [
      "# TTS Provider Comparison Report",
      "",
      "## Summary",
      "",
      `- Run directory: \`${runDir}\``,
      `- Total providers: ${providers.length} (${localProviders.length} local, ${serviceProviders.length} service)`,
      "- Local models and third-party service models are intentionally not ranked against each other.",
      "- Reports expose complete price, speed, automated-quality, and human-quality rankings for each group.",
      "",
      "## Method",
      "",
      "- Price rankings use zero monetary cost for local models and reported monetary cost for services.",
      "- Speed rankings use processing time when present.",
      "- Automated quality rankings use roundtrip WER-derived accuracy when present.",
      "- Human quality rankings use humanSpeechScore from voice-quality-report.json when present.",
      "- Duration, bitrate, file size, and subjective judgment are not used as quality proxies.",
      "",
      ttsGroupMarkdown("Local Models", "local", localProviders, rankingSurfaces.local),
      "",
      ttsGroupMarkdown("Third-Party Service Models", "service", serviceProviders, rankingSurfaces.service),
      "",
      "## Notes",
      "",
      notesBlock,
      "",
    ].join("\n");
  }

  return [
    `# ${CATEGORY_TITLES[category]} Provider Comparison Report`,
    "",
    "## Summary",
    "",
    `- Run directory: \`${runDir}\``,
    `- Total providers: ${providers.length} (${localProviders.length} local, ${serviceProviders.length} service)`,
    "- Local and service providers are intentionally not ranked against each other.",
    "- Reports expose complete price, speed, automated-quality, and human-quality rankings for each group.",
    "",
    "## Method",
    "",
    "- Price rankings use zero monetary cost for local providers and reported monetary cost for services; missing service price stays in the ranking at the end.",
    "- Speed rankings use processing time when present; missing timing stays in the ranking at the end.",
    category === "url"
      ? "- Automated quality rankings use WER/CER/coverage-derived extraction accuracy."
      : "- Automated quality rankings use only explicit qualityScore evidence.",
    "- Human quality rankings use only explicit humanQualityScore evidence.",
    "- File size, dimensions, duration, bitrate, cost, and speed are not used as quality proxies.",
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
