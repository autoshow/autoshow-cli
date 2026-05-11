#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { parseDeapiTimestampedTranscript } from "../../../../src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/deapi/deapi-transcript-parser";
import {
  clampEvidenceWordsToKnownEnd,
  clampSegmentsToKnownEnd,
  detectCompressedTimingCoverage,
  repairZeroDurationMonotonicSegments,
} from "../../../../src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-timing-quality";
import {
  countTokens,
  formatTranscriptText,
  toTimestamp,
} from "../../../../src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils";
import type {
  TranscriptionEvidenceWord,
  TranscriptionSegment,
} from "../../../../src/types/process-transcription-types";

type ProviderArtifact = {
  schemaVersion: number;
  kind: string;
  provider: string;
  model?: string;
  metadata?: {
    tokenCount?: number;
    [key: string]: unknown;
  };
  result?: {
    text?: string;
    segments?: TranscriptionSegment[];
    evidence?: {
      segments?: Array<{
        startSeconds: number;
        endSeconds: number;
        text: string;
        speaker?: string;
      }>;
      words?: TranscriptionEvidenceWord[];
      capabilities?: {
        hasNativeWordTiming?: boolean;
        hasConfidence?: boolean;
        hasSpeakerLabels?: boolean;
      };
      timingQuality?: "native_word" | "segment_interpolated" | "coarse";
      rawResponse?: unknown;
    };
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, "utf8")) as T;

const writeJson = (path: string, value: unknown): void => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

const resolveRunDurationSeconds = (runDir: string, artifacts: ProviderArtifact[]): number => {
  const runJson = readJson<unknown>(join(runDir, "run.json"));
  if (isRecord(runJson) && isRecord(runJson["metadata"]) && isRecord(runJson["metadata"]["step1"])) {
    const durationSeconds = runJson["metadata"]["step1"]["durationSeconds"];
    if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0) {
      return durationSeconds;
    }
  }

  let maxEndSeconds = 0;
  for (const artifact of artifacts) {
    for (const segment of artifact.result?.segments ?? []) {
      const [hours = "0", minutes = "0", seconds = "0"] = segment.end.split(":");
      const endSeconds = (Number.parseInt(hours, 10) * 3600) + (Number.parseInt(minutes, 10) * 60) + Number.parseFloat(seconds);
      if (Number.isFinite(endSeconds)) {
        maxEndSeconds = Math.max(maxEndSeconds, endSeconds);
      }
    }
  }
  if (maxEndSeconds > 0) {
    return maxEndSeconds;
  }
  throw new Error(`Could not resolve run duration for ${runDir}`);
};

const providerResultPaths = (runDir: string): string[] => {
  const providersDir = join(runDir, "providers");
  return readdirSync(providersDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(providersDir, entry.name, "result.json"))
    .filter((path) => existsSync(path))
    .sort((left, right) => left.localeCompare(right));
};

const evidenceSegmentsFromSegments = (
  segments: readonly TranscriptionSegment[],
): NonNullable<NonNullable<ProviderArtifact["result"]>["evidence"]>["segments"] =>
  segments.map((segment) => ({
    startSeconds: timestampToSeconds(segment.start),
    endSeconds: timestampToSeconds(segment.end),
    text: segment.text,
    ...(segment.speaker ? { speaker: segment.speaker } : {}),
  }));

const timestampToSeconds = (timestamp: string): number => {
  const parts = timestamp.split(":");
  const seconds = Number.parseFloat(parts.at(-1) ?? "0");
  const minutes = Number.parseInt(parts.at(-2) ?? "0", 10);
  const hours = parts.length === 3 ? Number.parseInt(parts[0] ?? "0", 10) : 0;
  return (hours * 3600) + (minutes * 60) + seconds;
};

const extractDeapiResultText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  for (const key of ["result", "text", "transcript"] as const) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  for (const key of ["data", "raw"] as const) {
    const nested = extractDeapiResultText(value[key]);
    if (nested) {
      return nested;
    }
  }
  return undefined;
};

const parseGeminiRawJson = (rawResponse: unknown): { text: string; segments: TranscriptionSegment[] } | undefined => {
  if (!isRecord(rawResponse) || !Array.isArray(rawResponse["candidates"])) {
    return undefined;
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
        if (!isRecord(payload)) {
          continue;
        }
        const text = typeof payload["text"] === "string" ? payload["text"].trim() : "";
        const segments = Array.isArray(payload["segments"])
          ? payload["segments"].flatMap((segment): TranscriptionSegment[] => {
              if (!isRecord(segment) || typeof segment["start"] !== "number" || typeof segment["end"] !== "number" || typeof segment["text"] !== "string") {
                return [];
              }
              const segmentText = segment["text"].trim();
              if (segmentText.length === 0) {
                return [];
              }
              return [{
                start: toTimestamp(segment["start"]),
                end: toTimestamp(segment["end"]),
                text: segmentText,
              }];
            })
          : [];
        if (text.length > 0 || segments.length > 0) {
          return { text, segments };
        }
      } catch {
        continue;
      }
    }
  }
  return undefined;
};

