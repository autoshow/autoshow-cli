#!/usr/bin/env bun

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

type Mode = "check" | "write";

type ParsedArgs = {
  mode: Mode;
  paths: string[];
};

type Issue = {
  filePath: string;
  line: number | null;
  message: string;
};

const USAGE = [
  "Usage:",
  "  bun .codex/skills/clean-script/scripts/clean_script.ts --write <paths...>",
  "  bun .codex/skills/clean-script/scripts/clean_script.ts --check <paths...>",
  "",
  "Paths may be Markdown files or directories. Directories are scanned recursively for *.md files.",
].join("\n");

function parseArgs(argv: string[]): ParsedArgs {
  let mode: Mode | null = null;
  const paths: string[] = [];

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log(USAGE);
      process.exit(0);
    }

    if (arg === "--check" || arg === "--write") {
      if (mode !== null) {
        throw new Error("Use exactly one of --check or --write.");
      }
      mode = arg === "--check" ? "check" : "write";
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    paths.push(arg);
  }

  if (mode === null) {
    throw new Error("Missing mode. Use --check or --write.");
  }

  if (paths.length === 0) {
    throw new Error("Missing path. Provide at least one Markdown file or directory.");
  }

  return { mode, paths };
}

async function collectMarkdownFiles(inputPaths: string[]): Promise<string[]> {
  const files = new Set<string>();

  for (const inputPath of inputPaths) {
    const absolutePath = resolve(inputPath);
    let pathStat: Awaited<ReturnType<typeof stat>>;

    try {
      pathStat = await stat(absolutePath);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Cannot read path: ${inputPath} (${detail})`);
    }

    if (pathStat.isDirectory()) {
      await collectMarkdownFilesFromDirectory(absolutePath, files);
      continue;
    }

    if (!pathStat.isFile()) {
      throw new Error(`Not a file or directory: ${inputPath}`);
    }

    if (extname(absolutePath).toLowerCase() !== ".md") {
      throw new Error(`Not a Markdown file: ${inputPath}`);
    }

    files.add(absolutePath);
  }

  return [...files].sort((left, right) => left.localeCompare(right));
}

async function collectMarkdownFilesFromDirectory(directory: string, files: Set<string>): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      await collectMarkdownFilesFromDirectory(entryPath, files);
      continue;
    }

    if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
      files.add(entryPath);
    }
  }
}

function formatMarkdown(input: string): string {
  const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  let lines = normalized.split("\n").map((line) => line.trim());

  while (lines.length > 0 && (lines[0] ?? "") === "") {
    lines = lines.slice(1);
  }

  while (lines.length > 0 && (lines[lines.length - 1] ?? "") === "") {
    lines.pop();
  }

  const deliveryNormalized = lines.flatMap((line) => splitDeliveryDialogue(normalizeStyledParenthetical(line)));
  const speakerNormalized = removeBlankLinesAfterSpeakerLabels(deliveryNormalized);

  return `${speakerNormalized.join("\n")}\n`;
}

function normalizeStyledParenthetical(line: string): string {
  const match = /^(\*{1,2}|_{1,2})(\([^()]+\))\1(\s+.*)?$/.exec(line);

  if (match === null) {
    return line;
  }

  const parenthetical = match[2] ?? "";
  const trailingText = match[3] ?? "";

  return `${parenthetical}${trailingText}`.trim();
}

function splitDeliveryDialogue(line: string): string[] {
  if (isTableLine(line)) {
    return [line];
  }

  const match = /^\(([^()]+)\)\s+(\S.*)$/.exec(line);

  if (match === null) {
    return [line];
  }

  return [`(${(match[1] ?? "").trim()})`, (match[2] ?? "").trim()];
}

function isTableLine(line: string): boolean {
  return line.startsWith("|");
}

function removeBlankLinesAfterSpeakerLabels(lines: string[]): string[] {
  const result: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    result.push(line);

    if (!isSpeakerLabel(line)) {
      continue;
    }

    let nextIndex = index + 1;
    while (nextIndex < lines.length && (lines[nextIndex] ?? "") === "") {
      nextIndex += 1;
    }

    if (nextIndex > index + 1 && nextIndex < lines.length && shouldAttachToSpeaker(lines[nextIndex] ?? "")) {
      index = nextIndex - 1;
    }
  }

  return result;
}

function shouldAttachToSpeaker(line: string): boolean {
  if (line === "") {
    return false;
  }

  if (/^(#{1,6}\s|---$)/.test(line)) {
    return false;
  }

  if (isLocationOrStagingLine(line)) {
    return false;
  }

  return true;
}

function isSpeakerLabel(line: string): boolean {
  const match = /^\*\*([^*]+)\*\*$/.exec(line);

  if (match === null) {
    return false;
  }

  const label = (match[1] ?? "").trim();

  if (label !== label.toUpperCase()) {
    return false;
  }

  if (label.includes(":") || /[.!?]$/.test(label)) {
    return false;
  }

  return /^[A-Z0-9 #&'/-]+(?: \((?:O\.S\.|V\.O\.|O\.C\.|CONT'D)\))?$/.test(label);
}

function isLocationOrStagingLine(line: string): boolean {
  const match = /^\*\*([^*]+)\*\*$/.exec(line);

  if (match === null) {
    return false;
  }

  const label = (match[1] ?? "").trim();

  return /^(INT\.|EXT\.|INT\/EXT\.|EST\.|USS ACAMPO\b|CUT TO\b|FADE\b|SMASH CUT\b|TITLE CARD\b)/.test(label);
}

function collectFormattingIssues(filePath: string, original: string): Issue[] {
  const issues: Issue[] = [];

  if (original.startsWith("\uFEFF")) {
    issues.push({ filePath, line: 1, message: "Remove UTF-8 BOM." });
  }

  if (/\r\n?/.test(original)) {
    issues.push({ filePath, line: null, message: "Use LF line endings." });
  }

  if (!original.endsWith("\n")) {
    issues.push({ filePath, line: null, message: "End the file with one final newline." });
  } else if (original.endsWith("\n\n")) {
    issues.push({ filePath, line: null, message: "Remove extra blank lines at end of file." });
  }

  const lines = original.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const lineNumber = index + 1;

    if (line !== line.trim()) {
      issues.push({ filePath, line: lineNumber, message: "Remove leading/trailing whitespace." });
    }

    const trimmed = line.trim();

    if (normalizeStyledParenthetical(trimmed) !== trimmed) {
      issues.push({ filePath, line: lineNumber, message: "Use plain delivery parenthetical formatting." });
    }

    if (splitDeliveryDialogue(normalizeStyledParenthetical(trimmed)).length > 1) {
      issues.push({ filePath, line: lineNumber, message: "Split delivery parenthetical and dialogue onto separate lines." });
    }

    if (!isSpeakerLabel(trimmed)) {
      continue;
    }

    let nextIndex = index + 1;
    while (nextIndex < lines.length && lines[nextIndex]?.trim() === "") {
      nextIndex += 1;
    }

    if (nextIndex > index + 1 && nextIndex < lines.length && shouldAttachToSpeaker(lines[nextIndex]?.trim() ?? "")) {
      issues.push({ filePath, line: lineNumber, message: "Remove blank line after speaker label." });
    }
  }

  return issues;
}

function collectShellIssues(filePath: string, formatted: string): Issue[] {
  const issues: Issue[] = [];
  const lines = formatted.split("\n");
  const titleIndex = nextNonBlankLine(lines, 0);

  if (titleIndex === null) {
    issues.push({ filePath, line: 1, message: "Missing episode shell." });
    return issues;
  }

  if (!/^# Episode \d+: \S.+$/.test(lines[titleIndex] ?? "")) {
    issues.push({ filePath, line: titleIndex + 1, message: "Expected '# Episode N: Title' as the episode title." });
  }

  const shipIndex = nextNonBlankLine(lines, titleIndex + 1);
  if (shipIndex === null || lines[shipIndex] !== "**USS ACAMPO**") {
    issues.push({
      filePath,
      line: shipIndex === null ? titleIndex + 1 : shipIndex + 1,
      message: "Expected '**USS ACAMPO**' after the episode title.",
    });
    return issues;
  }

  const separatorIndex = nextNonBlankLine(lines, shipIndex + 1);
  if (separatorIndex === null || lines[separatorIndex] !== "---") {
    issues.push({
      filePath,
      line: separatorIndex === null ? shipIndex + 1 : separatorIndex + 1,
      message: "Expected '---' after '**USS ACAMPO**'.",
    });
    return issues;
  }

  const sceneIndex = nextNonBlankLine(lines, separatorIndex + 1);
  if (sceneIndex === null || !/^##\s+\S/.test(lines[sceneIndex] ?? "")) {
    issues.push({
      filePath,
      line: sceneIndex === null ? separatorIndex + 1 : sceneIndex + 1,
      message: "Expected a '## ...' scene heading after the episode shell separator.",
    });
  }

  return issues;
}

function nextNonBlankLine(lines: string[], startIndex: number): number | null {
  for (let index = startIndex; index < lines.length; index += 1) {
    if ((lines[index] ?? "").trim() !== "") {
      return index;
    }
  }

  return null;
}

function relativePath(filePath: string): string {
  const relativeFilePath = relative(process.cwd(), filePath);
  return relativeFilePath.startsWith("..") ? filePath : relativeFilePath;
}

function printIssue(issue: Issue): void {
  const displayPath = relativePath(issue.filePath);
  const location = issue.line === null ? displayPath : `${displayPath}:${issue.line}`;
  console.error(`${location}: ${issue.message}`);
}

async function run(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const files = await collectMarkdownFiles(args.paths);

  if (files.length === 0) {
    throw new Error("No Markdown files found.");
  }

  let changedCount = 0;
  const allIssues: Issue[] = [];

  for (const filePath of files) {
    const original = await readFile(filePath, "utf8");
    const formatted = formatMarkdown(original);
    const shellIssues = collectShellIssues(filePath, formatted);

    if (args.mode === "write") {
      if (formatted !== original) {
        await writeFile(filePath, formatted, "utf8");
        changedCount += 1;
        console.log(`wrote ${relativePath(filePath)}`);
      }

      allIssues.push(...shellIssues);
      continue;
    }

    const formattingIssues = collectFormattingIssues(filePath, original);
    if (formatted !== original && formattingIssues.length === 0) {
      formattingIssues.push({ filePath, line: null, message: "File needs script formatting." });
    }

    allIssues.push(...formattingIssues, ...shellIssues);
  }

  if (allIssues.length > 0) {
    for (const issue of allIssues) {
      printIssue(issue);
    }
    return 1;
  }

  if (args.mode === "write") {
    console.log(`OK: formatted ${files.length} file(s), changed ${changedCount}.`);
  } else {
    console.log(`OK: checked ${files.length} file(s).`);
  }

  return 0;
}

run()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    console.error(USAGE);
    process.exitCode = 1;
  });
