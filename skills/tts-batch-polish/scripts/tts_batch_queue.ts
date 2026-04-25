#!/usr/bin/env bun

import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";

const STATE_VERSION = 1;

interface StatePayload {
  version: number;
  done: string[];
}

interface SharedArgs {
  command: "next" | "done" | "status" | "reset";
  root: string;
  state: string | null;
  recursive: boolean;
}

interface NextArgs extends SharedArgs {
  command: "next";
  size: number;
}

interface DoneArgs extends SharedArgs {
  command: "done";
  files: string[];
}

interface StatusArgs extends SharedArgs {
  command: "status";
  size: number;
}

interface ResetArgs extends SharedArgs {
  command: "reset";
}

type ParsedArgs = NextArgs | DoneArgs | StatusArgs | ResetArgs;

type GlobLike = {
  scanSync(options: { cwd: string; absolute: true; onlyFiles: true }): Iterable<string>;
};

const BunGlob = (Bun as unknown as { Glob: new (pattern: string) => GlobLike }).Glob;

function usage(): string {
  return [
    "Usage:",
    "  bun tts_batch_queue.ts next --root <dir> [--state <path>] [--recursive] [--size <n>]",
    "  bun tts_batch_queue.ts done --root <dir> [--state <path>] [--recursive] <file> [file...]",
    "  bun tts_batch_queue.ts status --root <dir> [--state <path>] [--recursive] [--size <n>]",
    "  bun tts_batch_queue.ts reset --root <dir> [--state <path>] [--recursive]",
  ].join("\n");
}

function expandHome(path: string): string {
  if (path === "~") {
    return homedir();
  }
  if (path.startsWith("~/")) {
    return resolve(homedir(), path.slice(2));
  }
  return path;
}

function resolvePath(path: string): string {
  return resolve(expandHome(path));
}

function defaultStatePath(root: string): string {
  return resolve(root, ".tts-batch-state.json");
}

function resolveStatePath(root: string, state: string | null): string {
  return state ? resolvePath(state) : defaultStatePath(root);
}

function listTxtFiles(root: string, recursive: boolean): string[] {
  const pattern = recursive ? "**/*.txt" : "*.txt";
  const glob = new BunGlob(pattern);
  return [...glob.scanSync({ cwd: root, absolute: true, onlyFiles: true })]
    .map((path) => resolve(path))
    .sort((left, right) => left.localeCompare(right));
}

async function loadState(statePath: string): Promise<StatePayload> {
  const stateFile = Bun.file(statePath);
  if (!(await stateFile.exists())) {
    return { version: STATE_VERSION, done: [] };
  }

  let data: unknown;
  try {
    data = JSON.parse(await stateFile.text());
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid state JSON: ${statePath} (${detail})`);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`Invalid state format: ${statePath}`);
  }

  const done = (data as { done?: unknown }).done ?? [];
  if (!Array.isArray(done)) {
    throw new Error(`Invalid state format: 'done' must be a list in ${statePath}`);
  }

  return {
    version: STATE_VERSION,
    done: done.map((item) => String(item)),
  };
}

async function saveState(statePath: string, done: Iterable<string>): Promise<void> {
  const payload: StatePayload = {
    version: STATE_VERSION,
    done: [...done].map((path) => resolve(path)).sort((left, right) => left.localeCompare(right)),
  };
  await Bun.write(statePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function resolveRequestedFiles(root: string, files: string[]): string[] {
  return files.map((file) => {
    const expanded = expandHome(file);
    return isAbsolute(expanded) ? resolve(expanded) : resolve(root, expanded);
  });
}

function computeRemaining(allFiles: string[], donePaths: Set<string>): string[] {
  return allFiles.filter((path) => !donePaths.has(path));
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be >= 1`);
  }
  return parsed;
}

function parseShared(command: ParsedArgs["command"], argv: string[]): SharedArgs & { size: number; files: string[] } {
  let root: string | null = null;
  let state: string | null = null;
  let recursive = false;
  let size = 1;
  const files: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --root");
      }
      root = value;
      index += 1;
      continue;
    }
    if (arg === "--state") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --state");
      }
      state = value;
      index += 1;
      continue;
    }
    if (arg === "--recursive") {
      recursive = true;
      continue;
    }
    if (arg === "--size") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --size");
      }
      size = parsePositiveInteger(value, "--size");
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    files.push(arg);
  }

  if (!root) {
    throw new Error(`Missing required --root\n\n${usage()}`);
  }

  return {
    command,
    root: resolvePath(root),
    state,
    recursive,
    size,
    files,
  };
}

