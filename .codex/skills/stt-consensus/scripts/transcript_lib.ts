#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export interface Segment {
  start: number;
  end: number;
  speaker: string;
  text: string;
  rawStart: string;
  rawEnd: string;
}

export interface ProviderRun {
  directoryName: string;
  provider: string;
  model: string;
  providerKey: string;
  resultPath: string;
  transcriptionPath: string | null;
  segments: Segment[];
  text: string;
  tokenCount: number | null;
  processingTimeMs: number | null;
  actualCostCents: number | null;
  timingQuality: string | null;
  hasSpeakerLabels: boolean | null;
  rawResponse: unknown;
}

interface RunStepCostEntry {
  provider?: string;
  model?: string;
  cost?: number;
}

interface RunStepTimingEntry {
  provider?: string;
  model?: string;
  processingTimeMs?: number;
}

interface RunProviderState {
  artifactDir?: string;
}

interface RunJson {
  metadata?: {
    step1?: {
      duration?: string;
      durationSeconds?: number;
    };
    providerStates?: RunProviderState[];
    cost?: {
      actual?: {
        steps?: RunStepCostEntry[];
      };
    };
    timing?: {
      actual?: {
        steps?: RunStepTimingEntry[];
      };
    };
  };
}

interface ProviderResultPayload {
  provider?: string;
  model?: string;
  metadata?: {
    tokenCount?: number;
    processingTime?: number;
  };
  result?: {
    text?: string;
    segments?: Array<{
      start?: string;
      end?: string;
      speaker?: string;
      text?: string;
    }>;
    evidence?: {
      timingQuality?: string;
      capabilities?: {
        hasSpeakerLabels?: boolean;
      };
      rawResponse?: unknown;
    };
  };
}

const TRANSCRIPT_LINE_RE = /^\[(?<start>[^\]]+)\]\s+\[(?<speaker>[^\]]+)\]\s+(?<text>.+)$/;
const TOKEN_RE = /[a-z0-9]+(?:[‘’][a-z0-9]+)?/gi;
const PUNCT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\u2018/g, "’"],
  [/\u2019/g, "’"],
  [/\u201c/g, '"'],
  [/\u201d/g, '"'],
  [/\u2013/g, "-"],
  [/\u2014/g, "-"],
  [/\u2026/g, "..."],
];

const CONTRACTIONS = new Map<string, string>([
  ["i’m", "i am"],
  ["i’ve", "i have"],
  ["i’ll", "i will"],
  ["i’d", "i would"],
  ["you’re", "you are"],
  ["you’ve", "you have"],
  ["you’ll", "you will"],
  ["you’d", "you would"],
  ["he’s", "he is"],
  ["she’s", "she is"],
  ["it’s", "it is"],
  ["we’re", "we are"],
  ["we’ve", "we have"],
  ["we’ll", "we will"],
  ["we’d", "we would"],
  ["they’re", "they are"],
  ["they’ve", "they have"],
  ["they’ll", "they will"],
  ["they’d", "they would"],
  ["that’s", "that is"],
  ["who’s", "who is"],
  ["what’s", "what is"],
  ["there’s", "there is"],
  ["here’s", "here is"],
  ["where’s", "where is"],
  ["how’s", "how is"],
  ["can’t", "cannot"],
  ["won’t", "will not"],
  ["don’t", "do not"],
  ["doesn’t", "does not"],
  ["didn’t", "did not"],
  ["isn’t", "is not"],
  ["aren’t", "are not"],
  ["wasn’t", "was not"],
  ["weren’t", "were not"],
  ["haven’t", "have not"],
  ["hasn’t", "has not"],
  ["hadn’t", "had not"],
  ["couldn’t", "could not"],
  ["wouldn’t", "would not"],
  ["shouldn’t", "should not"],
  ["let’s", "let us"],
]);

