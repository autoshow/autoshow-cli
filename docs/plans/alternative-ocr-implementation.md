# Directory Structure
```
lib/
  args.ts
  clean.ts
  epub.ts
  slug.ts
  split.ts
  types.ts
  writers.ts
tests/
  args.test.ts
  clean.test.ts
  epub.test.ts
  ocr.integration.test.ts
  slug.test.ts
  writers.test.ts
.gitignore
ocr.ts
package.json
README.md
```

# Files

## File: lib/args.ts
````typescript
import type { Config } from "./types.ts";

export const DEFAULT_CHUNK_LIMIT_CHARS = 39_000;

export const HELP_TEXT = `Usage: bun ocr [options]

Process all EPUB files in input/ and write cleaned text to content/<book>/

Options:
  --chapters         Write one file per section to content/<book>/chapters/
  --length <n>       Set character limit in thousands (default: 39)
                     With --chapters, limits per-section size
  -h, --help         Show this help

Examples:
  bun ocr                         Default: 39k-char chunks
  bun ocr --chapters              One file per section, no size limit
  bun ocr --length 50             50k-char chunks
  bun ocr --chapters --length 50  Sections split at 50k chars
`;

export class ArgsError extends Error {}

export type ParseArgsResult =
  | { kind: "help" }
  | { kind: "run"; config: Config };

export function parseArgs(argv: string[]): ParseArgsResult {
  let mode: Config["mode"] = "chunks";
  let chunkLimitChars = DEFAULT_CHUNK_LIMIT_CHARS;
  let sawLength = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) {
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      return { kind: "help" };
    }

    if (arg === "--chapters") {
      mode = "chapters";
      if (!sawLength) {
        chunkLimitChars = Number.POSITIVE_INFINITY;
      }
      continue;
    }

    if (arg === "--length") {
      if (sawLength) {
        throw new ArgsError("Duplicate --length flag");
      }

      const value = argv[index + 1];
      if (value === undefined) {
        throw new ArgsError("Missing value for --length");
      }

      if (!/^\d+$/.test(value) || Number.parseInt(value, 10) <= 0) {
        throw new ArgsError("--length must be a positive integer");
      }

      chunkLimitChars = Number.parseInt(value, 10) * 1_000;
      sawLength = true;
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new ArgsError(`Unknown flag: ${arg}`);
    }

    throw new ArgsError(`Unexpected positional argument: ${arg}`);
  }

  if (mode === "chapters" && !sawLength) {
    chunkLimitChars = Number.POSITIVE_INFINITY;
  }

  return {
    kind: "run",
    config: {
      mode,
      chunkLimitChars,
    },
  };
}
````

## File: lib/clean.ts
````typescript
import { parseDocument } from "htmlparser2";
import type { Element } from "domhandler";

const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "dd",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "tfoot",
  "thead",
  "tr",
  "ul",
]);

const CELL_TAGS = new Set(["td", "th"]);

export function extractTextContent(node: any): string {
  const parts: string[] = [];

  function visit(current: any): void {
    if (!current) {
      return;
    }

    if (Array.isArray(current)) {
      for (const child of current) {
        visit(child);
      }
      return;
    }

    if (current.type === "text") {
      parts.push(current.data || "");
      return;
    }

    if (current.type === "tag") {
      if (current.name === "br") {
        parts.push("\n");
        return;
      }

      if (current.children) {
        for (const child of current.children) {
          visit(child);
        }
      }

      if (CELL_TAGS.has(current.name)) {
        parts.push("\n");
      } else if (BLOCK_TAGS.has(current.name)) {
        parts.push("\n\n");
      }
      return;
    }

    if (current.children) {
      for (const child of current.children) {
        visit(child);
      }
    }
  }

  visit(node);
  return parts.join("");
}

function findElements(node: Element, selector: (el: Element) => boolean): Element[] {
  const results: Element[] = [];

  function traverse(current: Element | Element[]): void {
    if (Array.isArray(current)) {
      for (const child of current) {
        traverse(child);
      }
      return;
    }

    if (current.type === "tag") {
      if (selector(current)) {
        results.push(current);
      }

      if (current.children) {
        for (const child of current.children) {
          if (child.type === "tag") {
            traverse(child as Element);
          }
        }
      }
    }
  }

  traverse(node);
  return results;
}

