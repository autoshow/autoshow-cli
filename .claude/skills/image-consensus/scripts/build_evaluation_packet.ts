#!/usr/bin/env bun

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  type ImageProviderEvidence,
  buildCostLookup,
  buildTimingLookup,
  discoverImageFiles,
  loadImageRunJson,
  makeProviderKey,
  probeImage,
} from "./image_eval_lib.ts";

interface ParsedArgs {
  runDir: string;
  outPath: string | null;
}

function helpText(): string {
  return [
    "Usage: bun build_evaluation_packet.ts <run_dir> [--out <path>]",
    "",
    "Build an evaluation evidence packet from a multi-provider AutoShow image run.",
    "",
    "Options:",
    "  --out <path>  Write JSON packet to <path> instead of stdout",
    "  --help, -h    Show this help message",
    "",
    "Examples:",
    "  bun build_evaluation_packet.ts ./runs/my-image-run",
    '  bun build_evaluation_packet.ts ./runs/my-image-run --out /tmp/packet.json',
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    process.exit(0);
  }

  const positional: string[] = [];
  let outPath: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --out");
      }
      outPath = value;
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
    throw new Error("Usage: bun build_evaluation_packet.ts <run_dir> [--out <path>]");
  }

  return { runDir: resolve(runDir), outPath: outPath ? resolve(outPath) : null };
}

export async function buildPacket(runDir: string) {
  const runJson = loadImageRunJson(runDir);
  const warnings: string[] = [];

  const { found, missing } = discoverImageFiles(runDir, runJson.metadata.image);
  if (missing.length > 0) {
    warnings.push(`Missing image files: ${missing.join(", ")}`);
  }

  const costLookup = buildCostLookup(runJson);
  const timingLookup = buildTimingLookup(runJson);

  const providers: ImageProviderEvidence[] = [];
  for (const entry of runJson.metadata.image) {
    const providerKey = makeProviderKey(entry.imageService, entry.imageModel);
    const imagePaths = found.get(providerKey) ?? [];
    const allImagesExist = imagePaths.length === entry.imageFileNames.length;

    const imageProperties = [];
    for (const imagePath of imagePaths) {
      try {
        const props = await probeImage(imagePath);
        imageProperties.push(props);
      } catch (error) {
        warnings.push(`Image probe failed for ${imagePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const totalFileSize = imageProperties.reduce((sum, props) => sum + props.fileSize, 0);
    const costCents = costLookup.get(providerKey) ?? null;
    const processingTimeMs = timingLookup.get(providerKey) ?? entry.processingTime;

    providers.push({
      providerKey,
      imageService: entry.imageService,
      imageModel: entry.imageModel,
      imageFileNames: entry.imageFileNames,
      imageCount: entry.imageCount,
      totalFileSize,
      imagePaths,
      allImagesExist,
      imageProperties,
      processingTimeMs,
      costCents,
    });
  }

  return {
    runDir,
    providerCount: providers.length,
    providers,
    warnings,
  };
}

async function main(): Promise<number> {
  const { runDir, outPath } = parseArgs(process.argv.slice(2));
  const packet = await buildPacket(runDir);

  for (const warning of packet.warnings) {
    console.error(`[warn] ${warning}`);
  }

  const serialized = `${JSON.stringify(packet, null, 2)}\n`;
  if (outPath) {
    writeFileSync(outPath, serialized);
  } else {
    process.stdout.write(serialized);
  }
  return 0;
}

if (import.meta.main) {
  main().then((code) => process.exit(code));
}