const ABBREVIATIONS = new Map<string, string>([
  ["mr.", "mister"],
  ["mrs.", "missus"],
  ["ms.", "miss"],
  ["dr.", "doctor"],
  ["prof.", "professor"],
  ["vs.", "versus"],
  ["etc.", "etcetera"],
  ["st.", "saint"],
  ["jr.", "junior"],
  ["sr.", "senior"],
]);

const CURRENCY_PATTERNS: Array<[RegExp, string]> = [
  [/\$(\d[\d,.]*)/g, "$1 dollars"],
  [/(\d[\d,.]*)%/g, "$1 percent"],
  [/[£](\d[\d,.]*)/g, "$1 pounds"],
  [/[€](\d[\d,.]*)/g, "$1 euros"],
  [/#(\d+)/g, "number $1"],
];

const FILLER_WORDS = new Set(["um", "uh", "hmm", "mhm", "ah", "er"]);

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function parseClock(value: string): number {
  const parts = value.trim().split(":");
  if (parts.length !== 2 && parts.length !== 3) {
    throw new Error(`Unsupported timestamp or duration: ${value}`);
  }
  const seconds = Number(parts.at(-1));
  const minutes = Number(parts.at(-2));
  const hours = parts.length === 3 ? Number(parts[0]) : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const wholeSeconds = safe % 60;
  if (Math.abs(wholeSeconds - Math.round(wholeSeconds)) < 1e-9) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${Math.round(wholeSeconds).toString().padStart(2, "0")}`;
  }
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${wholeSeconds.toFixed(3).padStart(6, "0")}`;
}

export interface ProviderSegmentStats {
  segmentCount: number;
  timedSegmentCount: number;
  zeroDurationSegmentCount: number;
  negativeDurationSegmentCount: number;
  monotonicStarts: boolean;
  firstStartSeconds: number | null;
  lastEndSeconds: number | null;
  totalSegmentDurationSeconds: number;
  coverageSeconds: number | null;
  durationCoverageRatio: number | null;
  timingQuality: string | null;
  hasSpeakerLabels: boolean | null;
}

export function computeProviderSegmentStats(
  provider: ProviderRun,
  runDurationSeconds: number,
): ProviderSegmentStats {
  let timedSegmentCount = 0;
  let zeroDurationSegmentCount = 0;
  let negativeDurationSegmentCount = 0;
  let monotonicStarts = true;
  let firstStartSeconds: number | null = null;
  let lastEndSeconds: number | null = null;
  let previousStartSeconds: number | null = null;
  let totalSegmentDurationSeconds = 0;

  for (const segment of provider.segments) {
    timedSegmentCount += 1;
    if (previousStartSeconds !== null && segment.start < previousStartSeconds) {
      monotonicStarts = false;
    }
    previousStartSeconds = segment.start;
    firstStartSeconds = firstStartSeconds === null ? segment.start : Math.min(firstStartSeconds, segment.start);
    lastEndSeconds = lastEndSeconds === null ? segment.end : Math.max(lastEndSeconds, segment.end);
    const durationSeconds = segment.end - segment.start;
    if (durationSeconds < 0) {
      negativeDurationSegmentCount += 1;
    } else {
      if (durationSeconds === 0) {
        zeroDurationSegmentCount += 1;
      }
      totalSegmentDurationSeconds += durationSeconds;
    }
  }

  const coverageSeconds = firstStartSeconds !== null && lastEndSeconds !== null
    ? Math.max(0, lastEndSeconds - firstStartSeconds)
    : null;

  return {
    segmentCount: provider.segments.length,
    timedSegmentCount,
    zeroDurationSegmentCount,
    negativeDurationSegmentCount,
    monotonicStarts,
    firstStartSeconds,
    lastEndSeconds,
    totalSegmentDurationSeconds,
    coverageSeconds,
    durationCoverageRatio: coverageSeconds !== null && runDurationSeconds > 0 ? coverageSeconds / runDurationSeconds : null,
    timingQuality: provider.timingQuality,
    hasSpeakerLabels: provider.hasSpeakerLabels,
  };
}

export function normalizeText(text: string): string {
  let normalized = text.toLowerCase();
  for (const [pattern, replacement] of PUNCT_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  for (const [abbr, expansion] of ABBREVIATIONS) {
    normalized = normalized.replaceAll(abbr, expansion);
  }
  for (const [pattern, replacement] of CURRENCY_PATTERNS) {
    normalized = normalized.replace(pattern, replacement);
  }
  for (const [contraction, expansion] of CONTRACTIONS) {
    normalized = normalized.replaceAll(contraction, expansion);
  }
  normalized = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ");
  return normalized.trim().replace(/\s+/g, " ");
}

export function stripFillerTokens(tokens: string[]): string[] {
  return tokens.filter((token) => !FILLER_WORDS.has(token));
}

export function tokenize(text: string): string[] {
  return normalizeText(text).match(TOKEN_RE) ?? [];
}

export interface WerBreakdown {
  distance: number;
  substitutions: number;
  deletions: number;
  insertions: number;
}

export function levenshteinDistance(left: string[], right: string[]): number {
  if (left.length === 0) {
    return right.length;
  }
  if (right.length === 0) {
    return left.length;
  }
  if (left.length < right.length) {
    return levenshteinDistance(right, left);
  }
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const insertion = current[rightIndex] + 1;
      const deletion = previous[rightIndex + 1] + 1;
      const substitution = previous[rightIndex] + Number(left[leftIndex] !== right[rightIndex]);
      current.push(Math.min(insertion, deletion, substitution));
    }
    previous = current;
  }
  return previous.at(-1) ?? 0;
}