function parseArgs(argv: string[]): ParsedArgs {
  const command = argv[0];
  if (command !== "next" && command !== "done" && command !== "status" && command !== "reset") {
    throw new Error(usage());
  }

  const shared = parseShared(command, argv.slice(1));

  if ((command === "next" || command === "status") && shared.files.length > 0) {
    throw new Error(`${command} does not accept positional files`);
  }
  if (command === "done" && shared.files.length === 0) {
    throw new Error("done requires at least one file");
  }
  if (command === "reset" && shared.files.length > 0) {
    throw new Error("reset does not accept positional files");
  }

  if (command === "next") {
    return { command, root: shared.root, state: shared.state, recursive: shared.recursive, size: shared.size };
  }
  if (command === "done") {
    return { command, root: shared.root, state: shared.state, recursive: shared.recursive, files: shared.files };
  }
  if (command === "status") {
    return { command, root: shared.root, state: shared.state, recursive: shared.recursive, size: shared.size };
  }
  return { command, root: shared.root, state: shared.state, recursive: shared.recursive };
}

async function cmdNext(args: NextArgs): Promise<number> {
  const statePath = resolveStatePath(args.root, args.state);
  const allFiles = listTxtFiles(args.root, args.recursive);
  const state = await loadState(statePath);
  const donePaths = new Set(state.done.map((path) => resolve(path)));
  const batch = computeRemaining(allFiles, donePaths).slice(0, args.size);

  if (batch.length === 0) {
    console.log("No remaining files.");
    return 0;
  }

  for (const path of batch) {
    console.log(path);
  }
  return 0;
}

async function cmdDone(args: DoneArgs): Promise<number> {
  const statePath = resolveStatePath(args.root, args.state);
  const state = await loadState(statePath);
  const allFiles = new Set(listTxtFiles(args.root, args.recursive));
  const requested = resolveRequestedFiles(args.root, args.files);
  const missing = requested.filter((path) => !allFiles.has(path));

  if (missing.length > 0) {
    console.error("These files are not part of the target directory/pattern:");
    for (const path of missing) {
      console.error(path);
    }
    return 1;
  }

  const donePaths = new Set(state.done.map((path) => resolve(path)));
  for (const path of requested) {
    donePaths.add(path);
  }

  await saveState(statePath, donePaths);
  console.log(`Marked ${requested.length} file(s) as done.`);
  console.log(`State: ${statePath}`);
  return 0;
}

async function cmdStatus(args: StatusArgs): Promise<number> {
  const statePath = resolveStatePath(args.root, args.state);
  const allFiles = listTxtFiles(args.root, args.recursive);
  const state = await loadState(statePath);
  const donePaths = new Set(state.done.map((path) => resolve(path)));
  const remaining = computeRemaining(allFiles, donePaths);

  console.log(`Root: ${args.root}`);
  console.log(`State: ${statePath}`);
  console.log(`Total files: ${allFiles.length}`);
  console.log(`Done: ${allFiles.length - remaining.length}`);
  console.log(`Remaining: ${remaining.length}`);

  const preview = remaining.slice(0, args.size);
  if (preview.length > 0) {
    console.log("Next file(s):");
    for (const path of preview) {
      console.log(path);
    }
  }
  return 0;
}

async function cmdReset(args: ResetArgs): Promise<number> {
  const statePath = resolveStatePath(args.root, args.state);
  const stateFile = Bun.file(statePath);

  if (await stateFile.exists()) {
    await stateFile.delete();
    console.log(`Removed state: ${statePath}`);
  } else {
    console.log(`No state file to remove: ${statePath}`);
  }
  return 0;
}

async function main(): Promise<number> {
  const args = parseArgs(Bun.argv.slice(2));
  if (args.command === "next") {
    return cmdNext(args);
  }
  if (args.command === "done") {
    return cmdDone(args);
  }
  if (args.command === "status") {
    return cmdStatus(args);
  }
  return cmdReset(args);
}

if (import.meta.main) {
  try {
    process.exit(await main());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
