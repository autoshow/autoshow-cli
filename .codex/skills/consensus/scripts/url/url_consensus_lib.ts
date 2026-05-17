#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface UrlProviderRun {
  directoryName: string;
  provider: string;
  model: string;
  providerKey: string;
  resultPath: string;
  extractionPath: string | null;
  text: string;
  plainText: string;
  tokenEstimate: number | null;
  processingTimeMs: number | null;
  actualCostCents: number | null;
  sourceUrl: string | null;
  finalUrl: string | null;
  title: string | null;
}

interface ProviderResultPayload {
  provider?: string;
  model?: string;
  metadata?: {
    tokenEstimate?: number;
    processingTime?: number;
  };
  result?: {
    text?: string;
    pages?: Array<{
      text?: string;
    }>;
  };
}

interface RunStepCostEntry {
  provider?: string;
  model?: string;
  cost?: number;
}

interface RunStepTimingEntry {
  provider?: string;
  model?: string;
  processingTimeMs?: number;
}

interface RunProviderState {
  service?: string;
  model?: string;
  artifactDir?: string;
  status?: string;
}

export interface UrlRunJson {
  schemaVersion?: number;
  kind?: string;
  metadata?: {
    step1?: {
      title?: string;
      slug?: string;
      format?: string;
      fileSize?: number;
    };
    source?: {
      url?: string;
      filePath?: string;
    };
    web?: {
      sourceUrl?: string;
      finalUrl?: string;
      title?: string;
    };
    providerStates?: RunProviderState[];
    cost?: {
      actual?: { steps?: RunStepCostEntry[] };
    };
    timing?: {
      actual?: { steps?: RunStepTimingEntry[] };
    };
  };
}

const LOCAL_PROVIDERS = new Set(["defuddle"]);
const TOKEN_RE = /[a-z0-9]+(?:[''][a-z0-9]+)?/gi;

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function isLocalUrlProvider(provider: string): boolean {
  return LOCAL_PROVIDERS.has(provider);
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/^\s{0,3}\d+[.)]\s+/gm, "")
    .replace(/[*_~>#|]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeText(text: string): string {
  return markdownToPlainText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeText(text).match(TOKEN_RE) ?? [];
}

export interface EditBreakdown {
  distance: number;
  substitutions: number;
  deletions: number;
  insertions: number;
}

export function levenshteinDistance(left: string[], right: string[]): number {
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;
  if (left.length < right.length) return levenshteinDistance(right, left);

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const insertion = current[rightIndex] + 1;
      const deletion = previous[rightIndex + 1] + 1;
      const substitution = previous[rightIndex] + Number(left[leftIndex] !== right[rightIndex]);
      current.push(Math.min(insertion, deletion, substitution));
    }
    previous = current;
  }
  return previous.at(-1) ?? 0;
}

export function levenshteinBreakdown(reference: string[], candidate: string[]): EditBreakdown {
  const n = reference.length;
  const m = candidate.length;
  if (n === 0) return { distance: m, substitutions: 0, deletions: 0, insertions: m };
  if (m === 0) return { distance: n, substitutions: 0, deletions: n, insertions: 0 };
  if (n > 10_000 || m > 10_000) {
    return { distance: levenshteinDistance(reference, candidate), substitutions: -1, deletions: -1, insertions: -1 };
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const ops: Array<Array<"none" | "sub" | "del" | "ins" | "match">> = Array.from(
    { length: n + 1 },
    () => new Array<"none" | "sub" | "del" | "ins" | "match">(m + 1).fill("none"),
  );

  for (let i = 0; i <= n; i += 1) {
    dp[i][0] = i;
    if (i > 0) ops[i][0] = "del";
  }
  for (let j = 0; j <= m; j += 1) {
    dp[0][j] = j;
    if (j > 0) ops[0][j] = "ins";
  }

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const matchCost = reference[i - 1] === candidate[j - 1] ? 0 : 1;
      const candidates = [
        { value: dp[i - 1][j - 1] + matchCost, op: matchCost === 0 ? "match" as const : "sub" as const },
        { value: dp[i - 1][j] + 1, op: "del" as const },
        { value: dp[i][j - 1] + 1, op: "ins" as const },
      ].sort((left, right) => left.value - right.value);
      dp[i][j] = candidates[0]?.value ?? 0;
      ops[i][j] = candidates[0]?.op ?? "none";
    }
  }

  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const op = ops[i]?.[j] ?? "none";
    if (op === "match") {
      i -= 1;
      j -= 1;
    } else if (op === "sub") {
      substitutions += 1;
      i -= 1;
      j -= 1;
    } else if (op === "del") {
      deletions += 1;
      i -= 1;
    } else if (op === "ins") {
      insertions += 1;
      j -= 1;
    } else {
      break;
    }
  }

  return { distance: dp[n]?.[m] ?? 0, substitutions, deletions, insertions };
}

