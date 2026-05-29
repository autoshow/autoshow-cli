import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";

import {
  aggregateWeightedScore,
  clampPercentScore,
  mosToPercentScore,
  rankVoiceQualityProviders,
  type VoiceQualityScoreInput,
} from "~/utils/voice-quality-scoring";
import {
  computeSpeakingRate,
  discoverAudioFiles,
  isLocalService,
  loadTtsRunJson,
  makeProviderKey,
  probeAudio,
  roundtripWer,
  tokenize,
  type AudioProperties,
} from "./tts-eval-lib";

export type VoiceQualityReportMode = "local" | "full";
type ProviderGroup = "local" | "cloud";
type ComponentStatus = "scored" | "missing" | "warning";

export type ContentType = "narration" | "news" | "conversational" | "technical" | "default";

export interface VoiceQualityReportOptions {
  runDir: string;
  inputTextPath?: string;
  inputText?: string;
  inputTextLabel?: string;
  mode: VoiceQualityReportMode;
  allowPaid: boolean;
  metricFixturesPath: string | null;
  roundtripDir: string | null;
  markdownOut: string | null;
  jsonOut: string | null;
  keepTemp: boolean;
  audioJudgeModel: string;
  contentType?: ContentType;
}

interface ComponentScore {
  score: number | null;
  weight: number;
  status: ComponentStatus;
  source: string;
  note: string;
  mos?: number;
  details?: Record<string, unknown>;
}

interface ScoreCoverage {
  availableWeight: number;
  totalWeight: number;
}

interface SignalMetrics {
  durationSeconds: number;
  peakDbfs: number;
  rmsDbfs: number;
  clippingRatio: number;
  silenceRatio: number;
  loudnessRangeDb: number;
  abruptDiscontinuitiesPerSecond: number;
  dcOffset: number;
  initialSilenceSeconds: number;
  finalSilenceSeconds: number;
  pauseCount: number;
  medianPauseSeconds: number | null;
  maxPauseSeconds: number | null;
}

interface HeuristicResult {
  prosodyHeuristicScore: number;
  signalHygieneScore: number;
  signalMetrics: SignalMetrics;
  prosodyMetrics: Record<string, number | null>;
  warnings: string[];
}

interface MetricFixtureProvider {
  utmosv2Mos?: number;
  nisqaNaturalnessMos?: number;
  nisqaTtsNaturalnessMos?: number;
  nisqaQualityMos?: number;
  dnsmosMos?: number;
  dnsmosOverallMos?: number;
  paidAudioJudgeScore?: number;
  paidAudioJudge?: {
    score?: number;
    naturalnessScore?: number;
    speechQualityScore?: number;
    confidence?: number;
    notes?: string;
  };
  nisqa?: {
    naturalnessMos?: number;
    qualityMos?: number;
    noisinessMos?: number;
    colorationMos?: number;
    discontinuityMos?: number;
    loudnessMos?: number;
  };
  dnsmos?: {
    overallMos?: number;
    signalMos?: number;
    backgroundMos?: number;
    p808Mos?: number;
  };
  stt?: Record<string, string | { text?: string; transcript?: string }>;
  roundtripTranscripts?: Record<string, string | { text?: string; transcript?: string }>;
}

interface MetricFixtures {
  providers?: Record<string, MetricFixtureProvider>;
}

interface RoundtripEngineResult {
  engine: string;
  transcript: string;
  wer: number;
}

interface PaidFailurePolicy {
  strict: boolean;
  providerKey: string;
  warnings: string[];
}

interface ProviderVoiceQualityEntry {
  rank: number;
  providerKey: string;
  ttsService: string;
  ttsModel: string;
  speaker: string | null;
  group: ProviderGroup;
  audioFileName: string;
  audioFileSize: number;
  audioExists: boolean;
  originalAudioProperties: AudioProperties | null;
  naturalnessScore: number | null;
  speechQualityScore: number | null;
  humanSpeechScore: number | null;
  scoreCoverage: {
    naturalness: ScoreCoverage;
    speechQuality: ScoreCoverage;
    humanSpeech: ScoreCoverage;
  };
  componentScores: {
    naturalness: Record<string, ComponentScore>;
    speechQuality: Record<string, ComponentScore>;
  };
  metricDetails: {
    signalMetrics: SignalMetrics | null;
    prosodyMetrics: Record<string, number | null> | null;
    roundtripStt: {
      medianWer: number | null;
      engines: RoundtripEngineResult[];
    };
  };
  missingMetrics: string[];
  warnings: string[];
}

const NATURALNESS_WEIGHTS = {
  utmosv2Mos: 0.45,
  nisqaTtsNaturalnessMos: 0.25,
  paidAudioJudgeRubric: 0.20,
  prosodyHeuristics: 0.10,
} as const;

const SPEECH_QUALITY_WEIGHTS = {
  nisqaQualityMos: 0.35,
  dnsmos: 0.25,
  roundtripSttIntelligibility: 0.25,
  signalHygiene: 0.15,
} as const;

const HUMAN_SPEECH_WEIGHTS = {
  naturalness: 0.55,
  speechQuality: 0.45,
} as const;

const PAID_STT_ENGINES = [
  { key: "assemblyai/universal-3-pro", service: "assemblyai", model: "universal-3-pro" },
  { key: "openai-stt/gpt-4o-transcribe", service: "openai-stt", model: "gpt-4o-transcribe" },
] as const;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function strictPaidFailures(mode: VoiceQualityReportMode, allowPaid: boolean): boolean {
  return mode === "full" && allowPaid;
}

function recordPaidFailure(
  policy: PaidFailurePolicy,
  subsystem: string,
  error: unknown,
): void {
  const message = errorMessage(error);
  if (policy.strict) {
    throw new Error(`${policy.providerKey}: ${subsystem} failed: ${message}`);
  }
  policy.warnings.push(`${subsystem} failed: ${message}`);
}

function paidSttSubsystemLabel(service: string): string {
  if (service === "assemblyai") return "AssemblyAI roundtrip STT";
  if (service === "openai-stt") return "OpenAI roundtrip STT";
  return `${service} roundtrip STT`;
}

function helpText(): string {
  return [
    "Usage: bun build_voice_quality_report.ts <run_dir> --input-text <path> [--mode local|full] [--allow-paid] [--metric-fixtures <path>] [--roundtrip-dir <path>] [--markdown-out <path>] [--json-out <path>] [--keep-temp]",
    "",
    "Generate a TTS human-speech naturalness and perceived-quality report.",
    "",
    "Options:",
    "  --input-text <path>        Path to the original input text file",
    "  --mode <local|full>        local avoids paid API calls; full enables paid STT and audio judging (default: local)",
    "  --allow-paid              Required with --mode full before any paid API call can run",
    "  --metric-fixtures <path>  JSON metrics/transcripts to use instead of unavailable model/API calls",
    "  --roundtrip-dir <path>    Existing roundtrip transcripts ({audioFileName}.txt or engine subdirs)",
    "  --markdown-out <path>     Write markdown report to <path> (default: <run_dir>/voice-quality-report.md)",
    "  --json-out <path>         Write JSON report to <path> (default: <run_dir>/voice-quality-report.json)",
    "  --audio-judge-model <id>  OpenAI audio-capable chat model for paid rubric judging (default: gpt-audio)",
    "  --keep-temp               Keep normalized 16 kHz mono WAV files for inspection",
    "  --help, -h                Show this help message",
  ].join("\n");
}

