#!/usr/bin/env bun

import { writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import {
  characterErrorRate,
  characterErrorRateDetailed,
  formatCents,
  formatProcessingSeconds,
  isLocalOcrService,
  loadOcrProviderRuns,
  parseConsensusExtraction,
  tokenize,
  wordErrorRate,
  wordErrorRateDetailed,
} from "./ocr_consensus_lib.ts";

interface ParsedArgs {
  runDir: string;
  consensusPath: string | null;
  markdownOut: string | null;
  jsonOut: string | null;
}

type ProviderGroup = "local" | "cloud";

interface WerBreakdownData {
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceCount: number;
}

interface RankedProvider {
  rank: number;
  group: ProviderGroup;
  providerKey: string;
  provider: string;
  model: string;
  score: number;
  wer: number;
  cer: number;
  werBreakdown: WerBreakdownData;
  cerBreakdown: WerBreakdownData;
  tokenEstimate: number | null;
  processingTimeMs: number | null;
  costCents: number | null;
}

function helpText(): string {
  return [
    "Usage: bun build_comparison_report.ts <run_dir> [--consensus <path>] [--markdown-out <path>] [--json-out <path>]",
    "",
    "Generate OCR provider comparison reports from a consensus extraction.",
    "",
    "Options:",
    "  --consensus <path>       Path to consensus extraction (default: <run_dir>/consensus-extraction.txt)",
    "  --markdown-out <path>    Write markdown report to <path> (default: <run_dir>/provider-comparison-report.md)",
    "  --json-out <path>        Write JSON report to <path> (default: <run_dir>/provider-comparison-report.json)",
    "  --help, -h               Show this help message",
    "",
    "Examples:",
    "  bun build_comparison_report.ts ./runs/my-document",
    "  bun build_comparison_report.ts ./runs/my-document --consensus ./gold.txt",
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    process.exit(0);
  }

  const positional: string[] = [];
  let consensusPath: string | null = null;
  let markdownOut: string | null = null;
  let jsonOut: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--consensus") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --consensus");
      }
      consensusPath = resolve(value);
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
      "Usage: bun build_comparison_report.ts <run_dir> [--consensus <path>] [--markdown-out <path>] [--json-out <path>]",
    );
  }

  return {
    runDir: resolve(runDir),
    consensusPath,
    markdownOut,
    jsonOut,
  };
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function joinProviderNames(providers: Array<{ providerKey: string }>): string {
  const names = providers.map((p) => `\`${p.providerKey}\``);
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

export function buildReport(runDir: string, consensusPath: string) {
  const consensus = parseConsensusExtraction(consensusPath);
  const consensusFullText = consensus.pages.map((p) => p.text).join("\n\n");
  const charCount = consensusFullText.length;
  const wordCount = tokenize(consensusFullText).length;
  const warnings: string[] = [];

  const { providers, warnings: loadWarnings } = loadOcrProviderRuns(runDir);
  warnings.push(...loadWarnings);

  if (providers.length === 0) {
    throw new Error(`No providers found in ${runDir}`);
  }

  const providerData: Array<Omit<RankedProvider, "rank">> = [];

  for (const provider of providers) {
    const providerFullText = provider.text;
    const werDetailed = wordErrorRateDetailed(consensusFullText, providerFullText);
    const cerDetailed = characterErrorRateDetailed(consensusFullText, providerFullText);
    const score = Math.max(0, 100 * (1 - werDetailed.wer));

    providerData.push({
      providerKey: provider.providerKey,
      provider: provider.provider,
      model: provider.model,
      group: isLocalOcrService(provider.provider) ? "local" : "cloud",
      score,
      wer: werDetailed.wer,
      cer: cerDetailed.wer,
      werBreakdown: {
        substitutions: werDetailed.substitutions,
        deletions: werDetailed.deletions,
        insertions: werDetailed.insertions,
        referenceCount: werDetailed.referenceCount,
      },
      cerBreakdown: {
        substitutions: cerDetailed.substitutions,
        deletions: cerDetailed.deletions,
        insertions: cerDetailed.insertions,
        referenceCount: cerDetailed.referenceCount,
      },
      tokenEstimate: provider.tokenEstimate,
      processingTimeMs: provider.processingTimeMs,
      costCents: provider.actualCostCents,
    });
  }

  const localData = providerData.filter((p) => p.group === "local");
  const cloudData = providerData.filter((p) => p.group === "cloud");

  function rankGroup(group: Array<Omit<RankedProvider, "rank">>, groupLabel: ProviderGroup): RankedProvider[] {
    return [...group]
      .sort((left, right) => {
        if (left.wer !== right.wer) {
          return left.wer - right.wer;
        }
        if (left.cer !== right.cer) {
          return left.cer - right.cer;
        }
        return left.providerKey.localeCompare(right.providerKey);
      })
      .map((provider, index) => ({ ...provider, group: groupLabel, rank: index + 1 }));
  }

  const rankedLocal = rankGroup(localData, "local");
  const rankedCloud = rankGroup(cloudData, "cloud");

  const notes: string[] = [];

  if (rankedLocal.length > 0 && rankedLocal[0]) {
    notes.push(
      `Best local model: \`${rankedLocal[0].providerKey}\` scored ${rankedLocal[0].score.toFixed(2)}/100.`,
    );
  }
  if (rankedCloud.length > 0 && rankedCloud[0]) {
    notes.push(
      `Best cloud service: \`${rankedCloud[0].providerKey}\` scored ${rankedCloud[0].score.toFixed(2)}/100.`,
    );
  }

  const cloudWithCost = rankedCloud.filter((p) => p.costCents !== null);
  if (cloudWithCost.length > 0) {
    const cheapestCost = Math.min(...cloudWithCost.map((p) => p.costCents as number));
    const cheapestProviders = cloudWithCost.filter((p) => p.costCents === cheapestCost);
    const subject = cheapestProviders.length === 1 ? "provider was" : "providers were";
    notes.push(
      `The cheapest cloud ${subject} ${joinProviderNames(cheapestProviders)} at ${formatCents(cheapestCost)}.`,
    );
  }

  const allWithTime = [...rankedLocal, ...rankedCloud].filter((p) => p.processingTimeMs !== null);
  if (allWithTime.length > 0) {
    const fastestLocal = rankedLocal.length > 0
      ? [...rankedLocal].sort((a, b) => (a.processingTimeMs ?? Infinity) - (b.processingTimeMs ?? Infinity))[0]
      : null;
    const fastestCloud = rankedCloud.length > 0
      ? [...rankedCloud].sort((a, b) => (a.processingTimeMs ?? Infinity) - (b.processingTimeMs ?? Infinity))[0]
      : null;
    if (fastestLocal && fastestLocal.processingTimeMs !== null) {
      notes.push(
        `Fastest local model: \`${fastestLocal.providerKey}\` at ${formatProcessingSeconds(fastestLocal.processingTimeMs)}.`,
      );
    }
    if (fastestCloud && fastestCloud.processingTimeMs !== null) {
      notes.push(
        `Fastest cloud service: \`${fastestCloud.providerKey}\` at ${formatProcessingSeconds(fastestCloud.processingTimeMs)}.`,
      );
    }
  }

  const scoreFormula = "max(0, 100 * (1 - WER))";

  const reportJson = {
    runDir,
    consensusExtractionPath: consensusPath,
    consensusCharCount: charCount,
    consensusWordCount: wordCount,
    metric: "wer",
    scoreFormula,
    werFormula: "(Substitutions + Deletions + Insertions) / Reference Word Count",
    normalization: {
      lowercase: true,
      contractionsExpanded: true,
      abbreviationsExpanded: true,
      currencySymbolsExpanded: true,
      punctuationStripped: true,
    },
    local: { count: rankedLocal.length, providers: rankedLocal },
    cloud: { count: rankedCloud.length, providers: rankedCloud },
    notes,
  };

  function buildRankingTable(rankedProviders: RankedProvider[], includeCost: boolean): string {
    const headerCols = ["Rank", "Provider", "Score / 100", "WER", "CER", "Token Est.", "Processing Time"];
    if (includeCost) {
      headerCols.push("Cost");
    }
    const headerRow = `| ${headerCols.join(" | ")} |`;
    const separatorRow = `| ${headerCols.map(() => "---:").join(" | ")} |`;
    const rows = rankedProviders
      .map((p) => {
        const cols = [
          String(p.rank),
          `\`${p.providerKey}\``,
          p.score.toFixed(2),
          percentage(p.wer),
          percentage(p.cer),
          p.tokenEstimate !== null ? String(p.tokenEstimate) : "n/a",
          formatProcessingSeconds(p.processingTimeMs),
        ];
        if (includeCost) {
          cols.push(formatCents(p.costCents));
        }
        return `| ${cols.join(" | ")} |`;
      })
      .join("\n");
    return `${headerRow}\n${separatorRow}\n${rows}`;
  }

  const localList = rankedLocal.map((p) => `  - \`${p.providerKey}\``).join("\n");
  const cloudList = rankedCloud.map((p) => `  - \`${p.providerKey}\``).join("\n");
  const notesBlock = notes.map((note) => `- ${note}`).join("\n");
  const consensusFileName = basename(consensusPath);

  const allRanked = [...rankedLocal, ...rankedCloud];
  const breakdownRows = allRanked
    .map(
      (p) =>
        `| \`${p.providerKey}\` | ${p.werBreakdown.substitutions} | ${p.werBreakdown.deletions} | ${p.werBreakdown.insertions} | ${p.werBreakdown.referenceCount} |`,
    )
    .join("\n");

  const localSection = rankedLocal.length > 0
    ? `### Local Models (${rankedLocal.length})

${localList}

${buildRankingTable(rankedLocal, false)}
`
    : "";

  const cloudSection = rankedCloud.length > 0
    ? `### Cloud Services (${rankedCloud.length})

${cloudList}

${buildRankingTable(rankedCloud, true)}
`
    : "";

  const totalProviders = rankedLocal.length + rankedCloud.length;

  const markdown = `# OCR Provider Comparison Report

## Summary

- Consensus extraction: \`${consensusFileName}\` (${charCount} characters, ${wordCount} words)
- Total providers: ${totalProviders} (${rankedLocal.length} local, ${rankedCloud.length} cloud)
- Ranking metric: word error rate (WER) against consensus extraction
- Score formula: \`${scoreFormula}\`
- WER formula: \`(Substitutions + Deletions + Insertions) / Reference Word Count\`

## Method

- The consolidated extraction in \`${consensusFileName}\` was treated as the gold reference.
- Text normalization applied before comparison: lowercasing, curly quote/dash normalization, contraction expansion (it's -> it is), abbreviation expansion (mr. -> mister), currency symbol conversion ($50 -> 50 dollars), and remaining punctuation stripping.
- WER compares the provider's full word stream against the gold extraction word stream.
- CER compares normalized character sequences for finer-grained accuracy.
- Providers are separated into local models and cloud services for independent comparison.

## Ranking

${localSection}${cloudSection}
## Error Breakdown (WER)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
${breakdownRows}

## Notes

${notesBlock}
`;

  return { reportJson, markdown, warnings };
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const consensusPath = args.consensusPath ?? resolve(args.runDir, "consensus-extraction.txt");
  const markdownOut = args.markdownOut ?? resolve(args.runDir, "provider-comparison-report.md");
  const jsonOut = args.jsonOut ?? resolve(args.runDir, "provider-comparison-report.json");

  const { reportJson, markdown, warnings } = buildReport(args.runDir, consensusPath);

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
