#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  type ProviderEvidence,
  buildCostLookup,
  buildTimingLookup,
  computeSpeakingRate,
  discoverAudioFiles,
  loadTtsRunJson,
  makeProviderKey,
  probeAudio,
  tokenize,
} from "./tts_eval_lib.ts";

interface ParsedArgs {
  runDir: string;
  inputTextPath: string;
  outPath: string | null;
  skipFfprobe: boolean;
}

function helpText(): string {
  return [
    "Usage: bun build_evaluation_packet.ts <run_dir> --input-text <path> [--out <path>] [--skip-ffprobe]",
    "",
    "Build an evaluation evidence packet from a multi-provider AutoShow TTS run.",
    "",
    "Options:",
    "  --input-text <path>  Path to the original input text file",
    "  --out <path>         Write JSON packet to <path> instead of stdout",
    "  --skip-ffprobe       Skip audio probing (use metadata only)",
    "  --help, -h           Show this help message",
    "",
    "Examples:",
    "  bun build_evaluation_packet.ts ./runs/my-tts-run --input-text ./input.txt",
    '  bun build_evaluation_packet.ts ./runs/my-tts-run --input-text ./input.txt --out /tmp/packet.json',
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    process.exit(0);
  }

  const positional: string[] = [];
  let inputTextPath: string | null = null;
  let outPath: string | null = null;
  let skipFfprobe = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input-text") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --input-text");
      }
      inputTextPath = value;
      index += 1;
      continue;
    }
    if (arg === "--out") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --out");
      }
      outPath = value;
      index += 1;
      continue;
    }
    if (arg === "--skip-ffprobe") {
      skipFfprobe = true;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    positional.push(arg);
  }

  const runDir = positional[0];
  if (!runDir) {
    throw new Error("Usage: bun build_evaluation_packet.ts <run_dir> --input-text <path> [--out <path>] [--skip-ffprobe]");
  }
  if (!inputTextPath) {
    throw new Error("--input-text is required");
  }

  return {
    runDir: resolve(runDir),
    inputTextPath: resolve(inputTextPath),
    outPath: outPath ? resolve(outPath) : null,
    skipFfprobe,
  };
}

export async function buildPacket(runDir: string, inputTextPath: string, skipFfprobe: boolean) {
  const runJson = loadTtsRunJson(runDir);
  const inputText = readFileSync(inputTextPath, "utf8").trim();
  const charCount = inputText.length;
  const wordCount = tokenize(inputText).length;
  const warnings: string[] = [];

  const { found, missing } = discoverAudioFiles(runDir, runJson.metadata.tts);
  if (missing.length > 0) {
    warnings.push(`Missing audio files: ${missing.join(", ")}`);
  }

  const costLookup = buildCostLookup(runJson);
  const timingLookup = buildTimingLookup(runJson);

  const providers: ProviderEvidence[] = [];
  for (const entry of runJson.metadata.tts) {
    const providerKey = makeProviderKey(entry.ttsService, entry.ttsModel);
    const audioPath = found.get(providerKey);
    const audioExists = audioPath !== undefined;

    let audioProperties = null;
    if (audioExists && !skipFfprobe) {
      try {
        audioProperties = await probeAudio(audioPath);
      } catch (error) {
        warnings.push(`ffprobe failed for ${entry.audioFileName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const durationSeconds = audioProperties?.durationSeconds ?? 0;
    const speakingRate = computeSpeakingRate(charCount, durationSeconds);
    const costCents = costLookup.get(providerKey) ?? null;
    const processingTimeMs = timingLookup.get(providerKey) ?? entry.processingTime;

    providers.push({
      providerKey,
      ttsService: entry.ttsService,
      ttsModel: entry.ttsModel,
      speaker: entry.speaker ?? null,
      audioFileName: entry.audioFileName,
      audioFileSize: entry.audioFileSize,
      audioPath: audioPath ?? "",
      audioExists,
      audioProperties,
      chunkCount: entry.chunkCount,
      processingTimeMs,
      costCents,
      speakingRateCharsPerSec: speakingRate,
      charCount,
      wordCount,
    });
  }

  return {
    runDir,
    inputTextPath,
    inputTextCharCount: charCount,
    inputTextWordCount: wordCount,
    providerCount: providers.length,
    providers,
    warnings,
  };
}

async function main(): Promise<number> {
  const { runDir, inputTextPath, outPath, skipFfprobe } = parseArgs(process.argv.slice(2));
  const packet = await buildPacket(runDir, inputTextPath, skipFfprobe);

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
