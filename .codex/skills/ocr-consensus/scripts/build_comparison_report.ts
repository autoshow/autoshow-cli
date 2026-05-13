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
  overallRank: number;
  overallScore: number;
  overallComponents: OverallComponents;
  overallTier: TierNumber;
}

interface OverallComponents {
  accuracy: {
    score: number;
    source: "wer";
  };
  processingSpeed: {
    score: number;
    source: "processing-time" | "missing-timing";
    processingTimeMs: number | null;
  };
  costEfficiency: {
    score: number;
    source: "local-zero-cost" | "reported-cost" | "missing-cloud-cost";
    costCents: number | null;
  };
}

const OVERALL_WEIGHTS = {
  accuracy: 0.5,
  processingSpeed: 0.25,
  costEfficiency: 0.25,
} as const;

const TIER_METRIC = "balanced-overall";
const TIER_REMAINDER_POLICY = "bottom-tier-extra";
const TIER_METHOD = "equal-thirds-by-overall-rank";
const TIER_DESCRIPTIONS = {
  1: "Best balanced options across accuracy, processing speed, and cost efficiency.",
  2: "Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.",
  3: "Lowest balanced options, generally weaker across the combined benchmark categories.",
} as const;

type TierNumber = 1 | 2 | 3;

interface TierCounts {
  tier1: number;
  tier2: number;
  tier3: number;
}

interface TierSplit {
  method: typeof TIER_METHOD;
  remainderPolicy: typeof TIER_REMAINDER_POLICY;
  counts: TierCounts;
}

interface TierRankRange {
  start: number | null;
  end: number | null;
}

interface TierBreakdownProvider {
  provider: string;
  providerKey: string;
  overallRank: number;
  overallScore: number;
  overallComponents: OverallComponents;
}

interface TierBreakdown {
  tier: TierNumber;
  label: string;
  description: string;
  rankRange: TierRankRange;
  count: number;
  providers: Array<TierBreakdownProvider & { overallTier: TierNumber }>;
}

