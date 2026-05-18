#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

export interface OcrPage {
  pageNumber: number;
  method: string;
  text: string;
}

export interface OcrProviderRun {
  directoryName: string;
  provider: string;
  model: string;
  providerKey: string;
  resultPath: string;
  extractionPath: string | null;
  pages: OcrPage[];
  text: string;
  tokenEstimate: number | null;
  processingTimeMs: number | null;
  actualCostCents: number | null;
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
  artifactDir?: string;
  status?: string;
}

export interface OcrRunJson {
  schemaVersion?: number;
  kind?: string;
  metadata?: {
    step1?: {
      title?: string;
      slug?: string;
      pageCount?: number;
      format?: string;
      fileSize?: number;
    };
    step2?: Array<{
      extractionMethod?: string;
      totalPages?: number;
      ocrPages?: number;
      textPages?: number;
      processingTime?: number;
      tokenEstimate?: number;
      ocrService?: string;
      ocrModel?: string;
    }>;
    providerStates?: RunProviderState[];
    cost?: {
      estimated?: { steps?: RunStepCostEntry[] };
      actual?: { steps?: RunStepCostEntry[] };
    };
    timing?: {
      estimated?: { steps?: RunStepTimingEntry[] };
      actual?: { steps?: RunStepTimingEntry[] };
    };
  };
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
      pageNumber?: number;
      method?: string;
      text?: string;
    }>;
    totalPages?: number;
  };
}

const TOKEN_RE = /[a-z0-9]+(?:[''][a-z0-9]+)?/gi;
const PUNCT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\u2018/g, "'"],
  [/\u2019/g, "'"],
  [/\u201c/g, '"'],
  [/\u201d/g, '"'],
  [/\u2013/g, "-"],
  [/\u2014/g, "-"],
  [/\u2026/g, "..."],
];

const CONTRACTIONS = new Map<string, string>([
  ["i'm", "i am"],
  ["i've", "i have"],
  ["i'll", "i will"],
  ["i'd", "i would"],
  ["you're", "you are"],
  ["you've", "you have"],
  ["you'll", "you will"],
  ["you'd", "you would"],
  ["he's", "he is"],
  ["she's", "she is"],
  ["it's", "it is"],
  ["we're", "we are"],
  ["we've", "we have"],
  ["we'll", "we will"],
  ["we'd", "we would"],
  ["they're", "they are"],
  ["they've", "they have"],
  ["they'll", "they will"],
  ["they'd", "they would"],
  ["that's", "that is"],
  ["who's", "who is"],
  ["what's", "what is"],
  ["there's", "there is"],
  ["here's", "here is"],
  ["where's", "where is"],
  ["how's", "how is"],
  ["can't", "cannot"],
  ["won't", "will not"],
  ["don't", "do not"],
  ["doesn't", "does not"],
  ["didn't", "did not"],
  ["isn't", "is not"],
  ["aren't", "are not"],
  ["wasn't", "was not"],
  ["weren't", "were not"],
  ["haven't", "have not"],
  ["hasn't", "has not"],
  ["hadn't", "had not"],
  ["couldn't", "could not"],
  ["wouldn't", "would not"],
  ["shouldn't", "should not"],
  ["let's", "let us"],
]);

const ABBREVIATIONS = new Map<string, string>([
  ["mr.", "mister"],
  ["mrs.", "missus"],
  ["ms.", "miss"],
  ["dr.", "doctor"],
  ["prof.", "professor"],
  ["vs.", "versus"],
  ["etc.", "etcetera"],
  ["st.", "saint"],
  ["jr.", "junior"],
  ["sr.", "senior"],
]);