function parseVoiceQualityReportArgs(argv: string[]): VoiceQualityReportOptions {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    process.exit(0);
  }

  const positional: string[] = [];
  let inputTextPath: string | null = null;
  let mode: VoiceQualityReportMode = "local";
  let allowPaid = false;
  let metricFixturesPath: string | null = null;
  let roundtripDir: string | null = null;
  let markdownOut: string | null = null;
  let jsonOut: string | null = null;
  let keepTemp = false;
  let audioJudgeModel = "gpt-audio";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string;
    if (arg === "--input-text") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --input-text");
      inputTextPath = value;
      index += 1;
      continue;
    }
    if (arg === "--mode") {
      const value = argv[index + 1];
      if (value !== "local" && value !== "full") {
        throw new Error("--mode must be local or full");
      }
      mode = value;
      index += 1;
      continue;
    }
    if (arg === "--allow-paid") {
      allowPaid = true;
      continue;
    }
    if (arg === "--metric-fixtures") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --metric-fixtures");
      metricFixturesPath = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--roundtrip-dir") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --roundtrip-dir");
      roundtripDir = resolve(value);
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
    if (arg === "--audio-judge-model") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --audio-judge-model");
      audioJudgeModel = value;
      index += 1;
      continue;
    }
    if (arg === "--keep-temp") {
      keepTemp = true;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    positional.push(arg);
  }

  const runDir = positional[0];
  if (!runDir) {
    throw new Error("Usage: bun build_voice_quality_report.ts <run_dir> --input-text <path> [--mode local|full]");
  }
  if (!inputTextPath) {
    throw new Error("--input-text is required");
  }
  if (mode === "full" && !allowPaid) {
    throw new Error("--mode full requires --allow-paid");
  }

  return {
    runDir: resolve(runDir),
    inputTextPath: resolve(inputTextPath),
    mode,
    allowPaid,
    metricFixturesPath,
    roundtripDir,
    markdownOut,
    jsonOut,
    keepTemp,
    audioJudgeModel,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function fixtureForProvider(
  fixtures: MetricFixtures | null,
  providerKey: string,
  audioFileName: string,
): MetricFixtureProvider | null {
  const providers = fixtures?.providers;
  if (!providers) return null;
  return providers[providerKey] ?? providers[audioFileName] ?? null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const middleValue = sorted[middle];
  if (middleValue === undefined) return null;
  if (sorted.length % 2 === 1) return middleValue;
  const previousValue = sorted[middle - 1];
  return previousValue === undefined ? middleValue : (previousValue + middleValue) / 2;
}

function percentile(values: number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((percentileValue / 100) * (sorted.length - 1))));
  return sorted[index] ?? null;
}

function amplitudeToDbfs(amplitude: number): number {
  return 20 * Math.log10(Math.max(amplitude, 1e-9));
}

async function runProcess(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

async function normalizeAudio(inputPath: string, outputPath: string): Promise<void> {
  const result = await runProcess([
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    outputPath,
  ]);
  if (result.exitCode !== 0) {
    throw new Error(`ffmpeg normalization failed: ${result.stderr.trim() || result.stdout.trim()}`);
  }
}

interface Pcm16Wav {
  sampleRate: number;
  samples: Float64Array;
}

function readChunkId(buffer: Buffer, offset: number): string {
  return buffer.toString("ascii", offset, offset + 4);
}

function readPcm16MonoWav(path: string): Pcm16Wav {
  const buffer = readFileSync(path);
  if (readChunkId(buffer, 0) !== "RIFF" || readChunkId(buffer, 8) !== "WAVE") {
    throw new Error(`Unsupported WAV container for ${path}`);
  }

  let offset = 12;
  let audioFormat: number | null = null;
  let channels: number | null = null;
  let sampleRate: number | null = null;
  let bitsPerSample: number | null = null;
  let dataOffset: number | null = null;
  let dataSize: number | null = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = readChunkId(buffer, offset);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;
    if (chunkId === "fmt ") {
      audioFormat = buffer.readUInt16LE(chunkDataOffset);
      channels = buffer.readUInt16LE(chunkDataOffset + 2);
      sampleRate = buffer.readUInt32LE(chunkDataOffset + 4);
      bitsPerSample = buffer.readUInt16LE(chunkDataOffset + 14);
    } else if (chunkId === "data") {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
      break;
    }
    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (audioFormat !== 1 || channels !== 1 || bitsPerSample !== 16 || sampleRate === null || dataOffset === null || dataSize === null) {
    throw new Error(`Expected normalized 16-bit PCM mono WAV for ${path}`);
  }

  const sampleCount = Math.floor(dataSize / 2);
  const samples = new Float64Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = buffer.readInt16LE(dataOffset + index * 2) / 32768;
  }

  return { sampleRate, samples };
}

function scoreNearRange(value: number, idealMin: number, idealMax: number, hardMin: number, hardMax: number): number {
  if (value >= idealMin && value <= idealMax) return 100;
  if (value < hardMin || value > hardMax) return 0;
  if (value < idealMin) {
    return clampPercentScore(((value - hardMin) / (idealMin - hardMin)) * 100);
  }
  return clampPercentScore(((hardMax - value) / (hardMax - idealMax)) * 100);
}

function scoreCentered(value: number, ideal: number, goodDeviation: number, hardDeviation: number): number {
  const deviation = Math.abs(value - ideal);
  if (deviation <= goodDeviation) return 100;
  if (deviation >= hardDeviation) return 0;
  return clampPercentScore(100 * (1 - (deviation - goodDeviation) / (hardDeviation - goodDeviation)));
}

function computePauseRuns(samples: Float64Array, sampleRate: number, threshold: number): number[] {
  const pauses: number[] = [];
  let run = 0;
  const minPauseSamples = Math.floor(sampleRate * 0.15);
  for (const sample of samples) {
    if (Math.abs(sample) <= threshold) {
      run += 1;
    } else {
      if (run >= minPauseSamples) pauses.push(run / sampleRate);
      run = 0;
    }
  }
  if (run >= minPauseSamples) pauses.push(run / sampleRate);
  return pauses;
}

function edgeSilenceSeconds(samples: Float64Array, sampleRate: number, threshold: number, fromEnd: boolean): number {
  let count = 0;
  if (fromEnd) {
    for (let index = samples.length - 1; index >= 0; index -= 1) {
      if (Math.abs(samples[index] ?? 0) > threshold) break;
      count += 1;
    }
  } else {
    for (const sample of samples) {
      if (Math.abs(sample) > threshold) break;
      count += 1;
    }
  }
  return count / sampleRate;
}

interface SpeakingRateParams {
  ideal: number;
  goodDeviation: number;
  hardDeviation: number;
}

const SPEAKING_RATE_BY_CONTENT_TYPE: Record<ContentType, SpeakingRateParams> = {
  narration: { ideal: 150, goodDeviation: 20, hardDeviation: 70 },
  news: { ideal: 162, goodDeviation: 25, hardDeviation: 75 },
  conversational: { ideal: 150, goodDeviation: 40, hardDeviation: 100 },
  technical: { ideal: 140, goodDeviation: 20, hardDeviation: 65 },
  default: { ideal: 155, goodDeviation: 30, hardDeviation: 95 },
};

function computeAdaptiveSilenceThreshold(samples: Float64Array): number {
  const absoluteValues = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    absoluteValues[i] = Math.abs(samples[i] ?? 0);
  }
  absoluteValues.sort();
  const p5Index = Math.floor(samples.length * 0.05);
  const noiseFloor = absoluteValues[p5Index] ?? 0;
  const computed = noiseFloor * 3;
  const minThreshold = 10 ** (-60 / 20);
  const maxThreshold = 10 ** (-25 / 20);
  if (computed < minThreshold || computed > maxThreshold) {
    return 10 ** (-45 / 20);
  }
  return computed;
}