export function cleanHtmlForTTS(html: string): string {
  const dom = parseDocument(html);

  if (dom.children) {
    for (const child of dom.children) {
      if (child.type === "tag") {
        const toRemove = findElements(child as Element, (el) => el.name === "script" || el.name === "style");
        for (const el of toRemove) {
          if (el.parent && "children" in el.parent) {
            const index = el.parent.children.indexOf(el);
            if (index !== -1) {
              el.parent.children.splice(index, 1);
            }
          }
        }
      }
    }
  }

  if (dom.children) {
    for (const child of dom.children) {
      if (child.type === "tag") {
        const toRemove = findElements(child as Element, (el) => {
          const attrs = el.attribs || {};
          const href = attrs.href || "";
          const role = attrs.role || "";
          const className = attrs.class || "";

          return (
            href.startsWith("#fn") ||
            href.startsWith("#footnote") ||
            el.name === "sup" ||
            className.includes("footnote-ref") ||
            role === "doc-noteref" ||
            role === "doc-endnotes" ||
            role === "doc-footnote" ||
            className.includes("footnotes") ||
            attrs.id === "footnotes"
          );
        });

        for (const el of toRemove) {
          if (el.parent && "children" in el.parent) {
            const index = el.parent.children.indexOf(el);
            if (index !== -1) {
              el.parent.children.splice(index, 1);
            }
          }
        }
      }
    }
  }

  let text = extractTextContent(dom);

  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_: string, num: string) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));

  text = text.replace(/\[\d+\]/g, "");
  text = text.replace(/\(\d+\)/g, "");
  text = text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, "");
  text = text.replace(/\[[a-z*†‡§]\]/gi, "");
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n[ \t]+/g, "\n");
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

export function finalCleanup(text: string): string {
  text = text.replace(/^[\s-]*Page\s+\d+[\s-]*$/gim, "");
  text = text.replace(/^[\s-]*\d+[\s-]*$/gm, "");
  text = text.replace(/^[\s-]*(Chapter|CHAPTER)[\s-]*$/gm, "");
  text = text.replace(/\n{3,}/g, "\n\n");

  text = text
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  return text.trim();
}
````

## File: lib/epub.ts
````typescript
import EPub from "epub";
import { parseDocument } from "htmlparser2";
import { basename, extname } from "node:path";

import { cleanHtmlForTTS, extractTextContent } from "./clean.ts";
import type { SectionRecord } from "./types.ts";

type Logger = Pick<typeof console, "log" | "warn">;

type ZipArchive = {
  names?: string[];
  readFile: (name: string, callback: (error: Error | null, data: Buffer) => void) => void;
};

type EpubWithZip = EPub & {
  zip?: ZipArchive;
};

function normalizeInlineWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function findFirstTag(node: any, names: Set<string>): any | null {
  if (!node) {
    return null;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findFirstTag(child, names);
      if (match) {
        return match;
      }
    }
    return null;
  }

  if (node.type === "tag" && names.has(node.name)) {
    return node;
  }

  if (!node.children) {
    return null;
  }

  for (const child of node.children) {
    const match = findFirstTag(child, names);
    if (match) {
      return match;
    }
  }

  return null;
}

function normalizeSectionKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function basenameWithoutExtension(value: string): string {
  const cleanedValue = value.split(/[?#]/, 1)[0] ?? "";
  const filename = basename(cleanedValue);
  if (!filename) {
    return "";
  }

  return filename.slice(0, filename.length - extname(filename).length);
}

function titleFromHtml(html: string): string {
  const dom = parseDocument(html);
  const titleNode = findFirstTag(dom.children, new Set(["title", "h1", "h2", "h3", "h4", "h5", "h6"]));
  const headingText = normalizeInlineWhitespace(extractTextContent(titleNode));
  if (headingText) {
    return headingText;
  }

  const firstBlock = findFirstTag(dom.children, new Set(["p", "div", "blockquote"]));
  const blockText = normalizeInlineWhitespace(extractTextContent(firstBlock));
  if (blockText.length > 0 && blockText.length <= 120) {
    return blockText;
  }

  return "";
}

function titleFromFilename(filename: string): string {
  return basenameWithoutExtension(filename);
}

function sortHtmlEntries(names: string[]): string[] {
  return [...names]
    .filter((name) => /\.(xhtml|html|htm)$/i.test(name))
    .sort((left, right) => {
      const leftNumber = left.match(/(\d+)/)?.[1];
      const rightNumber = right.match(/(\d+)/)?.[1];

      if (leftNumber && rightNumber) {
        const diff = Number.parseInt(leftNumber, 10) - Number.parseInt(rightNumber, 10);
        if (diff !== 0) {
          return diff;
        }
      }

      return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
    });
}

function parseEpub(epub: EPub): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    epub.on("end", () => resolve());
    epub.on("error", (error) => reject(error));
    epub.parse();
  });
}

function getChapter(epub: EPub, chapterId: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    epub.getChapter(chapterId, (error: Error, text: string) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(text);
    });
  });
}

function readZipFile(zip: ZipArchive, name: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    zip.readFile(name, (error, data) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(data);
    });
  });
}

