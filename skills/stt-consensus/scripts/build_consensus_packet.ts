#!/usr/bin/env bun

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  chooseBaselineProvider,
  dominantOverlapSpeaker,
  durationSecondsFromRun,
  formatCents,
  formatProcessingSeconds,
  loadProviderRuns,
  loadRunJson,
  mergeOverlapText,
  overlappingProviderSegments,
} from "./transcript_lib.ts";

interface ParsedArgs {
  runDir: string;
  outPath: string | null;
}

function helpText(): string {
  return [
    "Usage: bun build_consensus_packet.ts <run_dir> [--out <path>]",
    "",
    "Build a consensus evidence packet from a multi-provider AutoShow STT run.",
    "",
    "Options:",
    "  --out <path>  Write JSON packet to <path> instead of stdout",
    "  --help, -h    Show this help message",
    "",
    "Examples:",
    "  bun build_consensus_packet.ts ./runs/my-episode",
    '  bun build_consensus_packet.ts ./runs/my-episode --out /tmp/packet.json',
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
    throw new Error("Usage: bun build_consensus_packet.ts <run_dir> [--out <path>]");
  }

  return { runDir: resolve(runDir), outPath: outPath ? resolve(outPath) : null };
}

export function buildPacket(runDir: string) {
  const runJson = loadRunJson(runDir);
  const runDurationSeconds = durationSecondsFromRun(runJson);
  const { providers, warnings } = loadProviderRuns(runDir);
  if (providers.length === 0) {
    throw new Error(`No providers/*/result.json files found under ${runDir}`);
  }

  const { baseline, agreement } = chooseBaselineProvider(providers);

  const providerStats = [...providers]
    .sort((left, right) => left.directoryName.localeCompare(right.directoryName))
    .map((provider) => ({
      provider: provider.directoryName,
      providerKey: provider.providerKey,
      agreementScore: Number((agreement[provider.directoryName] ?? 0).toFixed(6)),
      segmentCount: provider.segments.length,
      speakerCount: new Set(provider.segments.map((segment) => segment.speaker)).size,
      tokenCount: provider.tokenCount,
      processingTimeMs: provider.processingTimeMs,
      processingTime: formatProcessingSeconds(provider.processingTimeMs),
      actualCostCents: provider.actualCostCents,
      actualCost: formatCents(provider.actualCostCents),
      resultPath: provider.resultPath,
      transcriptionPath: provider.transcriptionPath,
    }));

  const segments = baseline.segments.map((baselineSegment, index) => {
    const baselineDuration = Math.max(baselineSegment.end - baselineSegment.start, 1e-9);
    const evidence = providers
      .flatMap((provider) => {
        const overlaps = overlappingProviderSegments(baselineSegment, provider.segments);
        if (overlaps.length === 0) {
          return [];
        }
        const totalOverlap = overlaps.reduce((sum, [, seconds]) => sum + seconds, 0);
        return [
          {
            provider: provider.directoryName,
            providerKey: provider.providerKey,
            speaker: dominantOverlapSpeaker(overlaps),
            text: mergeOverlapText(overlaps),
            overlapSeconds: Number(totalOverlap.toFixed(3)),
            overlapRatio: Number(Math.min(1, totalOverlap / baselineDuration).toFixed(6)),
            segmentCount: overlaps.length,
          },
        ];
      })
      .sort((left, right) => {
        if ((left.provider === baseline.directoryName) !== (right.provider === baseline.directoryName)) {
          return left.provider === baseline.directoryName ? -1 : 1;
        }
        if (left.overlapRatio !== right.overlapRatio) {
          return right.overlapRatio - left.overlapRatio;
        }
        return left.provider.localeCompare(right.provider);
      });

    return {
      index: index + 1,
      start: baselineSegment.rawStart,
      end: baselineSegment.rawEnd,
      baselineSpeaker: baselineSegment.speaker,
      baselineText: baselineSegment.text,
      evidence,
    };
  });

  return {
    runDir,
    runDurationSeconds,
    baselineSelection: {
      provider: baseline.directoryName,
      providerKey: baseline.providerKey,
      method: "highest mean pairwise overlap-aligned transcript similarity across discovered providers",
    },
    providerStats,
    segments,
    warnings,
  };
}

function main(): number {
  const { runDir, outPath } = parseArgs(process.argv.slice(2));
  const packet = buildPacket(runDir);

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
  process.exit(main());
}