export function levenshteinBreakdown(reference: string[], candidate: string[]): WerBreakdown {
  const n = reference.length;
  const m = candidate.length;

  if (n === 0) {
    return { distance: m, substitutions: 0, deletions: 0, insertions: m };
  }
  if (m === 0) {
    return { distance: n, substitutions: 0, deletions: n, insertions: 0 };
  }
  if (n > 10_000 || m > 10_000) {
    const distance = levenshteinDistance(reference, candidate);
    return { distance, substitutions: -1, deletions: -1, insertions: -1 };
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const ops: Array<Array<"none" | "sub" | "del" | "ins" | "match">> = Array.from(
    { length: n + 1 },
    () => new Array<"none" | "sub" | "del" | "ins" | "match">(m + 1).fill("none"),
  );

  for (let i = 0; i <= n; i++) {
    dp[i][0] = i;
    if (i > 0) ops[i][0] = "del";
  }
  for (let j = 0; j <= m; j++) {
    dp[0][j] = j;
    if (j > 0) ops[0][j] = "ins";
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (reference[i - 1] === candidate[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
        ops[i][j] = "match";
      } else {
        const sub = dp[i - 1][j - 1];
        const del = dp[i - 1][j];
        const ins = dp[i][j - 1];
        const min = Math.min(sub, del, ins);
        dp[i][j] = min + 1;
        if (min === sub) ops[i][j] = "sub";
        else if (min === del) ops[i][j] = "del";
        else ops[i][j] = "ins";
      }
    }
  }

  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const op = ops[i][j];
    if (op === "match") {
      i--;
      j--;
    } else if (op === "sub") {
      substitutions++;
      i--;
      j--;
    } else if (op === "del") {
      deletions++;
      i--;
    } else {
      insertions++;
      j--;
    }
  }

  return { distance: dp[n][m], substitutions, deletions, insertions };
}

export function overlapSeconds(left: Segment, right: Segment): number {
  return Math.max(0, Math.min(left.end, right.end) - Math.max(left.start, right.start));
}

export function loadRunJson(runDir: string): RunJson {
  return readJson<RunJson>(join(runDir, "run.json"));
}