function computeHeuristics(
  wav: Pcm16Wav,
  inputText: string,
  inputWordCount: number,
  inputCharCount: number,
  contentType: ContentType = "default",
): HeuristicResult {
  const { samples, sampleRate } = wav;
  const warnings: string[] = [];
  const durationSeconds = samples.length / sampleRate;
  if (durationSeconds <= 0) {
    throw new Error("Normalized audio has zero duration");
  }

  let peak = 0;
  let sumSquares = 0;
  let sum = 0;
  let clipping = 0;
  let silenceSamples = 0;
  let abruptDiscontinuities = 0;
  const silenceThreshold = computeAdaptiveSilenceThreshold(samples);
  let previous = samples[0] ?? 0;

  for (const sample of samples) {
    const abs = Math.abs(sample);
    peak = Math.max(peak, abs);
    sumSquares += sample * sample;
    sum += sample;
    if (abs >= 0.999) clipping += 1;
    if (abs <= silenceThreshold) silenceSamples += 1;
    if (Math.abs(sample - previous) > 0.65) abruptDiscontinuities += 1;
    previous = sample;
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  const dcOffset = sum / samples.length;
  const windowSize = Math.max(1, Math.floor(sampleRate * 0.25));
  const windowDbValues: number[] = [];
  for (let start = 0; start < samples.length; start += windowSize) {
    let windowSumSquares = 0;
    let count = 0;
    const end = Math.min(samples.length, start + windowSize);
    for (let index = start; index < end; index += 1) {
      const sample = samples[index] ?? 0;
      windowSumSquares += sample * sample;
      count += 1;
    }
    const windowRms = Math.sqrt(windowSumSquares / Math.max(1, count));
    const db = amplitudeToDbfs(windowRms);
    if (db > -70) windowDbValues.push(db);
  }

  const p95 = percentile(windowDbValues, 95);
  const p10 = percentile(windowDbValues, 10);
  const loudnessRangeDb = p95 !== null && p10 !== null ? Math.max(0, p95 - p10) : 0;
  const pauses = computePauseRuns(samples, sampleRate, silenceThreshold);
  const speechWpm = inputWordCount > 0 ? (inputWordCount / durationSeconds) * 60 : 0;
  const charsPerSecond = computeSpeakingRate(inputCharCount, durationSeconds) ?? 0;
  const punctuationBreaks = Math.max(1, (inputText.match(/[.,;:!?]/g) ?? []).length);
  const expectedPauseCount = Math.max(1, Math.min(punctuationBreaks, Math.round(inputWordCount / 12)));
  const pauseCountRatio = pauses.length / expectedPauseCount;

  const clippingRatio = clipping / samples.length;
  const silenceRatio = silenceSamples / samples.length;
  const abruptDiscontinuitiesPerSecond = abruptDiscontinuities / durationSeconds;
  const peakDbfs = amplitudeToDbfs(peak);
  const rmsDbfs = amplitudeToDbfs(rms);
  const initialSilenceSeconds = edgeSilenceSeconds(samples, sampleRate, silenceThreshold, false);
  const finalSilenceSeconds = edgeSilenceSeconds(samples, sampleRate, silenceThreshold, true);
  const medianPauseSeconds = median(pauses);
  const maxPauseSeconds = pauses.length > 0 ? Math.max(...pauses) : null;

  if (clippingRatio > 0.001) warnings.push(`Clipping ratio is ${(clippingRatio * 100).toFixed(2)}%`);
  if (rmsDbfs < -34) warnings.push(`RMS loudness is very low at ${rmsDbfs.toFixed(1)} dBFS`);
  if (rmsDbfs > -10) warnings.push(`RMS loudness is very high at ${rmsDbfs.toFixed(1)} dBFS`);
  if (silenceRatio > 0.55) warnings.push(`Silence ratio is high at ${(silenceRatio * 100).toFixed(1)}%`);
  if (abruptDiscontinuitiesPerSecond > 0.5) warnings.push("Abrupt waveform discontinuities detected");

  const clippingScore = clampPercentScore(100 - clippingRatio * 20000 - (peakDbfs > -0.1 ? 10 : 0));
  const rmsScore = scoreNearRange(rmsDbfs, -28, -14, -42, -6);
  const silenceScore = scoreNearRange(silenceRatio, 0.04, 0.35, 0, 0.65);
  const loudnessRangeScore = scoreNearRange(loudnessRangeDb, 4, 24, 0, 38);
  const discontinuityScore = clampPercentScore(100 - abruptDiscontinuitiesPerSecond * 60);
  const dcScore = clampPercentScore(100 - Math.abs(dcOffset) * 2000);

  const signalHygieneScore =
    clippingScore * 0.22 +
    rmsScore * 0.23 +
    silenceScore * 0.20 +
    loudnessRangeScore * 0.15 +
    discontinuityScore * 0.15 +
    dcScore * 0.05;

  const rateParams = SPEAKING_RATE_BY_CONTENT_TYPE[contentType];
  const rateScore = scoreCentered(speechWpm, rateParams.ideal, rateParams.goodDeviation, rateParams.hardDeviation);
  const pauseRatioScore = scoreNearRange(silenceRatio, 0.06, 0.28, 0, 0.55);
  const pauseCountScore = scoreNearRange(pauseCountRatio, 0.5, 1.8, 0, 3.2);
  const prosodyRangeScore = scoreNearRange(loudnessRangeDb, 5, 22, 0, 34);

  const prosodyHeuristicScore =
    rateScore * 0.45 +
    pauseRatioScore * 0.25 +
    pauseCountScore * 0.15 +
    prosodyRangeScore * 0.15;

  return {
    prosodyHeuristicScore: clampPercentScore(prosodyHeuristicScore),
    signalHygieneScore: clampPercentScore(signalHygieneScore),
    signalMetrics: {
      durationSeconds,
      peakDbfs,
      rmsDbfs,
      clippingRatio,
      silenceRatio,
      loudnessRangeDb,
      abruptDiscontinuitiesPerSecond,
      dcOffset,
      initialSilenceSeconds,
      finalSilenceSeconds,
      pauseCount: pauses.length,
      medianPauseSeconds,
      maxPauseSeconds,
    },
    prosodyMetrics: {
      speechWordsPerMinute: speechWpm,
      speakingRateCharsPerSecond: charsPerSecond,
      expectedPauseCount,
      detectedPauseCount: pauses.length,
      pauseCountRatio,
      rateScore,
      pauseRatioScore,
      pauseCountScore,
      loudnessRangeScore: prosodyRangeScore,
    },
    warnings,
  };
}

function componentFromMos(
  mos: number | null,
  weight: number,
  source: string,
  missingNote: string,
): ComponentScore {
  const mosValue = typeof mos === "number" && Number.isFinite(mos) ? mos : null;
  const score = mosToPercentScore(mosValue);
  if (score === null || mosValue === null) {
    return {
      score: null,
      weight,
      status: "missing",
      source,
      note: missingNote,
    };
  }
  return {
    score,
    weight,
    status: "scored",
    source,
    note: `MOS ${mosValue.toFixed(3)} converted with (mos - 1) / 4 * 100.`,
    mos: mosValue,
  };
}

function scoredComponent(score: number, weight: number, source: string, note: string, details?: Record<string, unknown>): ComponentScore {
  return {
    score: clampPercentScore(score),
    weight,
    status: "scored",
    source,
    note,
    ...(details ? { details } : {}),
  };
}

function missingComponent(weight: number, source: string, note: string): ComponentScore {
  return {
    score: null,
    weight,
    status: "missing",
    source,
    note,
  };
}

function nisqaQualityMos(fixture: MetricFixtureProvider | null): number | null {
  const direct = finiteNumber(fixture?.nisqaQualityMos) ?? finiteNumber(fixture?.nisqa?.qualityMos);
  if (direct !== null) return direct;
  const dimensions = [
    finiteNumber(fixture?.nisqa?.noisinessMos),
    finiteNumber(fixture?.nisqa?.colorationMos),
    finiteNumber(fixture?.nisqa?.discontinuityMos),
    finiteNumber(fixture?.nisqa?.loudnessMos),
  ].filter((value): value is number => value !== null);
  if (dimensions.length === 0) return null;
  return dimensions.reduce((sum, value) => sum + value, 0) / dimensions.length;
}

function paidJudgeScoreFromFixture(fixture: MetricFixtureProvider | null): ComponentScore | null {
  const score = finiteNumber(fixture?.paidAudioJudgeScore) ??
    finiteNumber(fixture?.paidAudioJudge?.naturalnessScore) ??
    finiteNumber(fixture?.paidAudioJudge?.score);
  if (score === null) return null;
  return scoredComponent(
    score,
    NATURALNESS_WEIGHTS.paidAudioJudgeRubric,
    "metric-fixtures",
    "Paid audio-judge rubric score supplied by fixture.",
    {
      confidence: finiteNumber(fixture?.paidAudioJudge?.confidence),
      notes: fixture?.paidAudioJudge?.notes ?? null,
    },
  );
}

function transcriptText(value: string | { text?: string; transcript?: string }): string {
  if (typeof value === "string") return value;
  return value.text ?? value.transcript ?? "";
}

function roundtripFromFixture(
  fixture: MetricFixtureProvider | null,
  inputText: string,
): RoundtripEngineResult[] {
  const source = fixture?.roundtripTranscripts ?? fixture?.stt;
  if (!source) return [];
  return Object.entries(source)
    .map(([engine, value]) => {
      const transcript = transcriptText(value).trim();
      return {
        engine,
        transcript,
        wer: roundtripWer(inputText, transcript),
      };
    })
    .filter((entry) => entry.transcript.length > 0);
}

function readRoundtripDir(
  roundtripDir: string | null,
  audioFileName: string,
  inputText: string,
): RoundtripEngineResult[] {
  if (!roundtripDir) return [];
  const results: RoundtripEngineResult[] = [];
  const flatPath = join(roundtripDir, `${audioFileName}.txt`);
  if (existsSync(flatPath)) {
    const transcript = readFileSync(flatPath, "utf8").trim();
    results.push({
      engine: "roundtrip-dir",
      transcript,
      wer: roundtripWer(inputText, transcript),
    });
  }
  for (const engine of PAID_STT_ENGINES) {
    const dirName = engine.key.replace("/", "-");
    const enginePath = join(roundtripDir, dirName, `${audioFileName}.txt`);
    if (existsSync(enginePath)) {
      const transcript = readFileSync(enginePath, "utf8").trim();
      results.push({
        engine: engine.key,
        transcript,
        wer: roundtripWer(inputText, transcript),
      });
    }
  }
  return results;
}

async function runOpenAiTranscription(audioPath: string, model: string): Promise<string> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for OpenAI STT");
  const baseURL = (process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const form = new FormData();
  form.append("model", model);
  form.append("response_format", "json");
  form.append("file", Bun.file(audioPath));
  const response = await fetch(`${baseURL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI transcription failed (${response.status}): ${rawText.slice(0, 500)}`);
  }
  const payload = JSON.parse(rawText) as unknown;
  if (!isRecord(payload) || typeof payload["text"] !== "string") {
    throw new Error("OpenAI transcription response missing text");
  }
  return payload["text"].trim();
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function runAssemblyAiTranscription(audioPath: string, model: string): Promise<string> {
  const apiKey = process.env["ASSEMBLYAI_API_KEY"];
  if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY is required for AssemblyAI STT");
  const baseURL = (process.env["ASSEMBLYAI_BASE_URL"] ?? "https://api.assemblyai.com").replace(/\/+$/, "");
  const uploadResponse = await fetch(`${baseURL}/v2/upload`, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/octet-stream",
    },
    body: Bun.file(audioPath),
  });
  const uploadRaw = await uploadResponse.text();
  if (!uploadResponse.ok) {
    throw new Error(`AssemblyAI upload failed (${uploadResponse.status}): ${uploadRaw.slice(0, 500)}`);
  }
  const upload = JSON.parse(uploadRaw) as unknown;
  if (!isRecord(upload) || typeof upload["upload_url"] !== "string") {
    throw new Error("AssemblyAI upload response missing upload_url");
  }

  const createResponse = await fetch(`${baseURL}/v2/transcript`, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      audio_url: upload["upload_url"],
      speech_models: [model],
    }),
  });
  const createRaw = await createResponse.text();
  if (!createResponse.ok) {
    throw new Error(`AssemblyAI transcript creation failed (${createResponse.status}): ${createRaw.slice(0, 500)}`);
  }
  const created = JSON.parse(createRaw) as unknown;
  if (!isRecord(created) || typeof created["id"] !== "string") {
    throw new Error("AssemblyAI transcript creation response missing id");
  }

  const transcriptId = created["id"];
  const deadline = Date.now() + 20 * 60 * 1000;
  let delayMs = 1000;
  while (Date.now() < deadline) {
    const pollResponse = await fetch(`${baseURL}/v2/transcript/${transcriptId}`, {
      method: "GET",
      headers: { authorization: apiKey },
    });
    const pollRaw = await pollResponse.text();
    if (!pollResponse.ok) {
      throw new Error(`AssemblyAI polling failed (${pollResponse.status}): ${pollRaw.slice(0, 500)}`);
    }
    const payload = JSON.parse(pollRaw) as unknown;
    if (!isRecord(payload) || typeof payload["status"] !== "string") {
      throw new Error("AssemblyAI poll response missing status");
    }
    if (payload["status"] === "completed") {
      return typeof payload["text"] === "string" ? payload["text"].trim() : "";
    }
    if (payload["status"] === "error") {
      throw new Error(`AssemblyAI transcription failed: ${String(payload["error"] ?? "unknown error")}`);
    }
    await sleep(delayMs);
    delayMs = Math.min(10000, Math.round(delayMs * 1.5));
  }
  throw new Error(`AssemblyAI timed out waiting for transcript ${transcriptId}`);
}