async function extractFromFlow(epub: EPub, logger: Logger): Promise<SectionRecord[]> {
  const sections: SectionRecord[] = [];
  const chapterList = epub.flow || [];

  for (let index = 0; index < chapterList.length; index += 1) {
    const chapter = chapterList[index];
    if (!chapter) {
      continue;
    }

    const id = chapter.id || chapter.href || `section-${index}`;
    const href = chapter.href || chapter.id || "";

    if (!chapter.id) {
      logger.warn(`Warning: Could not process chapter ${href || index}: missing chapter id`);
      continue;
    }

    try {
      const html = await getChapter(epub, chapter.id);
      const text = cleanHtmlForTTS(html);
      if (!text.trim()) {
        continue;
      }

      sections.push({
        index,
        id,
        href,
        title: titleFromHtml(html) || normalizeInlineWhitespace(chapter.title || "") || id,
        text,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Warning: Could not process chapter ${chapter.id}: ${message}`);
    }
  }

  return sections;
}

async function extractFromZip(epub: EpubWithZip, logger: Logger): Promise<SectionRecord[]> {
  const zip = epub.zip;
  if (!zip?.names?.length) {
    return [];
  }

  const sections: SectionRecord[] = [];
  const files = sortHtmlEntries(zip.names);

  for (let index = 0; index < files.length; index += 1) {
    const filename = files[index];
    if (!filename) {
      continue;
    }

    try {
      const fileData = await readZipFile(zip, filename);
      const html = fileData.toString("utf-8");
      const text = cleanHtmlForTTS(html);
      if (!text.trim()) {
        continue;
      }

      sections.push({
        index,
        id: filename,
        href: filename,
        title: titleFromFilename(filename) || filename,
        text,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Warning: Could not process file ${filename}: ${message}`);
    }
  }

  return sections;
}

export async function extractSections(epubPath: string, logger: Logger = console): Promise<SectionRecord[]> {
  const epub = new EPub(epubPath) as EpubWithZip;
  await parseEpub(epub);

  const flowSections = await extractFromFlow(epub, logger);
  if (flowSections.length > 0) {
    return flowSections;
  }

  if ((epub.flow || []).length > 0) {
    logger.log("  Chapter-based extraction yielded no content, trying zip fallback...");
  }

  return extractFromZip(epub, logger);
}

export function shouldSkipSectionInChapterMode(section: Pick<SectionRecord, "title" | "id" | "href" | "text">): boolean {
  return !section.text.trim();
}

export function filterSectionsForChapterMode(sections: SectionRecord[]): SectionRecord[] {
  return sections.filter((section) => !shouldSkipSectionInChapterMode(section));
}

function isStandalonePartDivider(section: SectionRecord): boolean {
  const normalizedText = normalizeInlineWhitespace(section.text);
  const normalizedTitle = normalizeInlineWhitespace(section.title);
  if (!normalizedText || !normalizedTitle || normalizedText !== normalizedTitle) {
    return false;
  }

  const keys = [
    normalizeSectionKey(section.title),
    normalizeSectionKey(section.id),
    normalizeSectionKey(basenameWithoutExtension(section.href)),
  ];

  return keys.some((key) => /^part(?:\d+|-[a-z0-9-]+)?$/.test(key));
}

export function mergeStandaloneDividerSections(sections: SectionRecord[]): SectionRecord[] {
  const merged: SectionRecord[] = [];
  let pendingDividerText = "";

  for (const section of sections) {
    if (isStandalonePartDivider(section)) {
      pendingDividerText = pendingDividerText
        ? `${pendingDividerText}\n\n${section.text}`
        : section.text;
      continue;
    }

    if (pendingDividerText) {
      merged.push({
        ...section,
        text: `${pendingDividerText}\n\n${section.text}`,
      });
      pendingDividerText = "";
      continue;
    }

    merged.push(section);
  }

  if (pendingDividerText) {
    const lastSection = merged.at(-1);
    if (lastSection) {
      merged[merged.length - 1] = {
        ...lastSection,
        text: `${lastSection.text}\n\n${pendingDividerText}`,
      };
    }
  }

  return merged;
}
````

## File: lib/slug.ts
````typescript
import { basename, extname } from "node:path";

type SlugSection = {
  index: number;
  title: string;
  id: string;
  href: string;
};

const MAX_SLUG_LENGTH = 60;

function basenameWithoutExtension(href: string): string {
  const cleanedHref = href.split(/[?#]/, 1)[0] ?? "";
  const filename = basename(cleanedHref);
  if (!filename) {
    return "";
  }

  return filename.slice(0, filename.length - extname(filename).length);
}

export function slugify(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  if (normalized.length <= MAX_SLUG_LENGTH) {
    return normalized;
  }

  return normalized.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, "");
}

export function sectionSlug(section: SlugSection): string {
  return (
    slugify(section.title) ||
    slugify(section.id) ||
    slugify(basenameWithoutExtension(section.href)) ||
    `section-${section.index}`
  );
}
````

## File: lib/split.ts
````typescript
export function splitWithHardLimit(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);

  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      continue;
    }

    const separator = currentChunk.length > 0 ? "\n\n" : "";
    const testChunk = currentChunk + separator + trimmed;

    if (testChunk.length > maxChars) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      if (trimmed.length > maxChars) {
        const words = trimmed.split(/\s+/);
        let tempChunk = "";

        for (const word of words) {
          const wordSeparator = tempChunk.length > 0 ? " " : "";
          const testLength = tempChunk.length + wordSeparator.length + word.length;

          if (testLength > maxChars) {
            if (tempChunk.length > 0) {
              chunks.push(tempChunk);
              tempChunk = "";
            }

            if (word.length > maxChars) {
              for (let index = 0; index < word.length; index += maxChars) {
                chunks.push(word.slice(index, index + maxChars));
              }
            } else {
              tempChunk = word;
            }
          } else {
            tempChunk = tempChunk.length > 0 ? `${tempChunk} ${word}` : word;
          }
        }

        if (tempChunk.length > 0) {
          currentChunk = tempChunk;
        }
      } else {
        currentChunk = trimmed;
      }
    } else {
      currentChunk = testChunk;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}