export function wordErrorRateDetailed(referenceText: string, candidateText: string): EditBreakdown & { rate: number; referenceCount: number } {
  const reference = tokenize(referenceText);
  const candidate = tokenize(candidateText);
  const breakdown = levenshteinBreakdown(reference, candidate);
  return {
    ...breakdown,
    referenceCount: reference.length,
    rate: reference.length === 0 ? (candidate.length === 0 ? 0 : 1) : breakdown.distance / reference.length,
  };
}

export function characterErrorRateDetailed(referenceText: string, candidateText: string): EditBreakdown & { rate: number; referenceCount: number } {
  const reference = Array.from(normalizeText(referenceText).replace(/\s+/g, ""));
  const candidate = Array.from(normalizeText(candidateText).replace(/\s+/g, ""));
  const breakdown = levenshteinBreakdown(reference, candidate);
  return {
    ...breakdown,
    referenceCount: reference.length,
    rate: reference.length === 0 ? (candidate.length === 0 ? 0 : 1) : breakdown.distance / reference.length,
  };
}

export function contentTokenCoverage(referenceText: string, candidateText: string): number {
  const referenceTokens = Array.from(new Set(tokenize(referenceText).filter((token) => token.length > 2)));
  if (referenceTokens.length === 0) return 1;
  const candidateTokens = new Set(tokenize(candidateText));
  const hits = referenceTokens.filter((token) => candidateTokens.has(token)).length;
  return hits / referenceTokens.length;
}

export function selectBaselineProvider(runs: UrlProviderRun[]): UrlProviderRun {
  if (runs.length === 0) {
    throw new Error("No provider result.json files found under providers/");
  }
  return runs
    .slice()
    .sort((left, right) => tokenize(right.text).length - tokenize(left.text).length || left.providerKey.localeCompare(right.providerKey))[0] as UrlProviderRun;
}

function getProviderText(payload: ProviderResultPayload): string {
  if (typeof payload.result?.text === "string" && payload.result.text.trim().length > 0) {
    return payload.result.text;
  }
  const pageText = payload.result?.pages
    ?.map((page) => page.text ?? "")
    .filter((text) => text.trim().length > 0)
    .join("\n\n");
  return pageText ?? "";
}

function findRunProviderState(run: UrlRunJson | null, directoryName: string, provider: string, model: string): RunProviderState | null {
  const states = run?.metadata?.providerStates ?? [];
  return states.find((state) =>
    state.artifactDir === `providers/${directoryName}`
    || (state.service === provider && (state.model === undefined || state.model === model))
  ) ?? null;
}

function findActualCost(run: UrlRunJson | null, provider: string, model: string): number | null {
  const step = run?.metadata?.cost?.actual?.steps?.find((entry) => entry.provider === provider && entry.model === model);
  return typeof step?.cost === "number" ? step.cost : null;
}

function findActualTiming(run: UrlRunJson | null, provider: string, model: string): number | null {
  const step = run?.metadata?.timing?.actual?.steps?.find((entry) => entry.provider === provider && entry.model === model);
  return typeof step?.processingTimeMs === "number" ? step.processingTimeMs : null;
}

export function loadUrlProviderRuns(runDir: string): UrlProviderRun[] {
  const providersDir = join(runDir, "providers");
  if (!existsSync(providersDir)) {
    throw new Error(`Provider directory not found: ${providersDir}`);
  }

  const runPath = join(runDir, "run.json");
  const run = existsSync(runPath) ? readJson<UrlRunJson>(runPath) : null;
  const directories = readdirSync(providersDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return directories.flatMap((directoryName) => {
    const resultPath = join(providersDir, directoryName, "result.json");
    if (!existsSync(resultPath)) return [];

    const payload = readJson<ProviderResultPayload>(resultPath);
    const provider = payload.provider ?? directoryName;
    const model = payload.model ?? provider;
    const state = findRunProviderState(run, directoryName, provider, model);
    if (state?.status && state.status !== "succeeded") return [];

    const text = getProviderText(payload).trim();
    const extractionPath = join(providersDir, directoryName, "extraction.txt");
    const sourceUrl = run?.metadata?.web?.sourceUrl ?? run?.metadata?.source?.url ?? null;
    const finalUrl = run?.metadata?.web?.finalUrl ?? null;
    const title = run?.metadata?.web?.title ?? run?.metadata?.step1?.title ?? null;

    return [{
      directoryName,
      provider,
      model,
      providerKey: model === provider ? provider : `${provider}/${model}`,
      resultPath,
      extractionPath: existsSync(extractionPath) ? extractionPath : null,
      text,
      plainText: markdownToPlainText(text),
      tokenEstimate: typeof payload.metadata?.tokenEstimate === "number" ? payload.metadata.tokenEstimate : null,
      processingTimeMs: findActualTiming(run, provider, model)
        ?? (typeof payload.metadata?.processingTime === "number" ? payload.metadata.processingTime : null),
      actualCostCents: findActualCost(run, provider, model),
      sourceUrl,
      finalUrl,
      title,
    }];
  });
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(2)}%`;
}

export function formatCents(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(4)}c`;
}

export function formatSeconds(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${(value / 1000).toFixed(2)}s`;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