async function runPaidStt(
  normalizedAudioPath: string,
  audioFileName: string,
  runDir: string,
  inputText: string,
  failurePolicy: PaidFailurePolicy,
): Promise<{ results: RoundtripEngineResult[]; warnings: string[] }> {
  const results: RoundtripEngineResult[] = [];
  const warnings: string[] = [];
  const cacheRoot = join(runDir, "voice-quality-roundtrip");
  for (const engine of PAID_STT_ENGINES) {
    if (engine.service === "openai-stt" && !process.env["OPENAI_API_KEY"]) {
      continue;
    }
    if (engine.service === "assemblyai" && !process.env["ASSEMBLYAI_API_KEY"]) {
      continue;
    }
    const dirName = engine.key.replace("/", "-");
    const engineDir = join(cacheRoot, dirName);
    mkdirSync(engineDir, { recursive: true });
    const transcriptPath = join(engineDir, `${audioFileName}.txt`);
    let transcript: string;
    let paidCallInFlight = false;
    try {
      if (existsSync(transcriptPath)) {
        transcript = readFileSync(transcriptPath, "utf8").trim();
      } else if (engine.service === "openai-stt") {
        paidCallInFlight = true;
        transcript = await runOpenAiTranscription(normalizedAudioPath, engine.model);
        paidCallInFlight = false;
        writeFileSync(transcriptPath, `${transcript}\n`);
      } else {
        paidCallInFlight = true;
        transcript = await runAssemblyAiTranscription(normalizedAudioPath, engine.model);
        paidCallInFlight = false;
        writeFileSync(transcriptPath, `${transcript}\n`);
      }
      results.push({
        engine: engine.key,
        transcript,
        wer: roundtripWer(inputText, transcript),
      });
    } catch (error) {
      if (paidCallInFlight) {
        recordPaidFailure(
          { ...failurePolicy, warnings },
          paidSttSubsystemLabel(engine.service),
          error,
        );
      } else {
        warnings.push(`${engine.key} cached roundtrip transcript failed: ${errorMessage(error)}`);
      }
    }
  }
  return { results, warnings };
}

export function buildOpenAiAudioJudgeRequestBody(input: {
  model: string;
  audioBase64: string;
  inputText: string;
  jsonMode?: boolean;
  audioOutput?: boolean;
  toolMode?: boolean;
}): Record<string, unknown> {
  const prompt = [
    "Evaluate this text-to-speech sample against the supplied reference text.",
    "Return exactly one compact JSON object and no markdown, code fences, prose, or commentary.",
    "Use this schema: {\"naturalnessScore\":number|null,\"pronunciationScore\":number|null,\"prosodyScore\":number|null,\"artifactScore\":number|null,\"confidence\":number,\"notes\":string}.",
    "Use 0-100 numbers for score fields when the audio can be judged. Use null only when the audio is unavailable or cannot be understood.",
    "Score naturalness as human-like speaking flow, intonation, expressiveness, and absence of synthetic cadence.",
    "Do not score cost, latency, provider reputation, or anything not audible in the sample.",
    "",
    "Reference text:",
    input.inputText,
  ].join("\n");
  return {
    model: input.model,
    store: false,
    modalities: input.audioOutput ? ["text", "audio"] : ["text"],
    ...(input.audioOutput ? { audio: { voice: "alloy", format: "wav" } } : {}),
    ...(input.jsonMode === false ? {} : { response_format: { type: "json_object" } }),
    ...(input.toolMode ? {
      tools: [
        {
          type: "function",
          function: {
            name: "record_tts_voice_quality",
            description: "Record the voice-quality rubric scores for this text-to-speech audio sample.",
            parameters: {
              type: "object",
              additionalProperties: false,
              properties: {
                naturalnessScore: { type: ["number", "null"] },
                pronunciationScore: { type: ["number", "null"] },
                prosodyScore: { type: ["number", "null"] },
                artifactScore: { type: ["number", "null"] },
                confidence: { type: "number" },
                notes: { type: "string" },
              },
              required: [
                "naturalnessScore",
                "pronunciationScore",
                "prosodyScore",
                "artifactScore",
                "confidence",
                "notes",
              ],
            },
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: "record_tts_voice_quality" },
      },
    } : {}),
    messages: [
      {
        role: "system",
        content: "You are a speech-quality evaluator. Return only valid JSON and no explanatory prose.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "input_audio",
            input_audio: {
              data: input.audioBase64,
              format: "wav",
            },
          },
        ],
      },
    ],
    temperature: 0,
  };
}

function tryParseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return (match?.[1] ?? trimmed).trim();
}