export function durationSecondsFromRun(runJson: RunJson, providers: ProviderRun[] = []): number {
  const numericDuration = runJson.metadata?.step1?.durationSeconds;
  if (typeof numericDuration === "number" && Number.isFinite(numericDuration) && numericDuration > 0) {
    return numericDuration;
  }

  const duration = runJson.metadata?.step1?.duration?.trim();
  if (duration && duration.toLowerCase() !== "unknown") {
    return parseClock(duration);
  }

  const fallbackDuration = Math.max(
    0,
    ...providers.flatMap((provider) =>
      provider.segments
        .map((segment) => segment.end)
        .filter((end) => Number.isFinite(end) && end > 0),
    ),
  );
  if (fallbackDuration > 0) {
    return fallbackDuration;
  }

  if (!duration) {
    throw new Error("run.json is missing metadata.step1.duration and provider segment ends are unavailable");
  }
  throw new Error(`run.json metadata.step1.duration is ${JSON.stringify(duration)} and provider segment ends are unavailable`);
}

function makeProviderLookupKey(provider: string, model: string): string {
  return `${provider}::${model}`;
}

function actualCostLookup(runJson: RunJson): Map<string, number> {
  const lookup = new Map<string, number>();
  const steps = runJson.metadata?.cost?.actual?.steps ?? [];
  for (const step of steps) {
    if (step.provider && step.model && step.cost !== undefined) {
      lookup.set(makeProviderLookupKey(step.provider, step.model), Number(step.cost));
    }
  }
  return lookup;
}

function actualTimingLookup(runJson: RunJson): Map<string, number> {
  const lookup = new Map<string, number>();
  const steps = runJson.metadata?.timing?.actual?.steps ?? [];
  for (const step of steps) {
    if (step.provider && step.model && step.processingTimeMs !== undefined) {
      lookup.set(makeProviderLookupKey(step.provider, step.model), Number(step.processingTimeMs));
    }
  }
  return lookup;
}

export function loadProviderRuns(runDir: string): { providers: ProviderRun[]; warnings: string[] } {
  const runJson = loadRunJson(runDir);
  const costLookup = actualCostLookup(runJson);
  const timingLookup = actualTimingLookup(runJson);
  const warnings: string[] = [];

  const providerStates = runJson.metadata?.providerStates ?? [];
  const expectedDirs = new Set(
    providerStates
      .map((state) => state.artifactDir)
      .filter((artifactDir): artifactDir is string => Boolean(artifactDir))
      .map((artifactDir) => basename(artifactDir)),
  );

  const providersDir = join(runDir, "providers");
  const resultPaths = readdirSync(providersDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(providersDir, entry.name, "result.json"))
    .filter((path) => existsSync(path))
    .sort((left, right) => left.localeCompare(right));
  const discoveredDirs = new Set(resultPaths.map((path) => basename(dirname(path))));

  const missingResultDirs = [...expectedDirs].filter((dir) => !discoveredDirs.has(dir)).sort();
  if (missingResultDirs.length > 0) {
    warnings.push(
      "run.json references provider artifact directories that are missing result.json files: " +
        missingResultDirs.join(", "),
    );
  }

  const extraResultDirs = [...discoveredDirs].filter((dir) => !expectedDirs.has(dir)).sort();
  if (extraResultDirs.length > 0) {
    warnings.push(
      "Found provider result.json files not listed in run.json providerStates: " +
        extraResultDirs.join(", "),
    );
  }

  const providers = resultPaths.map((resultPath) => {
    const payload = readJson<ProviderResultPayload>(resultPath);
    const provider = payload.provider;
    const model = payload.model;
    if (!provider || !model) {
      throw new Error(`${resultPath} is missing provider/model metadata`);
    }
    const evidence = payload.result?.evidence;
    const segments = (payload.result?.segments ?? [])
      .map((item) => {
        const rawStart = String(item.start ?? "0:00");
        const rawEnd = String(item.end ?? rawStart);
        const start = parseClock(rawStart);
        const parsedEnd = parseClock(rawEnd);
        return {
          start,
          end: parsedEnd < start ? start : parsedEnd,
          speaker: String(item.speaker ?? "speaker-unknown"),
          text: String(item.text ?? "").trim(),
          rawStart,
          rawEnd,
        } satisfies Segment;
      })
      .sort((left, right) => {
        if (left.start !== right.start) {
          return left.start - right.start;
        }
        if (left.end !== right.end) {
          return left.end - right.end;
        }
        if (left.speaker !== right.speaker) {
          return left.speaker.localeCompare(right.speaker);
        }
        return left.text.localeCompare(right.text);
      });
    const transcriptionPath = join(dirname(resultPath), "transcription.txt");
    const lookupKey = makeProviderLookupKey(provider, model);
    return {
      directoryName: basename(dirname(resultPath)),
      provider,
      model,
      providerKey: `${provider}/${model}`,
      resultPath,
      transcriptionPath: existsSync(transcriptionPath) ? transcriptionPath : null,
      segments,
      text: String(payload.result?.text ?? "").trim(),
      tokenCount: payload.metadata?.tokenCount ?? null,
      processingTimeMs:
        timingLookup.get(lookupKey) ??
        (payload.metadata?.processingTime !== undefined ? Number(payload.metadata.processingTime) : null),
      actualCostCents: costLookup.get(lookupKey) ?? null,
      timingQuality: typeof evidence?.timingQuality === "string" ? evidence.timingQuality : null,
      hasSpeakerLabels: typeof evidence?.capabilities?.hasSpeakerLabels === "boolean" ? evidence.capabilities.hasSpeakerLabels : null,
      rawResponse: evidence && "rawResponse" in evidence ? evidence.rawResponse : undefined,
    } satisfies ProviderRun;
  });

  return { providers, warnings };
}

