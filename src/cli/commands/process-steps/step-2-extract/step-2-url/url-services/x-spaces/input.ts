import type { ParsedPostInputReference, ParsedSpaceInput, ParsedSpaceInputEntry } from "./types";

const SPACE_URL_PATTERN = /\b(?:https?:\/\/)?(?:mobile\.)?(?:www\.)?(?:x|twitter)\.com\/i\/spaces\/([A-Za-z0-9]{1,13})(?=[/?#\s]|$)/gi;
const POST_URL_PATTERN = /\b(?:https?:\/\/)?(?:mobile\.)?(?:www\.)?(?:x|twitter)\.com\/(?:(?:([A-Za-z0-9_]{1,15})\/status(?:es)?)|(?:i\/web\/status))\/(\d+)(?=[/?#\s]|$)/gi;
const RAW_SPACE_ID_PATTERN = /^[A-Za-z0-9]{1,13}$/;

export function isSpaceId(value: string): boolean {
  return RAW_SPACE_ID_PATTERN.test(value);
}

export function extractSpaceIdsFromText(text: string): string[] {
  const ids = new Set<string>();

  for (const match of text.matchAll(SPACE_URL_PATTERN)) {
    ids.add(match[1]!);
  }

  const trimmed = text.trim();

  if (isSpaceId(trimmed)) {
    ids.add(trimmed);
  }

  return [...ids];
}

function canonicalPostUrl(postId: string, username?: string): string {
  return username ? `https://x.com/${username}/status/${postId}` : `https://x.com/i/web/status/${postId}`;
}

function extractPostReferencesFromText(
  text: string,
  lineNumber = 1,
  raw = text,
  spaceIds: string[] = extractSpaceIdsFromText(text)
): ParsedPostInputReference[] {
  const refs = new Map<string, ParsedPostInputReference>();

  for (const match of text.matchAll(POST_URL_PATTERN)) {
    const username = match[1];
    const postId = match[2]!;
    refs.set(postId, {
      id: postId,
      line: lineNumber,
      raw,
      source: "input",
      spaceIds,
      url: canonicalPostUrl(postId, username),
      username,
    });
  }

  return [...refs.values()];
}

function parseLine(line: string, lineNumber: number): ParsedSpaceInputEntry | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const ids = extractSpaceIdsFromText(trimmed);
  const postReferences = extractPostReferencesFromText(trimmed, lineNumber, line, ids);

  if (ids.length > 0 || postReferences.length > 0) {
    return {
      line: lineNumber,
      postId: postReferences[0]?.id,
      postReferences,
      raw: line,
      source: "input",
      spaceId: ids[0],
      spaceIds: ids,
    };
  }

  return {
    error: "Expected an X Space URL, raw Space ID, or X post URL",
    line: lineNumber,
    postReferences: [],
    raw: line,
    source: "input",
    spaceIds: [],
  };
}

export function parseSpaceInput(text: string, path?: string): ParsedSpaceInput {
  const entries: ParsedSpaceInputEntry[] = [];
  const ids = new Set<string>();
  const postIds = new Set<string>();
  const postsById = new Map<string, ParsedPostInputReference>();

  text.split(/\r?\n/).forEach((line, index) => {
    const entry = parseLine(line, index + 1);

    if (!entry) {
      return;
    }

    entries.push(entry);

    for (const spaceId of entry.spaceIds) {
      ids.add(spaceId);
    }

    for (const post of entry.postReferences) {
      postIds.add(post.id);
      const existing = postsById.get(post.id);

      if (existing) {
        postsById.set(post.id, {
          ...existing,
          spaceIds: [...new Set([...existing.spaceIds, ...post.spaceIds])],
        });
      } else {
        postsById.set(post.id, post);
      }
    }
  });

  return {
    entries,
    ids: [...ids],
    invalidEntries: entries.filter((entry) => entry.error),
    path,
    postIds: [...postIds],
    posts: [...postsById.values()],
  };
}