````

## File: lib/types.ts
````typescript
export type Config = {
  mode: "chunks" | "chapters";
  chunkLimitChars: number;
};

export type SectionRecord = {
  index: number;
  id: string;
  title: string;
  href: string;
  text: string;
};
````

## File: lib/writers.ts
````typescript
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { sectionSlug } from "./slug.ts";
import { splitWithHardLimit } from "./split.ts";
import type { SectionRecord } from "./types.ts";

async function clearDirectory(directory: string, excludedNames: string[] = []): Promise<void> {
  const excluded = new Set(excludedNames);

  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return;
    }

    throw error;
  }

  for (const entry of entries) {
    if (excluded.has(entry.name)) {
      continue;
    }

    await rm(join(directory, entry.name), { recursive: true, force: true });
  }
}

export async function writeChunks(
  outputDir: string,
  bookSlug: string,
  text: string,
  chunkLimitChars: number,
): Promise<number> {
  await mkdir(outputDir, { recursive: true });
  await clearDirectory(outputDir, ["chapters"]);

  const chunks = splitWithHardLimit(text, chunkLimitChars).filter((chunk) => chunk.length > 0);

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    if (!chunk) {
      continue;
    }

    const filename = `${bookSlug}-${String(index + 1).padStart(3, "0")}.txt`;
    await writeFile(join(outputDir, filename), chunk, "utf-8");
  }

  return chunks.length;
}

export async function writeChapters(
  outputDir: string,
  sections: SectionRecord[],
  chunkLimitChars: number,
): Promise<number> {
  const chaptersDir = join(outputDir, "chapters");
  await mkdir(chaptersDir, { recursive: true });
  await clearDirectory(chaptersDir);

  let fileCount = 0;

  for (const section of sections) {
    const baseName = `${String(section.index).padStart(3, "0")}-${sectionSlug(section)}`;
    const parts = Number.isFinite(chunkLimitChars)
      ? splitWithHardLimit(section.text, chunkLimitChars).filter((chunk) => chunk.length > 0)
      : [section.text];

    if (parts.length <= 1) {
      const onlyPart = parts[0];
      if (!onlyPart) {
        continue;
      }

      await writeFile(join(chaptersDir, `${baseName}.txt`), onlyPart, "utf-8");
      fileCount += 1;
      continue;
    }

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      if (!part) {
        continue;
      }

      const filename = `${baseName}-part-${String(index + 1).padStart(3, "0")}.txt`;
      await writeFile(join(chaptersDir, filename), part, "utf-8");
      fileCount += 1;
    }
  }

  return fileCount;
}
````

## File: tests/args.test.ts
````typescript
import { describe, expect, test } from "bun:test";

import { ArgsError, parseArgs } from "../lib/args.ts";

