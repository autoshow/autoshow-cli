#!/usr/bin/env bun

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  durationSecondsFromRun,
  formatCents,
  formatProcessingSeconds,
  loadProviderRuns,
  loadRunJson,
  mapProviderSpeakers,
  parseReferenceTranscript,
  wordWer,
} from "./transcript_lib.ts";

interface ParsedArgs {
  runDir: string;
  referencePath: string | null;
  markdownOut: string | null;
  jsonOut: string | null;
}

function helpText(): string {
  return [
    "Usage: bun build_reference_report.ts <run_dir> [--reference <path>] [--markdown-out <path>] [--json-out <path>]",
    "",
    "Generate comparison reports scoring each provider against a consensus transcript.",
    "",
    "Options:",
    "  --reference <path>      Path to consensus transcript (default: <run_dir>/consensus-transcription.txt)",
    "  --markdown-out <path>   Write markdown report to <path> (default: <run_dir>/reference-comparison-report.md)",
    "  --json-out <path>       Write JSON report to <path> (default: <run_dir>/reference-comparison-report.json)",
    "  --help, -h              Show this help message",
    "",
    "Examples:",
    "  bun build_reference_report.ts ./runs/my-episode",
    "  bun build_reference_report.ts ./runs/my-episode --reference /tmp/consensus.txt",
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    process.exit(0);
  }

  const positional: string[] = [];
  let referencePath: string | null = null;
  let markdownOut: string | null = null;
  let jsonOut: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--reference") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --reference");
      }
      referencePath = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--markdown-out") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --markdown-out");
      }
      markdownOut = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--json-out") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --json-out");
      }
      jsonOut = resolve(value);
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
    throw new Error(
      "Usage: bun build_reference_report.ts <run_dir> [--reference <path>] [--markdown-out <path>] [--json-out <path>]",
    );
  }

  return {
    runDir: resolve(runDir),
    referencePath,
    markdownOut,
    jsonOut,
  };
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function joinProviderNames(providers: Array<{ provider: string }>): string {
  const names = providers.map((provider) => `\`${provider.provider}\``);
  if (names.length === 0) {
    return "";
  }
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

export function buildReport(runDir: string, referencePath: string) {
  const runJson = loadRunJson(runDir);
  const runDurationSeconds = durationSecondsFromRun(runJson);
  const referenceSegments = parseReferenceTranscript(referencePath, runDurationSeconds);
  const { providers, warnings } = loadProviderRuns(runDir);
  if (providers.length === 0) {
    throw new Error(`No providers/*/result.json files found under ${runDir}`);
  }

  const rankedProviders = providers
    .map((provider) => {
      const speakerMap = mapProviderSpeakers(referenceSegments, provider.segments);
      const textOnlyWer = wordWer(referenceSegments, provider.segments, false);
      const speakerAwareWer = wordWer(referenceSegments, provider.segments, true, speakerMap);
      return {
        provider: provider.directoryName,
        providerKey: provider.providerKey,
        score: Math.max(0, 100 * (1 - speakerAwareWer)),
        speakerAwareWER: speakerAwareWer,
        textOnlyWER: textOnlyWer,
        actualProcessingTimeMs: provider.processingTimeMs,
        actualCostCents: provider.actualCostCents,
        speakerPenalty: speakerAwareWer - textOnlyWer,
        speakerMap,
      };
    })
    .sort((left, right) => {
      if (left.speakerAwareWER !== right.speakerAwareWER) {
        return left.speakerAwareWER - right.speakerAwareWER;
      }
      if (left.textOnlyWER !== right.textOnlyWER) {
        return left.textOnlyWER - right.textOnlyWER;
      }
      return left.provider.localeCompare(right.provider);
    })
    .map((provider, index) => ({
      ...provider,
      rank: index + 1,
    }));

  const bestProvider = rankedProviders[0];
  if (!bestProvider) {
    throw new Error("Could not rank providers");
  }
  const providersWithCost = rankedProviders.filter((provider) => provider.actualCostCents !== null);
  const providersWithTime = rankedProviders.filter((provider) => provider.actualProcessingTimeMs !== null);
  const largestSpeakerPenalty = [...rankedProviders].sort(
    (left, right) => right.speakerPenalty - left.speakerPenalty,
  )[0];
  if (!largestSpeakerPenalty) {
    throw new Error("Could not compute speaker penalty notes");
  }

  const notes = [
    `\`${bestProvider.provider}\` was the most accurate provider on strict speaker-aware WER, scoring ${bestProvider.score.toFixed(2)}/100.`,
  ];

  if (providersWithCost.length > 0) {
    const cheapestCost = Math.min(...providersWithCost.map((provider) => provider.actualCostCents as number));
    const cheapestProviders = providersWithCost.filter(
      (provider) => provider.actualCostCents === cheapestCost,
    );
    const subject = cheapestProviders.length === 1 ? "provider was" : "providers were";
    notes.push(
      `The cheapest ${subject} ${joinProviderNames(cheapestProviders)} at ${formatCents(cheapestCost)}.`,
    );
  } else {
    notes.push("Actual provider cost data was unavailable in `run.json`.");
  }

  if (providersWithTime.length > 0) {
    const fastestProvider = [...providersWithTime].sort(
      (left, right) => (left.actualProcessingTimeMs as number) - (right.actualProcessingTimeMs as number),
    )[0];
    notes.push(
      `\`${fastestProvider.provider}\` was the fastest provider in this set at ${((fastestProvider.actualProcessingTimeMs as number) / 1000).toFixed(2)}s.`,
    );
  } else {
    notes.push("Actual provider timing data was unavailable in `run.json`.");
  }

  if (largestSpeakerPenalty.speakerPenalty > 0) {
    notes.push(
      `\`${largestSpeakerPenalty.provider}\` lost the most ground once speaker changes were counted, with ${(largestSpeakerPenalty.speakerPenalty * 100).toFixed(2)} percentage-point gap between text-only and speaker-aware WER.`,
    );
  } else {
    notes.push("No provider scored worse once speaker changes were counted.");
  }

  const reportJson = {
    runDir,
    referenceTranscriptPath: referencePath,
    metric: "speaker-aware-wer",
    scoreFormula: "max(0, 100 * (1 - speakerAwareWER))",
    providers: rankedProviders,
    notes,
  };

  const providerList = rankedProviders.map((provider) => `  - \`${provider.provider}\``).join("\n");
  const rankingRows = rankedProviders
    .map(
      (provider) =>
        `| ${provider.rank} | \`${provider.provider}\` | ${provider.score.toFixed(2)} | ${percentage(provider.speakerAwareWER)} | ${percentage(provider.textOnlyWER)} | ${formatProcessingSeconds(provider.actualProcessingTimeMs)} | ${formatCents(provider.actualCostCents)} |`,
    )
    .join("\n");
  const notesBlock = notes.map((note) => `- ${note}`).join("\n");

  const referenceName = referencePath.split("/").at(-1) ?? referencePath;
  const markdown = `# Consensus Transcript Comparison Report

## Summary

- Reference transcript: \`${referenceName}\`
- Compared providers:
${providerList}
- Ranking metric: strict speaker-aware word error rate (WER)
- Score formula: \`max(0, 100 * (1 - speakerAwareWER))\`
- Cost and processing time source: actual per-provider billing and timing data from \`run.json\` when available

## Method

- The consolidated transcript in \`${referenceName}\` was treated as the gold reference.
- Timestamps were used to map provider speaker labels onto canonical gold speakers by segment overlap.
- Gold segment end times were derived from the next gold segment start, with the final segment ending at the run duration from \`run.json\`.
- Provider scoring used \`result.json.result.segments\` for all discovered providers under \`providers/\`; \`transcription.txt\` and any pre-existing comparison reports were ignored.
- Text was normalized before tokenization by lowercasing, normalizing curly quotes/apostrophes, and collapsing whitespace.
- Tokenization used a word/number regex, so punctuation-only tokens were ignored.
- Text-only WER compares the provider's full ordered word stream against the gold transcript word stream.
- Speaker-aware WER compares those same ordered word streams after inserting synthetic speaker-change tokens and mapping provider speaker IDs onto canonical gold speakers by overlap.
- Ranking uses exact unrounded speaker-aware WER, with text-only WER included for context.

## Ranking

| Rank | Provider | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${rankingRows}

## Notes

${notesBlock}
`;

  return { reportJson, markdown, warnings };
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const referencePath = args.referencePath ?? resolve(args.runDir, "consensus-transcription.txt");
  const markdownOut = args.markdownOut ?? resolve(args.runDir, "reference-comparison-report.md");
  const jsonOut = args.jsonOut ?? resolve(args.runDir, "reference-comparison-report.json");

  const { reportJson, markdown, warnings } = buildReport(args.runDir, referencePath);

  for (const warning of warnings) {
    console.error(`[warn] ${warning}`);
  }

  writeFileSync(jsonOut, `${JSON.stringify(reportJson, null, 2)}\n`);
  writeFileSync(markdownOut, markdown);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