function firstParsableJsonObject(text: string): {
  parsed: Record<string, unknown> | null;
  malformedSnippet: string | null;
  truncatedSnippet: string | null;
} {
  let malformedSnippet: string | null = null;
  let truncatedSnippet: string | null = null;

  for (let start = 0; start < text.length; start += 1) {
    if (text.charAt(start) !== "{") continue;

    let depth = 0;
    let inString = false;
    let escaped = false;
    let closed = false;

    for (let index = start; index < text.length; index += 1) {
      const char = text.charAt(index);

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
        continue;
      }
      if (char === "{") {
        depth += 1;
        continue;
      }
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          closed = true;
          const candidate = text.slice(start, index + 1);
          const parsed = tryParseJsonObject(candidate);
          if (parsed) {
            return { parsed, malformedSnippet: null, truncatedSnippet: null };
          }
          malformedSnippet ??= candidate;
          break;
        }
      }
    }

    if (!closed && depth > 0) {
      truncatedSnippet ??= text.slice(start);
    }
  }

  return { parsed: null, malformedSnippet, truncatedSnippet };
}

function previewText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

export function parseOpenAiAudioJudgeResponseContent(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error("OpenAI audio judge returned an empty text response");
  }

  const unfenced = stripJsonFence(trimmed);
  const direct = tryParseJsonObject(unfenced);
  if (direct) {
    return direct;
  }

  const embedded = firstParsableJsonObject(unfenced);
  if (embedded.parsed) {
    return embedded.parsed;
  }

  if (embedded.truncatedSnippet) {
    const preview = previewText(embedded.truncatedSnippet);
    throw new Error(`OpenAI audio judge returned truncated JSON object${preview ? `: ${preview}` : ""}`);
  }

  if (embedded.malformedSnippet) {
    const preview = previewText(embedded.malformedSnippet);
    throw new Error(`OpenAI audio judge returned malformed JSON object${preview ? `: ${preview}` : ""}`);
  }

  const preview = previewText(trimmed);
  throw new Error(`OpenAI audio judge returned text without a JSON object${preview ? `: ${preview}` : ""}`);
}

function extractOpenAiAudioJudgeResponseText(payload: unknown): string {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload["choices"]) ||
    !isRecord(payload["choices"][0]) ||
    !isRecord(payload["choices"][0]["message"])
  ) {
    return "";
  }

  const message = payload["choices"][0]["message"];
  const toolCalls = message["tool_calls"];
  if (Array.isArray(toolCalls) && isRecord(toolCalls[0])) {
    const functionCall = toolCalls[0]["function"];
    if (isRecord(functionCall) && typeof functionCall["arguments"] === "string") {
      return functionCall["arguments"];
    }
  }

  const content = message["content"];
  if (typeof content === "string" && content.trim().length > 0) {
    return content;
  }

  const audio = message["audio"];
  if (isRecord(audio) && typeof audio["transcript"] === "string") {
    return audio["transcript"];
  }

  return typeof content === "string" ? content : "";
}

function isOpenAiAudioJudgeResponseFormatUnsupported(status: number, rawText: string): boolean {
  if (status !== 400 && status !== 422) return false;
  const lowered = rawText.toLowerCase();

  try {
    const payload = JSON.parse(rawText) as unknown;
    if (isRecord(payload)) {
      const error = payload["error"];
      if (isRecord(error) && error["param"] === "response_format") {
        return true;
      }
    }
  } catch {
  }

  return lowered.includes("response_format") && (
    lowered.includes("not supported") ||
    lowered.includes("unsupported") ||
    lowered.includes("invalid parameter")
  );
}

function isOpenAiAudioJudgeToolUnsupported(status: number, rawText: string): boolean {
  if (status !== 400 && status !== 422) return false;
  const lowered = rawText.toLowerCase();
  return (
    lowered.includes("tool_choice") ||
    lowered.includes("tool_calls") ||
    lowered.includes("tools") ||
    lowered.includes("function")
  ) && (
    lowered.includes("not supported") ||
    lowered.includes("unsupported") ||
    lowered.includes("invalid parameter")
  );
}

function isOpenAiAudioJudgeMissingAudioText(text: string): boolean {
  const lowered = text.toLowerCase();
  return lowered.includes("audio") && (
    lowered.includes("don't have") ||
    lowered.includes("do not have") ||
    lowered.includes("no audio") ||
    lowered.includes("provide the audio") ||
    lowered.includes("provide an audio") ||
    lowered.includes("without an audio")
  );
}

async function runPaidAudioJudge(
  normalizedAudioPath: string,
  inputText: string,
  model: string,
): Promise<ComponentScore> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for paid audio judging");
  const baseURL = (process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const audioBase64 = readFileSync(normalizedAudioPath).toString("base64");
  const executeJudgeRequest = async (request: { jsonMode: boolean; audioOutput: boolean; toolMode?: boolean }): Promise<{
    ok: boolean;
    status: number;
    rawText: string;
    audioOutput: boolean;
    toolMode: boolean;
  }> => {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(buildOpenAiAudioJudgeRequestBody({
        model,
        audioBase64,
        inputText,
        jsonMode: request.jsonMode,
        audioOutput: request.audioOutput,
        ...(request.toolMode === undefined ? {} : { toolMode: request.toolMode }),
      })),
    });
    return {
      ok: response.ok,
      status: response.status,
      rawText: await response.text(),
      audioOutput: request.audioOutput,
      toolMode: request.toolMode === true,
    };
  };

  let result = await executeJudgeRequest({ jsonMode: true, audioOutput: false });
  if (!result.ok && isOpenAiAudioJudgeResponseFormatUnsupported(result.status, result.rawText)) {
    result = await executeJudgeRequest({ jsonMode: false, audioOutput: true, toolMode: true });
    if (!result.ok && isOpenAiAudioJudgeToolUnsupported(result.status, result.rawText)) {
      result = await executeJudgeRequest({ jsonMode: false, audioOutput: true });
    }
  }

  const parseResult = (rawText: string): {
    parsed: Record<string, unknown>;
    content: string;
  } => {
    const payload = JSON.parse(rawText) as unknown;
    const content = extractOpenAiAudioJudgeResponseText(payload);
    return {
      parsed: parseOpenAiAudioJudgeResponseContent(content),
      content,
    };
  };

  if (!result.ok) {
    throw new Error(`OpenAI audio judge failed (${result.status}): ${result.rawText.slice(0, 500)}`);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseResult(result.rawText).parsed;
  } catch (error) {
    let content = "";
    try {
      const payload = JSON.parse(result.rawText) as unknown;
      content = extractOpenAiAudioJudgeResponseText(payload);
    } catch {
    }
    if (result.audioOutput || !isOpenAiAudioJudgeMissingAudioText(content)) {
      throw error;
    }
    result = await executeJudgeRequest({ jsonMode: false, audioOutput: true, toolMode: true });
    if (!result.ok && isOpenAiAudioJudgeToolUnsupported(result.status, result.rawText)) {
      result = await executeJudgeRequest({ jsonMode: false, audioOutput: true });
    }
    if (!result.ok) {
      throw new Error(`OpenAI audio judge failed (${result.status}): ${result.rawText.slice(0, 500)}`);
    }
    parsed = parseResult(result.rawText).parsed;
  }

  const score = finiteNumber(parsed["naturalnessScore"]);
  if (score === null) {
    throw new Error("OpenAI audio judge response missing naturalnessScore");
  }
  return scoredComponent(
    score,
    NATURALNESS_WEIGHTS.paidAudioJudgeRubric,
    `openai/${model}`,
    "Paid audio-judge rubric naturalness score.",
    {
      pronunciationScore: finiteNumber(parsed["pronunciationScore"]),
      prosodyScore: finiteNumber(parsed["prosodyScore"]),
      artifactScore: finiteNumber(parsed["artifactScore"]),
      confidence: finiteNumber(parsed["confidence"]),
    },
  );
}

function roundtripComponent(results: RoundtripEngineResult[]): ComponentScore {
  const medianWer = median(results.map((result) => result.wer));
  if (medianWer === null) {
    return missingComponent(
      SPEECH_QUALITY_WEIGHTS.roundtripSttIntelligibility,
      "roundtrip-stt",
      "No roundtrip STT transcripts were available.",
    );
  }
  return scoredComponent(
    Math.max(0, 100 * (1 - medianWer)),
    SPEECH_QUALITY_WEIGHTS.roundtripSttIntelligibility,
    "median-roundtrip-wer",
    "Intelligibility score from median WER across available STT engines.",
    {
      medianWer,
      engines: results.map((result) => ({ engine: result.engine, wer: result.wer })),
    },
  );
}