export function parseReferenceTranscript(path: string, runDurationSeconds: number): Segment[] {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const parsed = lines.flatMap((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      return [];
    }
    const match = line.match(TRANSCRIPT_LINE_RE);
    if (!match?.groups) {
      throw new Error(`${path} line ${index + 1} does not match '[HH:MM:SS] [speaker-n] text': ${rawLine}`);
    }
    return [
      {
        start: parseClock(match.groups.start),
        speaker: match.groups.speaker.trim(),
        text: match.groups.text.trim(),
      },
    ];
  });
  if (parsed.length === 0) {
    throw new Error(`${path} does not contain any transcript lines`);
  }

  return parsed.map((segment, index) => {
    const nextStart = index + 1 < parsed.length ? parsed[index + 1].start : runDurationSeconds;
    const end = nextStart < segment.start ? segment.start : nextStart;
    return {
      start: segment.start,
      end,
      speaker: segment.speaker,
      text: segment.text,
      rawStart: formatClock(segment.start),
      rawEnd: formatClock(end),
    } satisfies Segment;
  });
}

export function mapProviderSpeakers(
  referenceSegments: Segment[],
  providerSegments: Segment[],
): Record<string, string> {
  const overlapMap = new Map<string, Map<string, number>>();
  for (const providerSegment of providerSegments) {
    const providerBucket = overlapMap.get(providerSegment.speaker) ?? new Map<string, number>();
    overlapMap.set(providerSegment.speaker, providerBucket);
    for (const referenceSegment of referenceSegments) {
      const seconds = overlapSeconds(providerSegment, referenceSegment);
      if (seconds <= 0) {
        continue;
      }
      providerBucket.set(
        referenceSegment.speaker,
        (providerBucket.get(referenceSegment.speaker) ?? 0) + seconds,
      );
    }
  }

  const mapping: Record<string, string> = {};
  for (const [providerSpeaker, speakerTotals] of overlapMap.entries()) {
    const best = [...speakerTotals.entries()].sort((left, right) => {
      if (left[1] !== right[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })[0];
    if (best) {
      mapping[providerSpeaker] = best[0];
    }
  }
  return mapping;
}

export function overlappingProviderSegments(
  referenceSegment: Segment,
  providerSegments: Segment[],
): Array<[Segment, number]> {
  const overlaps: Array<[Segment, number]> = [];
  for (const providerSegment of providerSegments) {
    const seconds = overlapSeconds(referenceSegment, providerSegment);
    if (seconds > 0) {
      overlaps.push([providerSegment, seconds]);
    }
  }
  return overlaps;
}

export function mergeOverlapText(overlaps: Array<[Segment, number]>): string {
  return overlaps
    .map(([segment]) => segment.text.trim())
    .filter((text) => text.length > 0)
    .join(" ");
}

export function dominantOverlapSpeaker(
  overlaps: Array<[Segment, number]>,
  speakerMap?: Record<string, string>,
): string {
  const totals = new Map<string, number>();
  for (const [segment, seconds] of overlaps) {
    const speaker = speakerMap?.[segment.speaker] ?? segment.speaker;
    totals.set(speaker, (totals.get(speaker) ?? 0) + seconds);
  }
  const best = [...totals.entries()].sort((left, right) => {
    if (left[1] !== right[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  })[0];
  return best?.[0] ?? "speaker-missing";
}

export function alignProviderToReference(
  referenceSegments: Segment[],
  providerSegments: Segment[],
  speakerMap?: Record<string, string>,
): Segment[] {
  return referenceSegments.map((referenceSegment) => {
    const overlaps = overlappingProviderSegments(referenceSegment, providerSegments);
    return {
      start: referenceSegment.start,
      end: referenceSegment.end,
      speaker: dominantOverlapSpeaker(overlaps, speakerMap),
      text: mergeOverlapText(overlaps),
      rawStart: referenceSegment.rawStart,
      rawEnd: referenceSegment.rawEnd,
    } satisfies Segment;
  });
}

export function segmentWer(
  referenceSegments: Segment[],
  candidateSegments: Segment[],
  includeSpeakers: boolean,
): number {
  if (referenceSegments.length !== candidateSegments.length) {
    throw new Error("Reference and candidate segment lists must have the same length");
  }
  let totalDistance = 0;
  let totalReferenceTokens = 0;
  for (let index = 0; index < referenceSegments.length; index += 1) {
    const referenceSegment = referenceSegments[index];
    const candidateSegment = candidateSegments[index];
    const referenceTokens = tokenize(referenceSegment.text);
    const candidateTokens = tokenize(candidateSegment.text);
    if (includeSpeakers) {
      referenceTokens.unshift(`<speaker:${referenceSegment.speaker}>`);
      candidateTokens.unshift(`<speaker:${candidateSegment.speaker}>`);
    }
    totalDistance += levenshteinDistance(referenceTokens, candidateTokens);
    totalReferenceTokens += referenceTokens.length;
  }
  return totalReferenceTokens === 0 ? 0 : totalDistance / totalReferenceTokens;
}

export function tokensFromSegments(
  segments: Segment[],
  includeSpeakers: boolean,
  speakerMap?: Record<string, string>,
): string[] {
  const tokens: string[] = [];
  let previousSpeaker: string | null = null;

  for (const segment of segments) {
    const textTokens = tokenize(segment.text);
    if (textTokens.length === 0) {
      continue;
    }

    if (includeSpeakers) {
      const speaker = speakerMap?.[segment.speaker] ?? segment.speaker;
      if (speaker !== previousSpeaker) {
        tokens.push(`<speaker:${speaker}>`);
        previousSpeaker = speaker;
      }
    }

    tokens.push(...textTokens);
  }

  return tokens;
}

export function wordWer(
  referenceSegments: Segment[],
  candidateSegments: Segment[],
  includeSpeakers: boolean,
  speakerMap?: Record<string, string>,
): number {
  const referenceTokens = tokensFromSegments(referenceSegments, includeSpeakers);
  const candidateTokens = tokensFromSegments(candidateSegments, includeSpeakers, speakerMap);
  if (referenceTokens.length === 0) {
    return 0;
  }
  return levenshteinDistance(referenceTokens, candidateTokens) / referenceTokens.length;
}

export interface WerDetailedResult {
  wer: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceWordCount: number;
}

export function wordWerDetailed(
  referenceSegments: Segment[],
  candidateSegments: Segment[],
  includeSpeakers: boolean,
  speakerMap?: Record<string, string>,
  options?: { stripFillers?: boolean },
): WerDetailedResult {
  let referenceTokens = tokensFromSegments(referenceSegments, includeSpeakers);
  let candidateTokens = tokensFromSegments(candidateSegments, includeSpeakers, speakerMap);
  if (options?.stripFillers) {
    referenceTokens = stripFillerTokens(referenceTokens);
    candidateTokens = stripFillerTokens(candidateTokens);
  }
  const referenceWordCount = referenceTokens.length;
  if (referenceWordCount === 0) {
    return { wer: 0, substitutions: 0, deletions: 0, insertions: 0, referenceWordCount: 0 };
  }
  const breakdown = levenshteinBreakdown(referenceTokens, candidateTokens);
  return {
    wer: breakdown.distance / referenceWordCount,
    substitutions: breakdown.substitutions,
    deletions: breakdown.deletions,
    insertions: breakdown.insertions,
    referenceWordCount,
  };
}

export function segmentAlignedSimilarity(
  referenceSegments: Segment[],
  candidateSegments: Segment[],
): number {
  const alignedCandidate = alignProviderToReference(referenceSegments, candidateSegments);
  return Math.max(0, 1 - segmentWer(referenceSegments, alignedCandidate, false));
}

export function meanPairwiseSimilarity(providers: ProviderRun[]): Record<string, number> {
  if (providers.length === 1) {
    return { [providers[0].directoryName]: 1 };
  }
  const scores = new Map<string, number[]>(
    providers.map((provider) => [provider.directoryName, []]),
  );
  for (let leftIndex = 0; leftIndex < providers.length; leftIndex += 1) {
    const left = providers[leftIndex];
    for (const right of providers.slice(leftIndex + 1)) {
      const forward = segmentAlignedSimilarity(left.segments, right.segments);
      const reverse = segmentAlignedSimilarity(right.segments, left.segments);
      const similarity = (forward + reverse) / 2;
      scores.get(left.directoryName)?.push(similarity);
      scores.get(right.directoryName)?.push(similarity);
    }
  }
  return Object.fromEntries(
    [...scores.entries()].map(([providerName, values]) => [
      providerName,
      values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 1,
    ]),
  );
}

export function chooseBaselineProvider(
  providers: ProviderRun[],
): { baseline: ProviderRun; agreement: Record<string, number> } {
  const agreement = meanPairwiseSimilarity(providers);
  const ranked = [...providers].sort((left, right) => {
    const leftScore = agreement[left.directoryName] ?? 0;
    const rightScore = agreement[right.directoryName] ?? 0;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    const leftSpeakerCount = new Set(left.segments.map((segment) => segment.speaker)).size;
    const rightSpeakerCount = new Set(right.segments.map((segment) => segment.speaker)).size;
    if (leftSpeakerCount !== rightSpeakerCount) {
      return rightSpeakerCount - leftSpeakerCount;
    }
    const leftTextTokens = tokenize(left.text).length;
    const rightTextTokens = tokenize(right.text).length;
    if (leftTextTokens !== rightTextTokens) {
      return rightTextTokens - leftTextTokens;
    }
    const leftProcessing = left.processingTimeMs ?? Number.POSITIVE_INFINITY;
    const rightProcessing = right.processingTimeMs ?? Number.POSITIVE_INFINITY;
    if (leftProcessing !== rightProcessing) {
      return leftProcessing - rightProcessing;
    }
    return left.directoryName.localeCompare(right.directoryName);
  });
  const baseline = ranked[0];
  if (!baseline) {
    throw new Error("Cannot choose a baseline provider from an empty provider list");
  }
  return { baseline, agreement };
}

export function formatCents(cents: number | null): string {
  if (cents === null) {
    return "n/a";
  }
  return `${cents.toFixed(4)}¢ ($${(cents / 100).toFixed(4)})`;
}

export function formatProcessingSeconds(milliseconds: number | null): string {
  if (milliseconds === null) {
    return "n/a";
  }
  return `${(milliseconds / 1000).toFixed(2)}s`;
}