const repairDeapi = (artifact: ProviderArtifact, runDurationSeconds: number): boolean => {
  const result = artifact.result;
  if (!result) {
    return false;
  }
  const sourceText = extractDeapiResultText(result.evidence?.rawResponse) ?? result.text ?? "";
  const parsed = parseDeapiTimestampedTranscript(sourceText, {
    audioDurationSeconds: runDurationSeconds,
  });
  if (parsed.markerCount === 0) {
    return false;
  }

  const segments = parsed.segments.length > 0
    ? parsed.segments
    : [{ start: "00:00:00", end: "00:00:00", text: parsed.text }];
  result.text = parsed.text;
  result.segments = segments;
  result.evidence = {
    ...(result.evidence ?? {}),
    segments: evidenceSegmentsFromSegments(segments),
    timingQuality: parsed.segments.length > 0 ? "segment_interpolated" : "coarse",
  };
  if (artifact.metadata) {
    artifact.metadata.tokenCount = countTokens(parsed.text);
  }
  return true;
};

const repairGlm = (artifact: ProviderArtifact, runDurationSeconds: number): boolean => {
  const result = artifact.result;
  if (!result?.segments) {
    return false;
  }
  const repaired = repairZeroDurationMonotonicSegments(result.segments, {
    knownEndSeconds: runDurationSeconds,
  });
  if (!repaired.repaired) {
    return false;
  }
  result.segments = repaired.segments;
  result.evidence = {
    ...(result.evidence ?? {}),
    timingQuality: "segment_interpolated",
  };
  return true;
};

const repairGemini = (artifact: ProviderArtifact, runDurationSeconds: number): boolean => {
  const result = artifact.result;
  if (!result) {
    return false;
  }
  const rawParsed = parseGeminiRawJson(result.evidence?.rawResponse);
  if (!rawParsed || rawParsed.segments.length === 0) {
    return false;
  }
  const compressed = detectCompressedTimingCoverage(rawParsed.segments, {
    knownStartSeconds: 0,
    knownEndSeconds: runDurationSeconds,
  });
  if (compressed?.compressed !== true) {
    return false;
  }
  const text = rawParsed.text.length > 0
    ? rawParsed.text
    : rawParsed.segments.map((segment) => segment.text).join(" ").trim();
  result.text = text;
  result.segments = [{ start: "00:00:00", end: "00:00:00", text }];
  result.evidence = {
    ...(result.evidence ?? {}),
    timingQuality: "coarse",
  };
  if (artifact.metadata) {
    artifact.metadata.tokenCount = countTokens(text);
  }
  return true;
};

const repairWhisper = (artifact: ProviderArtifact, runDurationSeconds: number): boolean => {
  const result = artifact.result;
  if (!result) {
    return false;
  }
  let changed = false;
  if (result.segments) {
    const clampedSegments = clampSegmentsToKnownEnd(result.segments, runDurationSeconds);
    if (clampedSegments.clampedCount > 0) {
      result.segments = clampedSegments.segments;
      changed = true;
    }
  }
  if (result.evidence?.words) {
    const clampedWords = clampEvidenceWordsToKnownEnd(result.evidence.words, runDurationSeconds);
    if (clampedWords.clampedCount > 0) {
      result.evidence.words = clampedWords.words;
      changed = true;
    }
  }
  return changed;
};

const repairArtifact = (artifact: ProviderArtifact, runDurationSeconds: number): boolean => {
  switch (artifact.provider) {
    case "deapi":
      return repairDeapi(artifact, runDurationSeconds);
    case "glm-stt":
      return repairGlm(artifact, runDurationSeconds);
    case "gemini-stt":
      return repairGemini(artifact, runDurationSeconds);
    case "whisper":
      return repairWhisper(artifact, runDurationSeconds);
    default:
      return false;
  }
};

const main = (): number => {
  const runDirArg = process.argv[2];
  if (!runDirArg) {
    console.error("Usage: bun repair_saved_stt_artifacts.ts <run_dir>");
    return 1;
  }
  const runDir = resolve(runDirArg);
  const resultPaths = providerResultPaths(runDir);
  const artifacts = resultPaths.map((path) => readJson<ProviderArtifact>(path));
  const runDurationSeconds = resolveRunDurationSeconds(runDir, artifacts);

  const changedProviders: string[] = [];
  for (let index = 0; index < resultPaths.length; index += 1) {
    const resultPath = resultPaths[index]!;
    const artifact = artifacts[index]!;
    if (!repairArtifact(artifact, runDurationSeconds)) {
      continue;
    }
    writeJson(resultPath, artifact);
    if (artifact.result?.segments) {
      writeFileSync(join(dirname(resultPath), "transcription.txt"), `${formatTranscriptText(artifact.result.segments)}\n`);
    }
    changedProviders.push(basename(dirname(resultPath)));
  }

  console.log(JSON.stringify({
    runDir,
    runDurationSeconds,
    changedProviders,
  }, null, 2));
  return 0;
};

if (import.meta.main) {
  process.exit(main());
}