type RankedProviderWithoutTier = Omit<RankedProvider, "overallTier">;
type ProviderData = Omit<RankedProvider, "rank" | "overallRank" | "overallScore" | "overallComponents" | "overallTier">;
type OverallScoredProvider = ProviderData & Pick<RankedProvider, "overallRank" | "overallScore" | "overallComponents">;

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

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeLowerIsBetter(value: number | null, availableValues: number[]): number {
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

function addOverallScores(providers: ProviderData[]): OverallScoredProvider[] {
  const timingValues = providers.map((provider) => provider.processingTimeMs).filter(isFiniteNumber);
  const costValues = providers
    .map((provider) => provider.group === "local" ? 0 : provider.costCents)
    .filter(isFiniteNumber);

  const withComponents = providers.map((provider) => {
    const costCents = provider.group === "local" ? 0 : provider.costCents;
    const costSource = provider.group === "local"
      ? "local-zero-cost"
      : provider.costCents === null
        ? "missing-cloud-cost"
        : "reported-cost";
    const processingSpeedScore = normalizeLowerIsBetter(provider.processingTimeMs, timingValues);
    const costEfficiencyScore = normalizeLowerIsBetter(costCents, costValues);
    const overallComponents: OverallComponents = {
      accuracy: {
        score: provider.score,
        source: "wer",
      },
      processingSpeed: {
        score: processingSpeedScore,
        source: provider.processingTimeMs === null ? "missing-timing" : "processing-time",
        processingTimeMs: provider.processingTimeMs,
      },
      costEfficiency: {
        score: costEfficiencyScore,
        source: costSource,
        costCents,
      },
    };
    const overallScore =
      overallComponents.accuracy.score * OVERALL_WEIGHTS.accuracy +
      overallComponents.processingSpeed.score * OVERALL_WEIGHTS.processingSpeed +
      overallComponents.costEfficiency.score * OVERALL_WEIGHTS.costEfficiency;
    return {
      ...provider,
      overallScore,
      overallComponents,
    };
  });

  const overallRanks = new Map<string, number>();
  [...withComponents]
    .sort((left, right) => {
      if (left.overallScore !== right.overallScore) {
        return right.overallScore - left.overallScore;
      }
      if (left.overallComponents.accuracy.score !== right.overallComponents.accuracy.score) {
        return right.overallComponents.accuracy.score - left.overallComponents.accuracy.score;
      }
      if (left.overallComponents.processingSpeed.score !== right.overallComponents.processingSpeed.score) {
        return right.overallComponents.processingSpeed.score - left.overallComponents.processingSpeed.score;
      }
      if (left.overallComponents.costEfficiency.score !== right.overallComponents.costEfficiency.score) {
        return right.overallComponents.costEfficiency.score - left.overallComponents.costEfficiency.score;
      }
      return left.providerKey.localeCompare(right.providerKey);
    })
    .forEach((provider, index) => {
      overallRanks.set(provider.providerKey, index + 1);
    });

  return withComponents.map((provider) => ({
    ...provider,
    overallRank: overallRanks.get(provider.providerKey) ?? 0,
  }));
}

function tierCountsForProviderCount(count: number): TierCounts {
  if (count <= 0) {
    return { tier1: 0, tier2: 0, tier3: 0 };
  }
  if (count === 1) {
    return { tier1: 1, tier2: 0, tier3: 0 };
  }
  if (count === 2) {
    return { tier1: 1, tier2: 1, tier3: 0 };
  }
  const base = Math.floor(count / 3);
  return {
    tier1: base,
    tier2: base,
    tier3: count - base * 2,
  };
}

function tierCountForNumber(counts: TierCounts, tier: TierNumber): number {
  if (tier === 1) {
    return counts.tier1;
  }
  if (tier === 2) {
    return counts.tier2;
  }
  return counts.tier3;
}

function buildTierBreakdown<T extends TierBreakdownProvider>(rankedOverall: T[]): {
  tierSplit: TierSplit;
  tiers: TierBreakdown[];
  providerTiers: Map<string, TierNumber>;
} {
  const counts = tierCountsForProviderCount(rankedOverall.length);
  const tierSplit: TierSplit = {
    method: TIER_METHOD,
    remainderPolicy: TIER_REMAINDER_POLICY,
    counts,
  };
  const providerTiers = new Map<string, TierNumber>();
  const tiers: TierBreakdown[] = [];
  let nextRank = 1;

  for (const tier of [1, 2, 3] as const) {
    const count = tierCountForNumber(counts, tier);
    const start = count > 0 ? nextRank : null;
    const end = count > 0 ? nextRank + count - 1 : null;
    const providers = rankedOverall
      .slice(nextRank - 1, nextRank - 1 + count)
      .map((provider) => {
        providerTiers.set(provider.providerKey, tier);
        return {
          provider: provider.provider,
          providerKey: provider.providerKey,
          overallRank: provider.overallRank,
          overallScore: provider.overallScore,
          overallComponents: provider.overallComponents,
          overallTier: tier,
        };
      });

    tiers.push({
      tier,
      label: `Tier ${tier}`,
      description: TIER_DESCRIPTIONS[tier],
      rankRange: { start, end },
      count,
      providers,
    });
    nextRank += count;
  }

  return { tierSplit, tiers, providerTiers };
}

function addOverallTiers(
  rankedProviders: RankedProviderWithoutTier[],
  providerTiers: Map<string, TierNumber>,
): RankedProvider[] {
  return rankedProviders.map((provider) => ({
    ...provider,
    overallTier: providerTiers.get(provider.providerKey) ?? 3,
  }));
}

function formatRankRange(range: TierRankRange): string {
  if (range.start === null || range.end === null) {
    return "no overall ranks";
  }
  if (range.start === range.end) {
    return `overall rank ${range.start}`;
  }
  return `overall ranks ${range.start}-${range.end}`;
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

  const providerData: ProviderData[] = [];

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

  const providerDataWithOverall = addOverallScores(providerData);
  const localData = providerDataWithOverall.filter((p) => p.group === "local");
  const cloudData = providerDataWithOverall.filter((p) => p.group === "cloud");

  function rankGroup(group: OverallScoredProvider[], groupLabel: ProviderGroup): RankedProviderWithoutTier[] {
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

  const rankedLocalWithoutTiers = rankGroup(localData, "local");
  const rankedCloudWithoutTiers = rankGroup(cloudData, "cloud");
  const rankedOverallWithoutTiers = [...rankedLocalWithoutTiers, ...rankedCloudWithoutTiers].sort((left, right) => {
    if (left.overallRank !== right.overallRank) {
      return left.overallRank - right.overallRank;
    }
    return left.providerKey.localeCompare(right.providerKey);
  });
  const { tierSplit, tiers, providerTiers } = buildTierBreakdown(rankedOverallWithoutTiers);
  const rankedLocal = addOverallTiers(rankedLocalWithoutTiers, providerTiers);
  const rankedCloud = addOverallTiers(rankedCloudWithoutTiers, providerTiers);
  const rankedOverall = addOverallTiers(rankedOverallWithoutTiers, providerTiers);

  const notes: string[] = [];

  const bestOverall = rankedOverall[0];
  const worstOverall = rankedOverall.at(-1);
  if (bestOverall) {
    notes.push(
      `Best overall provider: \`${bestOverall.providerKey}\` scored ${bestOverall.overallScore.toFixed(2)}/100 using balanced overall weighting.`,
    );
  }
  if (worstOverall) {
    notes.push(
      `Worst overall provider: \`${worstOverall.providerKey}\` scored ${worstOverall.overallScore.toFixed(2)}/100 using balanced overall weighting.`,
    );
  }

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
    overallMetric: "balanced-overall",
    overallWeights: OVERALL_WEIGHTS,
    tierMetric: TIER_METRIC,
    tierSplit,
    tiers,
    overall: { count: rankedOverall.length, providers: rankedOverall },
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

  function buildOverallRankingTable(rankedProviders: RankedProvider[]): string {
    const headerCols = ["Rank", "Provider", "Group", "Overall / 100", "Accuracy", "Speed", "Cost"];
    const headerRow = `| ${headerCols.join(" | ")} |`;
    const separatorRow = `| ${headerCols.map(() => "---:").join(" | ")} |`;
    const rows = rankedProviders
      .map((p) => {
        const cols = [
          String(p.overallRank),
          `\`${p.providerKey}\``,
          p.group,
          p.overallScore.toFixed(2),
          p.overallComponents.accuracy.score.toFixed(2),
          p.overallComponents.processingSpeed.score.toFixed(2),
          p.overallComponents.costEfficiency.score.toFixed(2),
        ];
        return `| ${cols.join(" | ")} |`;
      })
      .join("\n");
    return `${headerRow}\n${separatorRow}\n${rows}`;
  }

  function buildTierBreakdownBlock(tierBreakdowns: TierBreakdown[]): string {
    return [
      "Tiers split the balanced overall ranking into equal thirds. When the provider count is not divisible by three, the remainder is assigned to Tier 3.",
      "",
      ...tierBreakdowns.flatMap((tier) => {
        const providerRows = tier.providers
          .map(
            (provider) =>
              `| ${provider.overallRank} | \`${provider.providerKey}\` | ${provider.overallScore.toFixed(2)} | ${provider.overallComponents.accuracy.score.toFixed(2)} | ${provider.overallComponents.processingSpeed.score.toFixed(2)} | ${provider.overallComponents.costEfficiency.score.toFixed(2)} |`,
          )
          .join("\n");
        return [
          `### ${tier.label} (${formatRankRange(tier.rankRange)})`,
          "",
          tier.description,
          "",
          "| Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |",
          "| ---: | --- | ---: | ---: | ---: | ---: |",
          providerRows || "| n/a | n/a | n/a | n/a | n/a | n/a |",
          "",
        ];
      }),
    ].join("\n");
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
- Overall metric: balanced-overall (50% accuracy, 25% processing speed, 25% cost efficiency)
- WER formula: \`(Substitutions + Deletions + Insertions) / Reference Word Count\`

## Method

- The consolidated extraction in \`${consensusFileName}\` was treated as the gold reference.
- Text normalization applied before comparison: lowercasing, curly quote/dash normalization, contraction expansion (it's -> it is), abbreviation expansion (mr. -> mister), currency symbol conversion ($50 -> 50 dollars), and remaining punctuation stripping.
- WER compares the provider's full word stream against the gold extraction word stream.
- CER compares normalized character sequences for finer-grained accuracy.
- Providers are separated into local models and cloud services for independent comparison.
- Overall ranking combines all providers using accuracy score, normalized processing speed, and normalized cost efficiency. Missing timing or missing cloud cost receives a neutral 50/100 component score.
- Tier breakdown splits the balanced overall ranking into equal thirds.

## Overall Ranking

${buildOverallRankingTable(rankedOverall)}

## Tier Breakdown

${buildTierBreakdownBlock(tiers)}

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