describe("parseArgs", () => {
  test("uses chunk mode defaults with no flags", () => {
    expect(parseArgs([])).toEqual({
      kind: "run",
      config: {
        mode: "chunks",
        chunkLimitChars: 39_000,
      },
    });
  });

  test("enables unsized chapter mode", () => {
    expect(parseArgs(["--chapters"])).toEqual({
      kind: "run",
      config: {
        mode: "chapters",
        chunkLimitChars: Number.POSITIVE_INFINITY,
      },
    });
  });

  test("applies length override in chunk mode", () => {
    expect(parseArgs(["--length", "50"])).toEqual({
      kind: "run",
      config: {
        mode: "chunks",
        chunkLimitChars: 50_000,
      },
    });
  });

  test("applies length override in chapter mode", () => {
    expect(parseArgs(["--chapters", "--length", "50"])).toEqual({
      kind: "run",
      config: {
        mode: "chapters",
        chunkLimitChars: 50_000,
      },
    });
  });

  test("rejects invalid length values", () => {
    const invalidArgs = [
      ["--length", "0"],
      ["--length", "-1"],
      ["--length", "abc"],
    ];

    for (const args of invalidArgs) {
      expect(() => parseArgs(args)).toThrow(ArgsError);
    }
  });

  test("rejects a missing length value", () => {
    expect(() => parseArgs(["--length"])).toThrow(ArgsError);
  });

  test("rejects unknown flags", () => {
    expect(() => parseArgs(["--foo"])).toThrow(new ArgsError("Unknown flag: --foo"));
  });

  test("rejects duplicate length flags", () => {
    expect(() => parseArgs(["--length", "39", "--length", "50"])).toThrow(
      new ArgsError("Duplicate --length flag"),
    );
  });

  test("rejects positional arguments", () => {
    expect(() => parseArgs(["somefile.epub"])).toThrow(new ArgsError("Unexpected positional argument: somefile.epub"));
  });

  test("returns a help indicator for -h and --help", () => {
    expect(parseArgs(["-h"])).toEqual({ kind: "help" });
    expect(parseArgs(["--help"])).toEqual({ kind: "help" });
  });
});
````

## File: tests/clean.test.ts
````typescript
import { describe, expect, test } from "bun:test";

import { cleanHtmlForTTS } from "../lib/clean.ts";

describe("cleanHtmlForTTS", () => {
  test("preserves line breaks between block elements and br tags", () => {
    const html = `<section><h2><a>1<br/>Introduction</a></h2><p>The subtitle</p></section>`;
    expect(cleanHtmlForTTS(html)).toBe("1\nIntroduction\n\nThe subtitle");
  });

  test("keeps short inline-only blocks readable", () => {
    expect(cleanHtmlForTTS(`<section><p class="dedC"><em>To Kathleen</em></p></section>`)).toBe("To Kathleen");
  });
});
````

## File: tests/epub.test.ts
````typescript
import { describe, expect, test } from "bun:test";

import {
  filterSectionsForChapterMode,
  mergeStandaloneDividerSections,
  shouldSkipSectionInChapterMode,
} from "../lib/epub.ts";
import type { SectionRecord } from "../lib/types.ts";

function makeSection(overrides: Partial<SectionRecord>): SectionRecord {
  return {
    index: 0,
    id: "section",
    title: "Section",
    href: "text/section.xhtml",
    text: "Body text",
    ...overrides,
  };
}

describe("chapter-mode filtering", () => {
  test("keeps front and back matter when text is present", () => {
    const kept = [
      makeSection({ title: "Cover" }),
      makeSection({ id: "toc" }),
      makeSection({ title: "Contents" }),
      makeSection({ href: "OPS/navigation.xhtml" }),
      makeSection({ title: "Title Page" }),
      makeSection({ id: "title" }),
      makeSection({ id: "copyright" }),
      makeSection({ id: "halftitle1" }),
      makeSection({ title: "Preface" }),
      makeSection({ id: "dedication" }),
      makeSection({ title: "Acknowledgments" }),
      makeSection({ title: "Index" }),
      makeSection({ title: "About the Author" }),
    ];

    for (const section of kept) {
      expect(shouldSkipSectionInChapterMode(section)).toBe(false);
    }
  });

  test("skips empty sections and preserves short part-divider pages", () => {
    expect(shouldSkipSectionInChapterMode(makeSection({ text: "   " }))).toBe(true);
    expect(shouldSkipSectionInChapterMode(makeSection({ title: "Part II", text: "Part II" }))).toBe(false);
  });

  test("filters only empty sections while preserving source order", () => {
    const sections = [
      makeSection({ index: 0, title: "Cover", text: "Cover text" }),
      makeSection({ index: 1, title: "Preface" }),
      makeSection({ index: 2, title: "Part II", text: "Part II" }),
      makeSection({ index: 3, id: "nav", text: "   " }),
    ];

    expect(filterSectionsForChapterMode(sections).map((section) => section.index)).toEqual([0, 1, 2]);
  });

  test("merges standalone part divider pages into the following section", () => {
    const sections = [
      makeSection({
        index: 9,
        id: "part01",
        title: "PART I THE RISE OF THE WITCH-HUNT NARRATIVE",
        href: "text/part01.xhtml",
        text: "PART I\n\nTHE RISE OF THE WITCH-HUNT NARRATIVE",
      }),
      makeSection({
        index: 10,
        id: "ch01",
        title: "1 Introduction",
        href: "text/ch01.xhtml",
        text: "Introduction\n\nBody text",
      }),
      makeSection({
        index: 11,
        id: "ded",
        title: "To Kathleen",
        href: "text/ded.xhtml",
        text: "To Kathleen",
      }),
    ];

    const merged = mergeStandaloneDividerSections(sections);

    expect(merged.map((section) => section.index)).toEqual([10, 11]);
    expect(merged[0]?.text).toBe(
      "PART I\n\nTHE RISE OF THE WITCH-HUNT NARRATIVE\n\nIntroduction\n\nBody text",
    );
    expect(merged[1]?.text).toBe("To Kathleen");
  });
});
````

