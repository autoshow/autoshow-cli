#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImageProperties {
  width: number;
  height: number;
  format: string;
  fileSize: number;
  megapixels: number;
  bytesPerPixel: number;
}

export interface ImageEntryMetadata {
  imageService: string;
  imageModel: string;
  processingTime: number;
  imageFileNames: string[];
  imageCount: number;
  imageFileSize: number;
  imageWidth: number | undefined;
  imageHeight: number | undefined;
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

export interface ImageRunJson {
  schemaVersion?: number;
  kind: string;
  metadata: {
    image: ImageEntryMetadata[];
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

export interface ImageProviderEvidence {
  providerKey: string;
  imageService: string;
  imageModel: string;
  imageFileNames: string[];
  imageCount: number;
  totalFileSize: number;
  imagePaths: string[];
  allImagesExist: boolean;
  imageProperties: ImageProperties[];
  processingTimeMs: number;
  costCents: number | null;
}

// ---------------------------------------------------------------------------
// Run JSON helpers
// ---------------------------------------------------------------------------

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function loadImageRunJson(runDir: string): ImageRunJson {
  const runJson = readJson<ImageRunJson>(join(runDir, "run.json"));
  if (runJson.kind !== "image") {
    throw new Error(`run.json kind is "${runJson.kind}", expected "image"`);
  }
  if (!Array.isArray(runJson.metadata?.image) || runJson.metadata.image.length === 0) {
    throw new Error("run.json metadata.image is missing or empty");
  }
  return runJson;
}

export function makeProviderKey(service: string, model: string): string {
  return `${service}/${model}`;
}

// ---------------------------------------------------------------------------
// Image file discovery
// ---------------------------------------------------------------------------

export function discoverImageFiles(
  runDir: string,
  imageEntries: ImageEntryMetadata[],
): { found: Map<string, string[]>; missing: string[] } {
  const found = new Map<string, string[]>();
  const missing: string[] = [];
  for (const entry of imageEntries) {
    const key = makeProviderKey(entry.imageService, entry.imageModel);
    const paths: string[] = [];
    for (const fileName of entry.imageFileNames) {
      const imagePath = join(runDir, fileName);
      if (existsSync(imagePath)) {
        paths.push(imagePath);
      } else {
        missing.push(fileName);
      }
    }
    if (paths.length > 0) {
      found.set(key, paths);
    }
  }
  return { found, missing };
}

// ---------------------------------------------------------------------------
// Image probing (PNG / JPEG header parsing)
// ---------------------------------------------------------------------------

function readPngDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  // PNG signature: 137 80 78 71 13 10 26 10
  if (
    buffer.length < 24 ||
    buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47
  ) {
    return null;
  }
  // IHDR chunk starts at byte 8, width at 16, height at 20 (big-endian 4-byte integers)
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height };
}

function readJpegDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  // JPEG starts with FF D8
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 2;
  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    // SOF markers: C0-C3, C5-C7, C9-CB, CD-CF
    if (
      marker !== undefined &&
      marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    ) {
      if (offset + 9 < buffer.length) {
        const height = view.getUint16(offset + 5, false);
        const width = view.getUint16(offset + 7, false);
        return { width, height };
      }
      return null;
    }
    // Skip to next marker using segment length
    if (offset + 3 < buffer.length) {
      const segmentLength = view.getUint16(offset + 2, false);
      offset += 2 + segmentLength;
    } else {
      break;
    }
  }
  return null;
}

function readWebpDimensions(buffer: Uint8Array): { width: number; height: number } | null {
  // RIFF....WEBP
  if (
    buffer.length < 30 ||
    buffer[0] !== 0x52 || buffer[1] !== 0x49 || buffer[2] !== 0x46 || buffer[3] !== 0x46 ||
    buffer[8] !== 0x57 || buffer[9] !== 0x45 || buffer[10] !== 0x42 || buffer[11] !== 0x50
  ) {
    return null;
  }
  // VP8 lossy: chunk at offset 12, "VP8 " signature
  if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x20) {
    if (buffer.length >= 30) {
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      const width = view.getUint16(26, true) & 0x3fff;
      const height = view.getUint16(28, true) & 0x3fff;
      return { width, height };
    }
  }
  // VP8L lossless: "VP8L"
  if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x4c) {
    if (buffer.length >= 25) {
      const bits = (buffer[21]!) | (buffer[22]! << 8) | (buffer[23]! << 16) | (buffer[24]! << 24);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      return { width, height };
    }
  }
  return null;
}

function detectFormat(buffer: Uint8Array): string {
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "jpeg";
  }
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return "webp";
  }
  return "unknown";
}

export async function probeImage(imagePath: string): Promise<ImageProperties> {
  const file = Bun.file(imagePath);
  const fileSize = file.size;
  const headerBytes = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const format = detectFormat(headerBytes);

  let dimensions: { width: number; height: number } | null = null;
  if (format === "png") {
    dimensions = readPngDimensions(headerBytes);
  } else if (format === "jpeg") {
    dimensions = readJpegDimensions(headerBytes);
  } else if (format === "webp") {
    dimensions = readWebpDimensions(headerBytes);
  }

  const width = dimensions?.width ?? 0;
  const height = dimensions?.height ?? 0;
  const megapixels = (width * height) / 1_000_000;
  const bytesPerPixel = width > 0 && height > 0 ? fileSize / (width * height) : 0;

  return { width, height, format, fileSize, megapixels, bytesPerPixel };
}

// ---------------------------------------------------------------------------
// Cost and timing lookups
// ---------------------------------------------------------------------------

export function buildCostLookup(runJson: ImageRunJson): Map<string, number> {
  const lookup = new Map<string, number>();
  const steps = runJson.metadata.cost?.actual?.steps ?? runJson.metadata.cost?.estimated?.steps ?? [];
  for (const step of steps) {
    if (step.provider && step.model && step.cost !== undefined) {
      lookup.set(makeProviderKey(step.provider, step.model), Number(step.cost));
    }
  }
  return lookup;
}

export function buildTimingLookup(runJson: ImageRunJson): Map<string, number> {
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

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDimensions(width: number, height: number): string {
  if (width === 0 || height === 0) {
    return "unknown";
  }
  return `${width}x${height}`;
}