const CURRENCY_PATTERNS: Array<[RegExp, string]> = [
  [/\$(\d[\d,.]*)/g, "$1 dollars"],
  [/(\d[\d,.]*)%/g, "$1 percent"],
  [/[£](\d[\d,.]*)/g, "$1 pounds"],
  [/[€](\d[\d,.]*)/g, "$1 euros"],
  [/#(\d+)/g, "number $1"],
];

const LOCAL_SERVICES = new Set(["tesseract", "ocrmypdf", "paddle-ocr"]);

const PAGE_DELIMITER_RE = /^---\s*Page\s+(\d+)\s*---$/;
const LARGE_EDIT_SEQUENCE_THRESHOLD = 10_000;

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function normalizeText(text: string): string {
  let normalized = text.toLowerCase();
  for (const [pattern, replacement] of PUNCT_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  for (const [abbr, expansion] of ABBREVIATIONS) {
    normalized = normalized.replaceAll(abbr, expansion);
  }
  for (const [pattern, replacement] of CURRENCY_PATTERNS) {
    normalized = normalized.replace(pattern, replacement);
  }
  for (const [contraction, expansion] of CONTRACTIONS) {
    normalized = normalized.replaceAll(contraction, expansion);
  }
  normalized = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ");
  return normalized.trim().replace(/\s+/g, " ");
}

export function tokenize(text: string): string[] {
  return normalizeText(text).match(TOKEN_RE) ?? [];
}

export interface WerBreakdown {
  distance: number;
  substitutions: number;
  deletions: number;
  insertions: number;
}

function gitDiffBreakdown(reference: string[], candidate: string[]): WerBreakdown {
  if (reference.length === 0) {
    return { distance: candidate.length, substitutions: 0, deletions: 0, insertions: candidate.length };
  }
  if (candidate.length === 0) {
    return { distance: reference.length, substitutions: 0, deletions: reference.length, insertions: 0 };
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "ocr-edit-distance-"));
  const referencePath = join(tmpDir, "reference.txt");
  const candidatePath = join(tmpDir, "candidate.txt");

  try {
    writeFileSync(referencePath, `${reference.join("\n")}\n`);
    writeFileSync(candidatePath, `${candidate.join("\n")}\n`);

    const diff = spawnSync(
      "git",
      ["diff", "--no-index", "--no-renames", "--unified=0", "--", referencePath, candidatePath],
      { encoding: "utf8", maxBuffer: 1024 * 1024 * 64 },
    );

    if (diff.status === 0) {
      return { distance: 0, substitutions: 0, deletions: 0, insertions: 0 };
    }
    if (diff.status !== 1) {
      throw new Error((diff.stderr || diff.stdout || "git diff failed").trim());
    }

    let substitutions = 0;
    let deletions = 0;
    let insertions = 0;
    let hunkDeletions = 0;
    let hunkInsertions = 0;

    function flushHunk() {
      substitutions += Math.min(hunkDeletions, hunkInsertions);
      deletions += Math.max(0, hunkDeletions - hunkInsertions);
      insertions += Math.max(0, hunkInsertions - hunkDeletions);
      hunkDeletions = 0;
      hunkInsertions = 0;
    }

    for (const line of diff.stdout.split(/\r?\n/)) {
      if (line.startsWith("@@")) {
        flushHunk();
        continue;
      }
      if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("diff ") || line.startsWith("index ")) {
        continue;
      }
      if (line.startsWith("-")) {
        hunkDeletions += 1;
      } else if (line.startsWith("+")) {
        hunkInsertions += 1;
      }
    }
    flushHunk();

    return {
      distance: substitutions + deletions + insertions,
      substitutions,
      deletions,
      insertions,
    };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function levenshteinDistance(left: string[], right: string[]): number {
  if (left.length === 0) {
    return right.length;
  }
  if (right.length === 0) {
    return left.length;
  }
  if (left.length > LARGE_EDIT_SEQUENCE_THRESHOLD || right.length > LARGE_EDIT_SEQUENCE_THRESHOLD) {
    return gitDiffBreakdown(left, right).distance;
  }
  if (left.length < right.length) {
    return levenshteinDistance(right, left);
  }
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

export function levenshteinBreakdown(reference: string[], candidate: string[]): WerBreakdown {
  const n = reference.length;
  const m = candidate.length;

  if (n === 0) {
    return { distance: m, substitutions: 0, deletions: 0, insertions: m };
  }
  if (m === 0) {
    return { distance: n, substitutions: 0, deletions: n, insertions: 0 };
  }
  if (n > LARGE_EDIT_SEQUENCE_THRESHOLD || m > LARGE_EDIT_SEQUENCE_THRESHOLD) {
    return gitDiffBreakdown(reference, candidate);
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const ops: Array<Array<"none" | "sub" | "del" | "ins" | "match">> = Array.from(
    { length: n + 1 },
    () => new Array<"none" | "sub" | "del" | "ins" | "match">(m + 1).fill("none"),
  );

  for (let i = 0; i <= n; i++) {
    dp[i][0] = i;
    if (i > 0) ops[i][0] = "del";
  }
  for (let j = 0; j <= m; j++) {
    dp[0][j] = j;
    if (j > 0) ops[0][j] = "ins";
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (reference[i - 1] === candidate[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
        ops[i][j] = "match";
      } else {
        const sub = dp[i - 1][j - 1];
        const del = dp[i - 1][j];
        const ins = dp[i][j - 1];
        const min = Math.min(sub, del, ins);
        dp[i][j] = min + 1;
        if (min === sub) ops[i][j] = "sub";
        else if (min === del) ops[i][j] = "del";
        else ops[i][j] = "ins";
      }
    }
  }

  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const op = ops[i][j];
    if (op === "match") {
      i--;
      j--;
    } else if (op === "sub") {
      substitutions++;
      i--;
      j--;
    } else if (op === "del") {
      deletions++;
      i--;
    } else {
      insertions++;
      j--;
    }
  }

  return { distance: dp[n][m], substitutions, deletions, insertions };
}

export function charLevenshteinDistance(left: string, right: string): number {
  const leftChars = [...left];
  const rightChars = [...right];
  if (leftChars.length === 0) {
    return rightChars.length;
  }
  if (rightChars.length === 0) {
    return leftChars.length;
  }
  if (leftChars.length < rightChars.length) {
    return charLevenshteinDistance(right, left);
  }
  let previous = Array.from({ length: rightChars.length + 1 }, (_, index) => index);
  for (let leftIndex = 0; leftIndex < leftChars.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < rightChars.length; rightIndex += 1) {
      const insertion = current[rightIndex] + 1;
      const deletion = previous[rightIndex + 1] + 1;
      const substitution = previous[rightIndex] + Number(leftChars[leftIndex] !== rightChars[rightIndex]);
      current.push(Math.min(insertion, deletion, substitution));
    }
    previous = current;
  }
  return previous.at(-1) ?? 0;
}

export function charLevenshteinBreakdown(left: string, right: string): WerBreakdown {
  const leftChars = [...left];
  const rightChars = [...right];
  return levenshteinBreakdown(leftChars, rightChars);
}

export function wordErrorRate(reference: string, candidate: string): number {
  const referenceTokens = tokenize(reference);
  const candidateTokens = tokenize(candidate);
  if (referenceTokens.length === 0) {
    return 0;
  }
  return levenshteinDistance(referenceTokens, candidateTokens) / referenceTokens.length;
}

export interface WerDetailedResult {
  wer: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceCount: number;
}

export function wordErrorRateDetailed(reference: string, candidate: string): WerDetailedResult {
  const referenceTokens = tokenize(reference);
  const candidateTokens = tokenize(candidate);
  const referenceCount = referenceTokens.length;
  if (referenceCount === 0) {
    return { wer: 0, substitutions: 0, deletions: 0, insertions: 0, referenceCount: 0 };
  }
  const breakdown = levenshteinBreakdown(referenceTokens, candidateTokens);
  return {
    wer: breakdown.distance / referenceCount,
    substitutions: breakdown.substitutions,
    deletions: breakdown.deletions,
    insertions: breakdown.insertions,
    referenceCount,
  };
}

export function characterErrorRate(reference: string, candidate: string): number {
  const normalizedRef = normalizeText(reference);
  const normalizedCand = normalizeText(candidate);
  if (normalizedRef.length === 0) {
    return 0;
  }
  return charLevenshteinDistance(normalizedRef, normalizedCand) / normalizedRef.length;
}

export function characterErrorRateDetailed(reference: string, candidate: string): WerDetailedResult {
  const normalizedRef = normalizeText(reference);
  const normalizedCand = normalizeText(candidate);
  const referenceCount = normalizedRef.length;
  if (referenceCount === 0) {
    return { wer: 0, substitutions: 0, deletions: 0, insertions: 0, referenceCount: 0 };
  }
  const breakdown = charLevenshteinBreakdown(normalizedRef, normalizedCand);
  return {
    wer: breakdown.distance / referenceCount,
    substitutions: breakdown.substitutions,
    deletions: breakdown.deletions,
    insertions: breakdown.insertions,
    referenceCount,
  };
}

export function textSimilarity(textA: string, textB: string): number {
  return Math.max(0, Math.min(1, 1 - wordErrorRate(textA, textB)));
}

export function isLocalOcrService(service: string): boolean {
  return LOCAL_SERVICES.has(service);
}

export function makeProviderKey(provider: string, model: string): string {
  return `${provider}/${model}`;
}

function makeProviderLookupKey(provider: string, model: string): string {
  return `${provider}::${model}`;
}

export function buildCostLookup(runJson: OcrRunJson): Map<string, number> {
  const lookup = new Map<string, number>();
  const actualSteps = runJson.metadata?.cost?.actual?.steps ?? [];
  for (const step of actualSteps) {
    if (step.provider && step.model && step.cost !== undefined) {
      lookup.set(makeProviderLookupKey(step.provider, step.model), Number(step.cost));
    }
  }
  if (lookup.size > 0) {
    return lookup;
  }
  const estimatedSteps = runJson.metadata?.cost?.estimated?.steps ?? [];
  for (const step of estimatedSteps) {
    if (step.provider && step.model && step.cost !== undefined) {
      lookup.set(makeProviderLookupKey(step.provider, step.model), Number(step.cost));
    }
  }
  return lookup;
}

export function buildTimingLookup(runJson: OcrRunJson): Map<string, number> {
  const lookup = new Map<string, number>();
  const actualSteps = runJson.metadata?.timing?.actual?.steps ?? [];
  for (const step of actualSteps) {
    if (step.provider && step.model && step.processingTimeMs !== undefined) {
      lookup.set(makeProviderLookupKey(step.provider, step.model), Number(step.processingTimeMs));
    }
  }
  if (lookup.size > 0) {
    return lookup;
  }
  const estimatedSteps = runJson.metadata?.timing?.estimated?.steps ?? [];
  for (const step of estimatedSteps) {
    if (step.provider && step.model && step.processingTimeMs !== undefined) {
      lookup.set(makeProviderLookupKey(step.provider, step.model), Number(step.processingTimeMs));
    }
  }
  return lookup;
}

export function loadOcrRunJson(runDir: string): OcrRunJson {
  const runJson = readJson<OcrRunJson>(join(runDir, "run.json"));
  if (runJson.kind !== "ocr" && runJson.kind !== "extract") {
    throw new Error(`run.json kind is "${runJson.kind}", expected "ocr" or "extract"`);
  }
  const step2 = runJson.metadata?.step2;
  if (!Array.isArray(step2) || step2.length === 0) {
    throw new Error("run.json metadata.step2 is missing or empty");
  }
  return runJson;
}

function normalizePageNumber(pageNumber: number | undefined): number {
  if (pageNumber === undefined) {
    return 0;
  }
  return pageNumber;
}

export function loadOcrProviderRuns(runDir: string): { providers: OcrProviderRun[]; warnings: string[] } {
  const runJson = loadOcrRunJson(runDir);
  const costLookup = buildCostLookup(runJson);
  const timingLookup = buildTimingLookup(runJson);
  const warnings: string[] = [];

  const providerStates = runJson.metadata?.providerStates ?? [];
  const expectedDirs = new Set(
    providerStates
      .map((state) => state.artifactDir)
      .filter((artifactDir): artifactDir is string => Boolean(artifactDir))
      .map((artifactDir) => basename(artifactDir)),
  );

  const providersDir = join(runDir, "providers");
  if (!existsSync(providersDir)) {
    throw new Error(`No providers directory found at ${providersDir}`);
  }

  const resultPaths = readdirSync(providersDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(providersDir, entry.name, "result.json"))
    .filter((path) => existsSync(path))
    .sort((left, right) => left.localeCompare(right));
  const discoveredDirs = new Set(resultPaths.map((path) => basename(dirname(path))));

  const missingResultDirs = [...expectedDirs].filter((dir) => !discoveredDirs.has(dir)).sort();
  if (missingResultDirs.length > 0) {
    warnings.push(
      "run.json references provider artifact directories that are missing result.json files: " +
        missingResultDirs.join(", "),
    );
  }

  const extraResultDirs = [...discoveredDirs].filter((dir) => !expectedDirs.has(dir)).sort();
  if (extraResultDirs.length > 0) {
    warnings.push(
      "Found provider result.json files not listed in run.json providerStates: " +
        extraResultDirs.join(", "),
    );
  }

  const providers = resultPaths.map((resultPath) => {
    const payload = readJson<ProviderResultPayload>(resultPath);
    const provider = payload.provider;
    const model = payload.model;
    if (!provider || !model) {
      throw new Error(`${resultPath} is missing provider/model metadata`);
    }

    const pages: OcrPage[] = (payload.result?.pages ?? []).map((page) => ({
      pageNumber: normalizePageNumber(page.pageNumber),
      method: String(page.method ?? "ocr"),
      text: String(page.text ?? "").trim(),
    }));

    const extractionPath = join(dirname(resultPath), "extraction.txt");
    const lookupKey = makeProviderLookupKey(provider, model);

    const pageText = pages.map((page) => page.text).join("\n\n").trim();

    return {
      directoryName: basename(dirname(resultPath)),
      provider,
      model,
      providerKey: makeProviderKey(provider, model),
      resultPath,
      extractionPath: existsSync(extractionPath) ? extractionPath : null,
      pages,
      text: pageText || String(payload.result?.text ?? "").trim(),
      tokenEstimate: payload.metadata?.tokenEstimate ?? null,
      processingTimeMs:
        timingLookup.get(lookupKey) ??
        (payload.metadata?.processingTime !== undefined ? Number(payload.metadata.processingTime) : null),
      actualCostCents: costLookup.get(lookupKey) ?? null,
    } satisfies OcrProviderRun;
  });

  return { providers, warnings };
}

export function meanPairwiseTextSimilarity(providers: OcrProviderRun[]): Record<string, number> {
  if (providers.length === 1) {
    return { [providers[0].directoryName]: 1 };
  }

  const scores = new Map<string, number[]>(
    providers.map((provider) => [provider.directoryName, []]),
  );

  for (let leftIndex = 0; leftIndex < providers.length; leftIndex += 1) {
    const left = providers[leftIndex];
    for (const right of providers.slice(leftIndex + 1)) {
      const similarity = textSimilarity(left.text, right.text);
      scores.get(left.directoryName)?.push(similarity);
      scores.get(right.directoryName)?.push(similarity);
    }
  }

  return Object.fromEntries(
    [...scores.entries()].map(([providerName, values]) => [
      providerName,
      values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 1,
    ]),
  );
}

export function chooseBaselineProvider(
  providers: OcrProviderRun[],
): { baseline: OcrProviderRun; agreement: Record<string, number> } {
  const agreement = meanPairwiseTextSimilarity(providers);
  const ranked = [...providers].sort((left, right) => {
    const leftScore = agreement[left.directoryName] ?? 0;
    const rightScore = agreement[right.directoryName] ?? 0;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    const leftPages = left.pages.length;
    const rightPages = right.pages.length;
    if (leftPages !== rightPages) {
      return rightPages - leftPages;
    }
    const leftTokens = tokenize(left.text).length;
    const rightTokens = tokenize(right.text).length;
    if (leftTokens !== rightTokens) {
      return rightTokens - leftTokens;
    }
    const leftProcessing = left.processingTimeMs ?? Number.POSITIVE_INFINITY;
    const rightProcessing = right.processingTimeMs ?? Number.POSITIVE_INFINITY;
    if (leftProcessing !== rightProcessing) {
      return leftProcessing - rightProcessing;
    }
    return left.directoryName.localeCompare(right.directoryName);
  });

  const baseline = ranked[0];
  if (!baseline) {
    throw new Error("Cannot choose a baseline provider from an empty provider list");
  }
  return { baseline, agreement };
}

export function parseConsensusExtraction(path: string): { pages: Array<{ pageNumber: number; text: string }> } {
  const content = readFileSync(path, "utf8").trim();
  if (!content) {
    throw new Error(`${path} is empty`);
  }

  const lines = content.split(/\r?\n/);
  const pages: Array<{ pageNumber: number; text: string }> = [];
  let currentPageNumber = 0;
  let currentLines: string[] = [];

  for (const line of lines) {
    const delimiterMatch = line.match(PAGE_DELIMITER_RE);
    if (delimiterMatch) {
      if (currentLines.length > 0) {
        pages.push({ pageNumber: currentPageNumber, text: currentLines.join("\n").trim() });
      }
      currentPageNumber = Number(delimiterMatch[1]);
      currentLines = [];
      continue;
    }
    currentLines.push(line);
  }

  if (currentLines.length > 0) {
    pages.push({ pageNumber: currentPageNumber, text: currentLines.join("\n").trim() });
  }

  if (pages.length === 0) {
    throw new Error(`${path} does not contain any text`);
  }

  return { pages };
}

export function formatCents(cents: number | null): string {
  if (cents === null) {
    return "n/a";
  }
  return `${cents.toFixed(4)}\u00a2 ($${(cents / 100).toFixed(4)})`;
}

export function formatProcessingSeconds(milliseconds: number | null): string {
  if (milliseconds === null) {
    return "n/a";
  }
  return `${(milliseconds / 1000).toFixed(2)}s`;
}