## File: tests/ocr.integration.test.ts
````typescript
import { expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");
const scriptPath = join(repoRoot, "ocr.ts");
const sampleBook = "2014-the-witch-hunt-narrative-ross-cheit";
const sampleEpub = join(repoRoot, "input", `${sampleBook}.epub`);

async function makeWorkspace(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "autobook-integration-"));
  await mkdir(join(tempDir, "input"), { recursive: true });
  await mkdir(join(tempDir, "content"), { recursive: true });
  await copyFile(sampleEpub, join(tempDir, "input", `${sampleBook}.epub`));
  return tempDir;
}

async function runCli(cwd: string, args: string[] = []): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const process = Bun.spawn({
    cmd: ["bun", "run", scriptPath, ...args],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);

  return { exitCode, stdout, stderr };
}

test("default mode writes numbered chunks for the sample EPUB", async () => {
  const tempDir = await makeWorkspace();

  try {
    const result = await runCli(tempDir);
    const outputDir = join(tempDir, "content", sampleBook);
    const files = (await readdir(outputDir)).filter((name) => name.endsWith(".txt")).sort();

    expect(result.exitCode).toBe(0);
    expect(result.stdout.includes("All files processed!")).toBe(true);
    expect(result.stderr).toBe("");
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toMatch(new RegExp(`^${sampleBook}-\\d{3}\\.txt$`));

    for (const file of files) {
      const content = await readFile(join(outputDir, file), "utf-8");
      expect(content.trim().length).toBeGreaterThan(0);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("chapter mode writes chapter files for the sample EPUB", async () => {
  const tempDir = await makeWorkspace();

  try {
    const result = await runCli(tempDir, ["--chapters"]);
    const chaptersDir = join(tempDir, "content", sampleBook, "chapters");
    const files = (await readdir(chaptersDir)).filter((name) => name.endsWith(".txt")).sort();

    expect(result.exitCode).toBe(0);
    expect(result.stdout.includes("All files processed!")).toBe(true);
    expect(result.stderr).toBe("");
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toMatch(/^\d{3}-.+\.txt$/);
    expect(files.includes("009-part-i-the-rise-of-the-witch-hunt-narrative.txt")).toBe(false);
    expect(files.includes("015-part-ii-the-triumph-of-the-witch-hunt-narrative.txt")).toBe(false);
    expect(files.includes("019-part-iii-recent-developments.txt")).toBe(false);
    expect(files.includes("001-the-witch-hunt-narrative.txt")).toBe(true);
    expect(files.includes("002-the-witch-hunt-narrative.txt")).toBe(true);
    expect(files.includes("003-copyright-page.txt")).toBe(true);
    expect(files.includes("004-to-kathleen.txt")).toBe(true);
    expect(files.includes("005-contents.txt")).toBe(true);
    expect(files.includes("008-the-witch-hunt-narrative.txt")).toBe(true);
    expect(files.includes("010-1-introduction.txt")).toBe(true);
    expect(files.includes("024-chapter-five.txt")).toBe(true);

    const chapterOne = await readFile(join(chaptersDir, "010-1-introduction.txt"), "utf-8");
    expect(chapterOne.startsWith("PART I\n\nTHE RISE OF THE WITCH-HUNT NARRATIVE\n\nIntroduction")).toBe(true);

    for (const file of files) {
      const content = await readFile(join(chaptersDir, file), "utf-8");
      expect(content.trim().length).toBeGreaterThan(0);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
````

## File: tests/slug.test.ts
````typescript
import { describe, expect, test } from "bun:test";

import { sectionSlug, slugify } from "../lib/slug.ts";

describe("slugify", () => {
  test("normalizes punctuation and spacing", () => {
    expect(slugify("Chapter 1: The Beginning")).toBe("chapter-1-the-beginning");
  });

  test("strips unicode noise and special characters", () => {
    expect(slugify("Déjà Vu! Section §1 / 你好")).toBe("deja-vu-section-1");
  });

  test("truncates at 60 characters", () => {
    const slug = slugify("a".repeat(80));
    expect(slug.length).toBe(60);
    expect(slug).toBe("a".repeat(60));
  });
});

describe("sectionSlug", () => {
  test("falls back to id when title is empty", () => {
    expect(
      sectionSlug({
        index: 11,
        title: "",
        id: "ch01",
        href: "",
      }),
    ).toBe("ch01");
  });

  test("falls back to href basename when title and id are empty", () => {
    expect(
      sectionSlug({
        index: 11,
        title: "",
        id: "",
        href: "OEBPS/text/part003.xhtml",
      }),
    ).toBe("part003");
  });

  test("falls back to section index when all slug sources are empty", () => {
    expect(
      sectionSlug({
        index: 0,
        title: "",
        id: "",
        href: "",
      }),
    ).toBe("section-0");
  });
});
````

## File: tests/writers.test.ts
````typescript
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SectionRecord } from "../lib/types.ts";
import { writeChapters, writeChunks } from "../lib/writers.ts";

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "autobook-writers-"));
}

describe("writeChapters", () => {
  test("writes one file per kept section in source order", async () => {
    const tempDir = await makeTempDir();

    try {
      const outputDir = join(tempDir, "content", "book");
      const sections: SectionRecord[] = [
        {
          index: 0,
          id: "intro",
          title: "Introduction",
          href: "text/intro.xhtml",
          text: "Introduction text",
        },
        {
          index: 12,
          id: "ch01",
          title: "",
          href: "text/ch01.xhtml",
          text: "Chapter 1 text",
        },
      ];

      const fileCount = await writeChapters(outputDir, sections, Number.POSITIVE_INFINITY);
      const chapterFiles = (await readdir(join(outputDir, "chapters"))).sort();

      expect(fileCount).toBe(2);
      expect(chapterFiles).toEqual(["000-introduction.txt", "012-ch01.txt"]);
      expect(await readFile(join(outputDir, "chapters", "012-ch01.txt"), "utf-8")).toBe("Chapter 1 text");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("splits oversized sections and clears stale chapter files", async () => {
    const tempDir = await makeTempDir();

    try {
      const outputDir = join(tempDir, "content", "book");
      const chaptersDir = join(outputDir, "chapters");
      await mkdir(chaptersDir, { recursive: true });
      await writeFile(join(chaptersDir, "old.txt"), "stale", "utf-8");

      const sections: SectionRecord[] = [
        {
          index: 0,
          id: "long",
          title: "Long Section",
          href: "text/long.xhtml",
          text: "alpha beta gamma",
        },
        {
          index: 1,
          id: "short",
          title: "Short Section",
          href: "text/short.xhtml",
          text: "short text",
        },
      ];

      const fileCount = await writeChapters(outputDir, sections, 10);
      const chapterFiles = (await readdir(chaptersDir)).sort();

      expect(fileCount).toBe(3);
      expect(chapterFiles).toEqual([
        "000-long-section-part-001.txt",
        "000-long-section-part-002.txt",
        "001-short-section.txt",
      ]);
      expect(chapterFiles.includes("old.txt")).toBe(false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("writeChunks", () => {
  test("writes numbered chunks and preserves the chapters directory", async () => {
    const tempDir = await makeTempDir();

    try {
      const outputDir = join(tempDir, "content", "book");
      const chaptersDir = join(outputDir, "chapters");
      await mkdir(chaptersDir, { recursive: true });
      await writeFile(join(outputDir, "stale.txt"), "stale", "utf-8");
      await writeFile(join(chaptersDir, "keep.txt"), "keep", "utf-8");

      const fileCount = await writeChunks(outputDir, "book", "alpha\n\nbeta\n\ngamma", 9);
      const rootFiles = (await readdir(outputDir)).sort();

      expect(fileCount).toBe(3);
      expect(rootFiles).toEqual(["book-001.txt", "book-002.txt", "book-003.txt", "chapters"]);
      expect(await readFile(join(chaptersDir, "keep.txt"), "utf-8")).toBe("keep");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
````

## File: .gitignore
````
# dependencies (bun install)
node_modules

# output
out
dist
*.tgz

# code coverage
coverage
*.lcov

# logs
logs
_.log
report.[0-9]_.[0-9]_.[0-9]_.[0-9]_.json

# dotenv environment variable files
.env
.env.development.local
.env.test.local
.env.production.local
.env.local

# caches
.eslintcache
.cache
*.tsbuildinfo

# IntelliJ based IDEs
.idea

# Finder (MacOS) folder config
.DS_Store

content
*.epub
````

## File: ocr.ts
````typescript
#!/usr/bin/env bun
import { readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import { ArgsError, HELP_TEXT, parseArgs } from "./lib/args.ts";
import { finalCleanup } from "./lib/clean.ts";
import { extractSections, filterSectionsForChapterMode, mergeStandaloneDividerSections } from "./lib/epub.ts";
import type { Config, SectionRecord } from "./lib/types.ts";
import { writeChapters, writeChunks } from "./lib/writers.ts";

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

function summarizeSectionText(sections: SectionRecord[]): { characters: number; words: number } {
  const characters = sections.reduce((total, section) => total + section.text.length, 0);
  const words = sections.reduce((total, section) => total + countWords(section.text), 0);
  return { characters, words };
}

async function processEpubForTTS(epubPath: string, config: Config): Promise<void> {
  console.log(`Processing ${epubPath}...`);

  const bookName = basename(epubPath, extname(epubPath));
  const outputDir = join(process.cwd(), "content", bookName);
  const sections = await extractSections(epubPath);

  if (config.mode === "chapters") {
    const keptSections = mergeStandaloneDividerSections(
      filterSectionsForChapterMode(sections)
        .map((section) => ({
          ...section,
          text: finalCleanup(section.text),
        }))
        .filter((section) => section.text.trim()),
    )
      .map((section) => ({
        ...section,
        text: finalCleanup(section.text),
      }))
      .filter((section) => section.text.trim());

    const fileCount = await writeChapters(outputDir, keptSections, config.chunkLimitChars);
    const summary = summarizeSectionText(keptSections);

    console.log(`✓ Output written to ${join(outputDir, "chapters")}/`);
    console.log(`  ${fileCount} files created`);
    console.log(`  ${keptSections.length} sections kept, ${summary.characters} characters, ${summary.words} words total`);
    return;
  }

  const combinedText = finalCleanup(
    sections
      .map((section) => section.text.trim())
      .filter((text) => text.length > 0)
      .join("\n\n"),
  );

  const fileCount = await writeChunks(outputDir, bookName, combinedText, config.chunkLimitChars);

  console.log(`✓ Output written to ${outputDir}/`);
  console.log(`  ${fileCount} files created`);
  console.log(`  ${combinedText.length} characters, ${countWords(combinedText)} words total`);
}

export async function run(argv: string[] = process.argv.slice(2)): Promise<number> {
  let config: Config;

  try {
    const parsed = parseArgs(argv);
    if (parsed.kind === "help") {
      console.log(HELP_TEXT);
      return 0;
    }
    config = parsed.config;
  } catch (error) {
    if (error instanceof ArgsError) {
      console.error(error.message);
      console.error("");
      console.error("Run `bun ocr --help` for usage.");
      return 1;
    }

    throw error;
  }

  const inputDir = join(process.cwd(), "input");

  let files: string[];
  try {
    files = await readdir(inputDir);
  } catch (error) {
    console.error("Error reading input directory:", error);
    return 1;
  }

  const epubFiles = files.filter((file) => file.toLowerCase().endsWith(".epub")).sort();
  if (epubFiles.length === 0) {
    console.error("No EPUB files found in input directory");
    return 1;
  }

  console.log(`Found ${epubFiles.length} EPUB file(s) to process\n`);

  for (const file of epubFiles) {
    const epubPath = join(inputDir, file);

    try {
      await processEpubForTTS(epubPath, config);
      console.log("");
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  console.log("All files processed!");
  return 0;
}

if (import.meta.main) {
  const exitCode = await run();
  process.exit(exitCode);
}
````

## File: package.json
````json
{
  "name": "autobook",
  "private": true,
  "scripts": {
    "check": "bunx tsc --noEmit",
    "ocr": "bun run ocr.ts"
  },
  "bin": {
    "ocr": "./ocr.ts"
  },
  "devDependencies": {
    "@types/bun": "latest"
  },
  "peerDependencies": {
    "typescript": "^5"
  },
  "dependencies": {
    "domhandler": "^5.0.3",
    "epub": "^1.3.0",
    "htmlparser2": "^10.0.0"
  }
}
````

## File: README.md
````markdown
# audio

EPUB to Text-to-Speech Processor

Converts EPUB files into clean, TTS-ready text by removing formatting, footnotes, and other elements that interfere with audio output.

## Installation

```bash
bun install
```

## Usage

Place one or more `.epub` files in `input/`, then run:

```bash
bun ocr
```

Output is written under `content/<book>/` in numbered `.txt` chunks.

Options:

```bash
bun ocr --chapters
bun ocr --length 45
bun ocr --chapters --length 45
```

- `--chapters` writes one file per kept section to `content/<book>/chapters/`
- `--length <n>` sets the chunk limit in thousands of characters
- `-h`, `--help` prints usage details

## Features

- Removes all HTML formatting
- Strips footnote references and sections
- Eliminates page numbers and headers
- Cleans excessive whitespace
- Decodes HTML entities
- Processes every EPUB in `input/` in one run
- Splits output into manageable chunks (default: 39,000 characters per file)
- Can write per-section chapter files instead of whole-book chunks
- Preserves paragraph structure where possible
````
