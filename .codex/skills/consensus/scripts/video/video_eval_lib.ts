#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface VideoEntryMetadata {
  videoGenService: string;
  videoGenModel: string;
  processingTime?: number;
  videoFileName: string;
  videoFileSize?: number;
  videoDuration?: number;
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

export interface VideoRunJson {
  schemaVersion?: number;
  kind: string;
  metadata: {
    video: VideoEntryMetadata[];
    input?: string;
    requestedProviders?: Array<{ service: string; model: string }>;
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

export interface VideoProviderEvidence {
  providerKey: string;
  videoGenService: string;
  videoGenModel: string;
  videoFileName: string;
  videoPath: string;
  videoExists: boolean;
  artifactFileSize: number | null;
  metadataFileSize: number | null;
  videoDurationSeconds: number | null;
  processingTimeMs: number | null;
  costCents: number | null;
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function loadVideoRunJson(runDir: string): VideoRunJson {
  const runJson = readJson<VideoRunJson>(join(runDir, "run.json"));
  if (runJson.kind !== "video") {
    throw new Error(`run.json kind is "${runJson.kind}", expected "video"`);
  }
  if (!Array.isArray(runJson.metadata?.video) || runJson.metadata.video.length === 0) {
    throw new Error("run.json metadata.video is missing or empty");
  }
  return runJson;
}

export function makeProviderKey(service: string, model: string): string {
  return `${service}/${model}`;
}

export function discoverVideoFiles(
  runDir: string,
  videoEntries: VideoEntryMetadata[],
): { found: Map<string, string>; missing: string[] } {
  const found = new Map<string, string>();
  const missing: string[] = [];
  for (const entry of videoEntries) {
    const videoPath = join(runDir, entry.videoFileName);
    if (existsSync(videoPath)) {
      found.set(makeProviderKey(entry.videoGenService, entry.videoGenModel), videoPath);
    } else {
      missing.push(entry.videoFileName);
    }
  }
  return { found, missing };
}

export function buildCostLookup(runJson: VideoRunJson): Map<string, number> {
  const lookup = new Map<string, number>();
  const estimatedSteps = runJson.metadata.cost?.estimated?.steps ?? [];
  const actualSteps = runJson.metadata.cost?.actual?.steps ?? [];
  for (const step of estimatedSteps) {
    if (step.provider && step.model && step.cost !== undefined) {
      lookup.set(makeProviderKey(step.provider, step.model), Number(step.cost));
    }
  }
  for (const step of actualSteps) {
    if (step.provider && step.model && step.cost !== undefined) {
      lookup.set(makeProviderKey(step.provider, step.model), Number(step.cost));
    }
  }
  return lookup;
}

export function buildTimingLookup(runJson: VideoRunJson): Map<string, number> {
  const lookup = new Map<string, number>();
  const estimatedSteps = runJson.metadata.timing?.estimated?.steps ?? [];
  const actualSteps = runJson.metadata.timing?.actual?.steps ?? [];
  for (const step of estimatedSteps) {
    if (step.provider && step.model && step.processingTimeMs !== undefined) {
      lookup.set(makeProviderKey(step.provider, step.model), Number(step.processingTimeMs));
    }
  }
  for (const step of actualSteps) {
    if (step.provider && step.model && step.processingTimeMs !== undefined) {
      lookup.set(makeProviderKey(step.provider, step.model), Number(step.processingTimeMs));
    }
  }
  return lookup;
}

export function entryProcessingTime(entry: Pick<VideoEntryMetadata, "processingTime">): number | null {
  return typeof entry.processingTime === "number" ? entry.processingTime : null;
}

export function nullableNumber(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeLowerIsBetter(value: number | null, availableValues: number[]): number {
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

export function formatDurationSeconds(seconds: number | null): string {
  if (seconds === null) {
    return "n/a";
  }
  return `${seconds.toFixed(2)}s`;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null) {
    return "n/a";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