function aggregateComponents(components: Record<string, ComponentScore>): {
  score: number | null;
  coverage: ScoreCoverage;
  missing: string[];
} {
  const inputs: VoiceQualityScoreInput[] = Object.entries(components).map(([key, component]) => ({
    key,
    score: component.score,
    weight: component.weight,
  }));
  const aggregate = aggregateWeightedScore(inputs);
  return {
    score: aggregate.score,
    coverage: {
      availableWeight: aggregate.availableWeight,
      totalWeight: aggregate.totalWeight,
    },
    missing: aggregate.missingKeys,
  };
}

async function evaluateProvider(options: {
  runDir: string;
  inputText: string;
  inputCharCount: number;
  inputWordCount: number;
  entry: ReturnType<typeof loadTtsRunJson>["metadata"]["tts"][number];
  audioPath: string | undefined;
  fixtures: MetricFixtures | null;
  roundtripDir: string | null;
  mode: VoiceQualityReportMode;
  allowPaid: boolean;
  audioJudgeModel: string;
  tempDir: string;
  contentType?: ContentType;
}): Promise<Omit<ProviderVoiceQualityEntry, "rank">> {
  const providerKey = makeProviderKey(options.entry.ttsService, options.entry.ttsModel);
  const warnings: string[] = [];
  const paidFailurePolicy: PaidFailurePolicy = {
    strict: strictPaidFailures(options.mode, options.allowPaid),
    providerKey,
    warnings,
  };
  const fixture = fixtureForProvider(options.fixtures, providerKey, options.entry.audioFileName);
  let originalAudioProperties: AudioProperties | null = null;
  let heuristics: HeuristicResult | null = null;
  let normalizedAudioPath: string | null = null;

  if (options.audioPath) {
    try {
      originalAudioProperties = await probeAudio(options.audioPath);
    } catch (error) {
      warnings.push(`ffprobe failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      normalizedAudioPath = join(options.tempDir, `${options.entry.audioFileName.replace(/[^a-zA-Z0-9._-]/g, "_")}.16k-mono.wav`);
      await normalizeAudio(options.audioPath, normalizedAudioPath);
      const wav = readPcm16MonoWav(normalizedAudioPath);
      heuristics = computeHeuristics(wav, options.inputText, options.inputWordCount, options.inputCharCount, options.contentType);
      warnings.push(...heuristics.warnings);
    } catch (error) {
      warnings.push(`audio heuristics failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    warnings.push("Audio file is missing");
  }

  const utmosMos = finiteNumber(fixture?.utmosv2Mos);
  const nisqaNaturalnessMos = finiteNumber(fixture?.nisqaTtsNaturalnessMos) ??
    finiteNumber(fixture?.nisqaNaturalnessMos) ??
    finiteNumber(fixture?.nisqa?.naturalnessMos);
  const qualityMos = nisqaQualityMos(fixture);
  const dnsmosMos = finiteNumber(fixture?.dnsmosOverallMos) ??
    finiteNumber(fixture?.dnsmosMos) ??
    finiteNumber(fixture?.dnsmos?.overallMos) ??
    finiteNumber(fixture?.dnsmos?.p808Mos);

  let paidJudgeComponent = paidJudgeScoreFromFixture(fixture);
  if (!paidJudgeComponent && options.mode === "full" && options.allowPaid && normalizedAudioPath && process.env["OPENAI_API_KEY"]) {
    try {
      paidJudgeComponent = await runPaidAudioJudge(normalizedAudioPath, options.inputText, options.audioJudgeModel);
    } catch (error) {
      recordPaidFailure(paidFailurePolicy, "OpenAI audio judge", error);
    }
  }

  const roundtripResults = [
    ...roundtripFromFixture(fixture, options.inputText),
    ...readRoundtripDir(options.roundtripDir, options.entry.audioFileName, options.inputText),
  ];
  if (roundtripResults.length === 0 && options.mode === "full" && options.allowPaid && normalizedAudioPath) {
    const paidStt = await runPaidStt(
      normalizedAudioPath,
      options.entry.audioFileName,
      options.runDir,
      options.inputText,
      paidFailurePolicy,
    );
    roundtripResults.push(...paidStt.results);
    warnings.push(...paidStt.warnings);
  }

  const naturalnessComponents: Record<string, ComponentScore> = {
    utmosv2Mos: componentFromMos(
      utmosMos,
      NATURALNESS_WEIGHTS.utmosv2Mos,
      fixture ? "metric-fixtures" : "utmosv2",
      "UTMOSv2 MOS was not available. Provide --metric-fixtures with utmosv2Mos or run a UTMOSv2 scorer externally.",
    ),
    nisqaTtsNaturalnessMos: componentFromMos(
      nisqaNaturalnessMos,
      NATURALNESS_WEIGHTS.nisqaTtsNaturalnessMos,
      fixture ? "metric-fixtures" : "nisqa-tts",
      "NISQA-TTS naturalness MOS was not available. Provide --metric-fixtures with nisqaTtsNaturalnessMos.",
    ),
    paidAudioJudgeRubric: paidJudgeComponent ?? missingComponent(
      NATURALNESS_WEIGHTS.paidAudioJudgeRubric,
      options.mode === "local" ? "paid-audio-judge-omitted" : "paid-audio-judge",
      options.mode === "local"
        ? "Local mode does not call paid audio judging."
        : "Paid audio judge score was not available.",
    ),
    prosodyHeuristics: heuristics
      ? scoredComponent(
        heuristics.prosodyHeuristicScore,
        NATURALNESS_WEIGHTS.prosodyHeuristics,
        "ffmpeg-pcm-heuristics",
        "Prosody heuristic score from speaking rate, pause ratio, pause distribution, and loudness motion.",
        heuristics.prosodyMetrics,
      )
      : missingComponent(
        NATURALNESS_WEIGHTS.prosodyHeuristics,
        "ffmpeg-pcm-heuristics",
        "Prosody heuristics could not be computed.",
      ),
  };

  const speechQualityComponents: Record<string, ComponentScore> = {
    nisqaQualityMos: componentFromMos(
      qualityMos,
      SPEECH_QUALITY_WEIGHTS.nisqaQualityMos,
      fixture ? "metric-fixtures" : "nisqa",
      "NISQA quality MOS was not available. Provide --metric-fixtures with nisqaQualityMos or NISQA dimensions.",
    ),
    dnsmos: componentFromMos(
      dnsmosMos,
      SPEECH_QUALITY_WEIGHTS.dnsmos,
      fixture ? "metric-fixtures" : "dnsmos",
      "DNSMOS was not available. Provide --metric-fixtures with dnsmosMos or dnsmos.overallMos.",
    ),
    roundtripSttIntelligibility: roundtripComponent(roundtripResults),
    signalHygiene: heuristics
      ? scoredComponent(
        heuristics.signalHygieneScore,
        SPEECH_QUALITY_WEIGHTS.signalHygiene,
        "ffmpeg-pcm-heuristics",
        "Signal hygiene score from clipping, loudness, silence ratio, loudness range, discontinuities, and DC offset.",
        heuristics.signalMetrics as unknown as Record<string, unknown>,
      )
      : missingComponent(
        SPEECH_QUALITY_WEIGHTS.signalHygiene,
        "ffmpeg-pcm-heuristics",
        "Signal hygiene could not be computed.",
      ),
  };

  const naturalness = aggregateComponents(naturalnessComponents);
  const speechQuality = aggregateComponents(speechQualityComponents);
  const humanSpeechAggregate = aggregateWeightedScore([
    { key: "naturalness", score: naturalness.score, weight: HUMAN_SPEECH_WEIGHTS.naturalness },
    { key: "speechQuality", score: speechQuality.score, weight: HUMAN_SPEECH_WEIGHTS.speechQuality },
  ]);
  const missingMetrics = [
    ...naturalness.missing.map((metric) => `naturalness.${metric}`),
    ...speechQuality.missing.map((metric) => `speechQuality.${metric}`),
  ];

  return {
    providerKey,
    ttsService: options.entry.ttsService,
    ttsModel: options.entry.ttsModel,
    speaker: options.entry.speaker ?? null,
    group: isLocalService(options.entry.ttsService) ? "local" : "cloud",
    audioFileName: options.entry.audioFileName,
    audioFileSize: options.entry.audioFileSize,
    audioExists: options.audioPath !== undefined,
    originalAudioProperties,
    naturalnessScore: naturalness.score,
    speechQualityScore: speechQuality.score,
    humanSpeechScore: humanSpeechAggregate.score,
    scoreCoverage: {
      naturalness: naturalness.coverage,
      speechQuality: speechQuality.coverage,
      humanSpeech: {
        availableWeight: humanSpeechAggregate.availableWeight,
        totalWeight: humanSpeechAggregate.totalWeight,
      },
    },
    componentScores: {
      naturalness: naturalnessComponents,
      speechQuality: speechQualityComponents,
    },
    metricDetails: {
      signalMetrics: heuristics?.signalMetrics ?? null,
      prosodyMetrics: heuristics?.prosodyMetrics ?? null,
      roundtripStt: {
        medianWer: median(roundtripResults.map((result) => result.wer)),
        engines: roundtripResults,
      },
    },
    missingMetrics,
    warnings,
  };
}

function formatScore(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(2);
}

function formatCoverage(coverage: ScoreCoverage): string {
  return `${Math.round((coverage.availableWeight / coverage.totalWeight) * 100)}%`;
}

function humanSpeechConfidence(provider: ProviderVoiceQualityEntry): string {
  const natPct = provider.scoreCoverage.naturalness.availableWeight / provider.scoreCoverage.naturalness.totalWeight;
  const qualPct = provider.scoreCoverage.speechQuality.availableWeight / provider.scoreCoverage.speechQuality.totalWeight;
  const combined = (natPct + qualPct) / 2;
  if (combined > 0.8) return "High";
  if (combined >= 0.4) return "Medium";
  return "Low";
}

function buildProviderDetails(providers: ProviderVoiceQualityEntry[]): string {
  return providers.map((provider) => {
    const lines: string[] = [];
    lines.push(`### ${provider.rank}. \`${provider.providerKey}\` (${provider.group})`);
    lines.push("");
    lines.push(`| Metric | Score |`);
    lines.push(`| --- | ---: |`);
    lines.push(`| Human Speech | ${formatScore(provider.humanSpeechScore)} |`);
    lines.push(`| Naturalness | ${formatScore(provider.naturalnessScore)} |`);
    lines.push(`| Speech Quality | ${formatScore(provider.speechQualityScore)} |`);
    lines.push(`| Confidence | ${humanSpeechConfidence(provider)} |`);
    lines.push("");

    lines.push("**Naturalness Components**");
    lines.push("");
    lines.push("| Component | Score | Weight | Source |");
    lines.push("| --- | ---: | ---: | --- |");
    for (const [key, comp] of Object.entries(provider.componentScores.naturalness)) {
      lines.push(`| ${key} | ${formatScore(comp.score)} | ${(comp.weight * 100).toFixed(0)}% | ${comp.source} |`);
    }
    lines.push("");

    lines.push("**Speech Quality Components**");
    lines.push("");
    lines.push("| Component | Score | Weight | Source |");
    lines.push("| --- | ---: | ---: | --- |");
    for (const [key, comp] of Object.entries(provider.componentScores.speechQuality)) {
      lines.push(`| ${key} | ${formatScore(comp.score)} | ${(comp.weight * 100).toFixed(0)}% | ${comp.source} |`);
    }
    lines.push("");

    if (provider.metricDetails.signalMetrics) {
      const sm = provider.metricDetails.signalMetrics;
      lines.push("**Signal Metrics**");
      lines.push("");
      lines.push(`- Duration: ${sm.durationSeconds.toFixed(2)}s`);
      lines.push(`- Peak: ${sm.peakDbfs.toFixed(1)} dBFS, RMS: ${sm.rmsDbfs.toFixed(1)} dBFS`);
      lines.push(`- Clipping: ${(sm.clippingRatio * 100).toFixed(3)}%, Silence: ${(sm.silenceRatio * 100).toFixed(1)}%`);
      lines.push(`- Loudness range: ${sm.loudnessRangeDb.toFixed(1)} dB`);
      lines.push(`- Pauses: ${sm.pauseCount}${sm.medianPauseSeconds !== null ? ` (median ${sm.medianPauseSeconds.toFixed(2)}s)` : ""}`);
      lines.push("");
    }

    if (provider.metricDetails.prosodyMetrics) {
      const pm = provider.metricDetails.prosodyMetrics;
      lines.push("**Prosody Metrics**");
      lines.push("");
      if (pm["speechWordsPerMinute"] !== null) lines.push(`- Speaking rate: ${(pm["speechWordsPerMinute"] as number).toFixed(0)} WPM`);
      if (pm["speakingRateCharsPerSecond"] !== null) lines.push(`- Characters/sec: ${(pm["speakingRateCharsPerSecond"] as number).toFixed(1)}`);
      if (pm["detectedPauseCount"] !== null) lines.push(`- Detected pauses: ${pm["detectedPauseCount"]} (expected ~${pm["expectedPauseCount"]})`);
      lines.push("");
    }

    if (provider.metricDetails.roundtripStt.engines.length > 0) {
      lines.push("**Roundtrip STT**");
      lines.push("");
      lines.push("| Engine | WER |");
      lines.push("| --- | ---: |");
      for (const engine of provider.metricDetails.roundtripStt.engines) {
        lines.push(`| ${engine.engine} | ${(engine.wer * 100).toFixed(2)}% |`);
      }
      if (provider.metricDetails.roundtripStt.medianWer !== null) {
        lines.push(`| **Median** | **${(provider.metricDetails.roundtripStt.medianWer * 100).toFixed(2)}%** |`);
      }
      lines.push("");
    }

    if (provider.warnings.length > 0) {
      lines.push("**Warnings**");
      lines.push("");
      for (const warning of provider.warnings) {
        lines.push(`- ${warning}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }).join("\n---\n\n");
}

function buildRecommendations(
  providers: ProviderVoiceQualityEntry[],
  mode: VoiceQualityReportMode,
): string {
  const lines: string[] = [];
  const bestLocal = providers.find((p) => p.group === "local");
  const bestCloud = providers.find((p) => p.group === "cloud");
  const best = providers[0];

  if (best) {
    lines.push(`- **Best overall**: \`${best.providerKey}\` (${formatScore(best.humanSpeechScore)}/100)`);
  }
  if (bestLocal) {
    lines.push(`- **Best local**: \`${bestLocal.providerKey}\` (${formatScore(bestLocal.humanSpeechScore)}/100)`);
  }
  if (bestCloud) {
    lines.push(`- **Best cloud**: \`${bestCloud.providerKey}\` (${formatScore(bestCloud.humanSpeechScore)}/100)`);
  }

  if (best && providers.length > 1) {
    const second = providers[1];
    if (second && best.humanSpeechScore !== null && second.humanSpeechScore !== null) {
      const gap = best.humanSpeechScore - second.humanSpeechScore;
      if (gap > 5) {
        lines.push(`- \`${best.providerKey}\` leads by ${gap.toFixed(1)} points over \`${second.providerKey}\``);
      }
    }
  }

  const poorSignal = providers.filter((p) => {
    const sh = p.componentScores.speechQuality["signalHygiene"];
    return sh && sh.score !== null && sh.score < 50;
  });
  if (poorSignal.length > 0) {
    lines.push(`- **Signal hygiene concerns**: ${poorSignal.map((p) => `\`${p.providerKey}\``).join(", ")}`);
  }

  const lowCoverage = providers.filter((p) => humanSpeechConfidence(p) === "Low");
  if (lowCoverage.length > 0) {
    const prefix = `- ${lowCoverage.length} provider(s) have low score coverage.`;
    if (mode === "local") {
      lines.push(`${prefix} Run with \`--tts-mode full\` or supply \`--tts-metric-fixtures\` for higher confidence.`);
    } else {
      const externalMetrics = [
        "`utmosv2Mos`",
        "`nisqaTtsNaturalnessMos`",
        "`nisqaQualityMos`",
        "`dnsmosMos`",
      ].join(", ");
      lines.push(
        `${prefix} Full mode already ran; remaining low coverage usually means ` +
        `external MOS/DNS metrics are missing (${externalMetrics}). Supply ` +
        "`--tts-metric-fixtures` from external scorers for higher confidence.",
      );
    }
  }

  return lines.join("\n");
}

function buildMarkdown(report: {
  inputTextPath: string;
  inputTextCharCount: number;
  inputTextWordCount: number;
  mode: VoiceQualityReportMode;
  contentType: ContentType;
  providerCount: number;
  localCount: number;
  cloudCount: number;
  providers: ProviderVoiceQualityEntry[];
  warnings: string[];
}): string {
  const rankingRows = report.providers.map((provider) => {
    const missing = provider.missingMetrics.length === 0 ? "none" : provider.missingMetrics.join(", ");
    const confidence = humanSpeechConfidence(provider);
    return `| ${provider.rank} | \`${provider.providerKey}\` | ${provider.group} | ${formatScore(provider.humanSpeechScore)} | ${formatScore(provider.naturalnessScore)} | ${formatScore(provider.speechQualityScore)} | ${confidence} | ${formatCoverage(provider.scoreCoverage.naturalness)} / ${formatCoverage(provider.scoreCoverage.speechQuality)} | ${missing} |`;
  }).join("\n");

  const bestLocal = report.providers.find((provider) => provider.group === "local");
  const bestCloud = report.providers.find((provider) => provider.group === "cloud");
  const warningLines = report.warnings.length > 0
    ? report.warnings.map((warning) => `- ${warning}`).join("\n")
    : "- None";

  const contentTypeNote = report.contentType !== "default"
    ? `\n- Content type: ${report.contentType} (speaking rate tuned for this content type)`
    : "";

  return `# TTS Voice Quality Report

## Summary

- Input text: \`${basename(report.inputTextPath)}\` (${report.inputTextCharCount} characters, ${report.inputTextWordCount} words)
- Total providers: ${report.providerCount} (${report.localCount} local, ${report.cloudCount} cloud)
- Mode: ${report.mode}${contentTypeNote}
- Human speech score: 55% naturalnessScore + 45% speechQualityScore
- Naturalness score target weights: 45% UTMOSv2 MOS, 25% NISQA-TTS naturalness MOS, 20% paid audio-judge rubric, 10% prosody heuristics
- Speech quality score target weights: 35% NISQA quality MOS, 25% DNSMOS, 25% roundtrip STT intelligibility, 15% signal hygiene

## Method

- Audio files are normalized to temporary 16 kHz mono WAV for scoring. Original files are not modified.
- Silence threshold is computed adaptively from the audio noise floor.
- MOS-style 1-5 metrics are converted with \`(mos - 1) / 4 * 100\`.
- Missing components are omitted from that score's denominator and listed per provider.
- Cost, provider processing speed, and provider latency are not included in human-speech scoring.
- Full mode treats attempted paid scoring failures as fatal when credentials are configured.
- Local mode never starts paid STT or audio-judge calls.
- Confidence: High (>80% coverage), Medium (40-80%), Low (<40%). Low-coverage scores are preliminary.

## Overall Ranking

| Rank | Provider | Group | Human / 100 | Naturalness | Speech Quality | Confidence | Nat/Qual Coverage | Missing Metrics |
| ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |
${rankingRows}

## Best By Group

- Best local model: ${bestLocal ? `\`${bestLocal.providerKey}\` (${formatScore(bestLocal.humanSpeechScore)}/100)` : "n/a"}
- Best cloud service: ${bestCloud ? `\`${bestCloud.providerKey}\` (${formatScore(bestCloud.humanSpeechScore)}/100)` : "n/a"}

## Recommendations

${buildRecommendations(report.providers, report.mode)}

## Provider Details

${buildProviderDetails(report.providers)}

## Warnings

${warningLines}
`;
}

export async function buildVoiceQualityReport(args: VoiceQualityReportOptions) {
  const runJson = loadTtsRunJson(args.runDir);
  const inputTextPath = args.inputTextPath ? resolve(args.inputTextPath) : null;
  const inputText = (args.inputText !== undefined
    ? args.inputText
    : inputTextPath ? readFileSync(inputTextPath, "utf8") : "").trim();
  if (inputText.length === 0) {
    throw new Error("Input text is required for TTS voice-quality scoring.");
  }
  const inputTextSource = inputTextPath ?? args.inputTextLabel ?? "metadata.input";
  const inputTextCharCount = inputText.length;
  const inputTextWordCount = tokenize(inputText).length;
  const fixtures = args.metricFixturesPath ? readJsonFile<MetricFixtures>(args.metricFixturesPath) : null;
  const { found, missing } = discoverAudioFiles(args.runDir, runJson.metadata.tts);
  const warnings = missing.map((fileName) => `Missing audio file: ${fileName}`);
  const tempDir = mkdtempSync(join(tmpdir(), "autoshow-voice-quality-"));

  try {
    const providerEntries: Array<Omit<ProviderVoiceQualityEntry, "rank">> = [];
    for (const entry of runJson.metadata.tts) {
      const providerKey = makeProviderKey(entry.ttsService, entry.ttsModel);
      const evaluated = await evaluateProvider({
        runDir: args.runDir,
        inputText,
        inputCharCount: inputTextCharCount,
        inputWordCount: inputTextWordCount,
        entry,
        audioPath: found.get(providerKey),
        fixtures,
        roundtripDir: args.roundtripDir,
        mode: args.mode,
        allowPaid: args.allowPaid,
        audioJudgeModel: args.audioJudgeModel,
        tempDir,
        ...(args.contentType ? { contentType: args.contentType } : {}),
      });
      warnings.push(...evaluated.warnings.map((warning) => `${providerKey}: ${warning}`));
      providerEntries.push(evaluated);
    }

    const providers = rankVoiceQualityProviders(providerEntries).map((provider) => ({
      ...provider,
      rank: provider.rank,
    }));
    const localCount = providers.filter((provider) => provider.group === "local").length;
    const cloudCount = providers.length - localCount;

    const reportJson = {
      schemaVersion: 1,
      metric: "human-speech-quality",
      generatedAt: new Date().toISOString(),
      runDir: args.runDir,
      inputTextPath: inputTextSource,
      inputTextSource,
      inputTextCharCount,
      inputTextWordCount,
      mode: args.mode,
      contentType: args.contentType ?? "default",
      paidCallsAllowed: args.allowPaid,
      weights: {
        naturalnessScore: NATURALNESS_WEIGHTS,
        speechQualityScore: SPEECH_QUALITY_WEIGHTS,
        humanSpeechScore: HUMAN_SPEECH_WEIGHTS,
      },
      scoringNotes: [
        "MOS-style 1-5 metrics are converted to 0-100 with (mos - 1) / 4 * 100.",
        "Missing components are omitted from the denominator and recorded in missingMetrics.",
        "Cost, processing speed, and provider latency are excluded from human-speech scoring.",
        "Full mode fails when a configured paid scoring call is attempted and returns an error or unusable response.",
      ],
      providerCount: providers.length,
      local: {
        count: localCount,
        providers: providers.filter((provider) => provider.group === "local"),
      },
      cloud: {
        count: cloudCount,
        providers: providers.filter((provider) => provider.group === "cloud"),
      },
      overall: {
        count: providers.length,
        providers,
      },
      providers,
      warnings,
    };

    const markdown = buildMarkdown({
      inputTextPath: inputTextSource,
      inputTextCharCount,
      inputTextWordCount,
      mode: args.mode,
      contentType: args.contentType ?? "default",
      providerCount: providers.length,
      localCount,
      cloudCount,
      providers,
      warnings,
    });

    return { reportJson, markdown, warnings };
  } finally {
    if (!args.keepTemp) {
      rmSync(tempDir, { recursive: true, force: true });
    } else {
      warnings.push(`Kept normalized audio temp directory: ${tempDir}`);
    }
  }
}

export async function writeVoiceQualityReport(args: VoiceQualityReportOptions): Promise<{
  jsonOut: string;
  markdownOut: string;
  warnings: string[];
}> {
  const jsonOut = args.jsonOut ?? resolve(args.runDir, "voice-quality-report.json");
  const markdownOut = args.markdownOut ?? resolve(args.runDir, "voice-quality-report.md");
  const { reportJson, markdown, warnings } = await buildVoiceQualityReport(args);

  for (const warning of warnings) {
    console.error(`[warn] ${warning}`);
  }

  writeFileSync(jsonOut, `${JSON.stringify(reportJson, null, 2)}\n`);
  writeFileSync(markdownOut, markdown);
  return { jsonOut, markdownOut, warnings };
}

async function main(): Promise<number> {
  const args = parseVoiceQualityReportArgs(process.argv.slice(2));
  await writeVoiceQualityReport(args);
  return 0;
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
