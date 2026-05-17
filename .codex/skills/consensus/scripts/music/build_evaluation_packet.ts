#!/usr/bin/env bun

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  type MusicProviderEvidence,
  buildCostLookup,
  buildTimingLookup,
  discoverMusicFiles,
  entryProcessingTime,
  loadMusicRunJson,
  makeProviderKey,
  nullableNumber,
} from "./music_eval_lib.ts";

interface ParsedArgs {
  runDir: string;
  outPath: string | null;
}

function helpText(): string {
  return [
    "Usage: bun build_evaluation_packet.ts <run_dir> [--out <path>]",
    "",
    "Build an evaluation evidence packet from one multi-provider AutoShow music run.",
    "",
    "Options:",
    "  --out <path>  Write JSON packet to <path> instead of stdout",
    "  --help, -h    Show this help message",
    "",
    "Examples:",
    "  bun build_evaluation_packet.ts ./runs/my-music-run",
    "  bun build_evaluation_packet.ts ./runs/my-music-run --out /tmp/packet.json",
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
  const runJson = loadMusicRunJson(runDir);
  const warnings: string[] = [];

  const { found, missing } = discoverMusicFiles(runDir, runJson.metadata.music);
  if (missing.length > 0) {
    warnings.push(`Missing music files: ${missing.join(", ")}`);
  }

  const costLookup = buildCostLookup(runJson);
  const timingLookup = buildTimingLookup(runJson);

  const providers: MusicProviderEvidence[] = [];
  for (const entry of runJson.metadata.music) {
    const providerKey = makeProviderKey(entry.musicService, entry.musicModel);
    const musicPath = found.get(providerKey) ?? "";
    const musicExists = musicPath.length > 0;
    const artifactFileSize = musicExists ? Bun.file(musicPath).size : null;
    const costCents = costLookup.get(providerKey) ?? null;
    const processingTimeMs = timingLookup.get(providerKey) ?? entryProcessingTime(entry);

    providers.push({
      providerKey,
      musicService: entry.musicService,
      musicModel: entry.musicModel,
      musicFileName: entry.musicFileName,
      musicPath,
      musicExists,
      artifactFileSize,
      metadataFileSize: nullableNumber(entry.musicFileSize),
      musicDurationMs: nullableNumber(entry.musicDurationMs),
      lyricsSource: entry.lyricsSource ?? null,
      audioMimeType: entry.audioMimeType ?? null,
      audioSampleRate: nullableNumber(entry.audioSampleRate),
      audioChannelCount: nullableNumber(entry.audioChannelCount),
      audioBitrate: nullableNumber(entry.audioBitrate),
      outputFormat: entry.outputFormat ?? null,
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
