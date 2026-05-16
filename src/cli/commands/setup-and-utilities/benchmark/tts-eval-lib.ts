import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AudioProperties {
  durationSeconds: number;
  sampleRate: number | null;
  channels: number | null;
  bitrate: number | null;
  codec: string | null;
}

export interface TtsEntryMetadata {
  ttsService: string;
  ttsModel: string;
  speaker?: string;
  language?: string;
  processingTime: number;
  audioFileName: string;
  audioFileSize: number;
  chunkCount: number;
}

interface RunStepCostEntry {
  step?: string;
  provider?: string;
  model?: string;
  cost?: number;
  inputMetric?: string;
  inputValue?: number;
}

interface RunStepTimingEntry {
  step?: string;
  provider?: string;
  model?: string;
  processingTimeMs?: number;
  inputMetric?: string;
  inputValue?: number;
}

export interface TtsRunJson {
  schemaVersion?: number;
  kind: string;
  metadata: {
    tts: TtsEntryMetadata[];
    input?: string;
    cost?: {
      estimated?: { totalCost?: number; steps?: RunStepCostEntry[] };
      actual?: { totalCost?: number; steps?: RunStepCostEntry[] };
    };
    timing?: {
      estimated?: { totalProcessingTimeMs?: number; steps?: RunStepTimingEntry[] };
      actual?: { totalProcessingTimeMs?: number; steps?: RunStepTimingEntry[] };
    };
  };
}

export interface ProviderEvidence {
  providerKey: string;
  ttsService: string;
  ttsModel: string;
  speaker: string | null;
  audioFileName: string;
  audioFileSize: number;
  audioPath: string;
  audioExists: boolean;
  audioProperties: AudioProperties | null;
  chunkCount: number;
  processingTimeMs: number;
  costCents: number | null;
  speakingRateCharsPerSec: number | null;
  charCount: number;
  wordCount: number;
}

// ---------------------------------------------------------------------------
// Run JSON helpers
// ---------------------------------------------------------------------------

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function loadTtsRunJson(runDir: string): TtsRunJson {
  const runJson = readJson<TtsRunJson>(join(runDir, "run.json"));
  if (runJson.kind !== "tts") {
    throw new Error(`run.json kind is "${runJson.kind}", expected "tts"`);
  }
  if (!Array.isArray(runJson.metadata?.tts) || runJson.metadata.tts.length === 0) {
    throw new Error("run.json metadata.tts is missing or empty");
  }
  return runJson;
}

export function makeProviderKey(service: string, model: string): string {
  return `${service}/${model}`;
}

// ---------------------------------------------------------------------------
// Audio file discovery
// ---------------------------------------------------------------------------

export function discoverAudioFiles(
  runDir: string,
  ttsEntries: TtsEntryMetadata[],
): { found: Map<string, string>; missing: string[] } {
  const found = new Map<string, string>();
  const missing: string[] = [];
  for (const entry of ttsEntries) {
    const audioPath = join(runDir, entry.audioFileName);
    if (existsSync(audioPath)) {
      found.set(makeProviderKey(entry.ttsService, entry.ttsModel), audioPath);
    } else {
      missing.push(entry.audioFileName);
    }
  }
  return { found, missing };
}

// ---------------------------------------------------------------------------
// ffprobe
// ---------------------------------------------------------------------------

export async function probeAudio(audioPath: string): Promise<AudioProperties> {
  const proc = Bun.spawn(
    [
      "ffprobe",
      "-v", "error",
      "-show_entries", "format=duration,bit_rate:stream=sample_rate,channels,codec_name",
      "-of", "json",
      audioPath,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`ffprobe failed for ${audioPath}: ${stderr.trim()}`);
  }
  const data = JSON.parse(output) as {
    format?: { duration?: string; bit_rate?: string };
    streams?: Array<{ sample_rate?: string; channels?: number; codec_name?: string }>;
  };
  const stream = data.streams?.[0];
  return {
    durationSeconds: data.format?.duration ? Number(data.format.duration) : 0,
    sampleRate: stream?.sample_rate ? Number(stream.sample_rate) : null,
    channels: stream?.channels ?? null,
    bitrate: data.format?.bit_rate ? Number(data.format.bit_rate) : null,
    codec: stream?.codec_name ?? null,
  };
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export function computeSpeakingRate(charCount: number, durationSeconds: number): number | null {
  if (durationSeconds <= 0) {
    return null;
  }
  return charCount / durationSeconds;
}

// ---------------------------------------------------------------------------
// Cost and timing lookups
// ---------------------------------------------------------------------------

export function buildCostLookup(runJson: TtsRunJson): Map<string, number> {
  const lookup = new Map<string, number>();
  const steps = runJson.metadata.cost?.actual?.steps ?? runJson.metadata.cost?.estimated?.steps ?? [];
  for (const step of steps) {
    if (step.provider && step.model && step.cost !== undefined) {
      lookup.set(makeProviderKey(step.provider, step.model), Number(step.cost));
    }
  }
  return lookup;
}

export function buildTimingLookup(runJson: TtsRunJson): Map<string, number> {
  const lookup = new Map<string, number>();
  const steps = runJson.metadata.timing?.actual?.steps ?? runJson.metadata.timing?.estimated?.steps ?? [];
  for (const step of steps) {
    if (step.provider && step.model && step.processingTimeMs !== undefined) {
      lookup.set(makeProviderKey(step.provider, step.model), Number(step.processingTimeMs));
    }
  }
  return lookup;
}

// ---------------------------------------------------------------------------
// Text utilities (self-contained copies from stt-consensus)
// ---------------------------------------------------------------------------

const TOKEN_RE = /[a-z0-9]+(?:[''][a-z0-9]+)?/gi;
const PUNCT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\u2018/g, "'"],
  [/\u2019/g, "'"],
  [/\u201c/g, '"'],
  [/\u201d/g, '"'],
  [/\u2013/g, "-"],
  [/\u2014/g, "-"],
  [/\u2026/g, "..."],
];

export function normalizeText(text: string): string {
  let normalized = text.toLowerCase();
  for (const [pattern, replacement] of PUNCT_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.trim().replace(/\s+/g, " ");
}

export function tokenize(text: string): string[] {
  return normalizeText(text).match(TOKEN_RE) ?? [];
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
      const insertion = (current[rightIndex] ?? 0) + 1;
      const deletion = (previous[rightIndex + 1] ?? 0) + 1;
      const substitution = (previous[rightIndex] ?? 0) + Number((left[leftIndex] ?? "") !== (right[rightIndex] ?? ""));
      current.push(Math.min(insertion, deletion, substitution));
    }
    previous = current;
  }
  return previous.at(-1) ?? 0;
}

export function roundtripWer(originalText: string, transcribedText: string): number {
  const originalTokens = tokenize(originalText);
  const transcribedTokens = tokenize(transcribedText);
  if (originalTokens.length === 0) {
    return 0;
  }
  return levenshteinDistance(originalTokens, transcribedTokens) / originalTokens.length;
}

// ---------------------------------------------------------------------------
// Provider classification
// ---------------------------------------------------------------------------

const LOCAL_SERVICES = new Set(["kitten"]);

export function isLocalService(ttsService: string): boolean {
  return LOCAL_SERVICES.has(ttsService);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatCents(cents: number | null): string {
  if (cents === null) {
    return "n/a";
  }
  return `${cents.toFixed(4)}\u00A2 ($${(cents / 100).toFixed(4)})`;
}

export function formatProcessingSeconds(milliseconds: number | null): string {
  if (milliseconds === null) {
    return "n/a";
  }
  return `${(milliseconds / 1000).toFixed(2)}s`;
}
