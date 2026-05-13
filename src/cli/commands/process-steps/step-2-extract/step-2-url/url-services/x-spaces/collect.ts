import type {
  EnrichedSpace,
  ParsedSpaceInput,
  ParsedPostInputReference,
  SpacePostReference,
  SpacesArtifact,
  SpacesArtifactError,
  SpacesArtifactSource,
  SpacesClientContract,
  XApiProblem,
  XPost,
  XPostLookupResponse,
  XSpace,
  XSpacesResponse,
  XUser,
} from "./types";
import { extractSpaceIdsFromText } from "./input";

export interface CollectSpacesOptions {
  client: SpacesClientContract;
  input?: ParsedSpaceInput;
  now?: () => Date;
  username?: string;
}

const SPACE_URL_BASE = "https://x.com/i/spaces/";
const POST_URL_BASE = "https://x.com/i/web/status/";

function problemDetail(problem: XApiProblem): string {
  return problem.detail ?? problem.message ?? problem.title ?? "X API error";
}

function problemId(problem: XApiProblem): string | undefined {
  return problem.resource_id ?? problem.value;
}

function toArtifactError(source: string, problem: XApiProblem): SpacesArtifactError {
  return {
    detail: problemDetail(problem),
    id: problemId(problem),
    source,
    status: problem.status,
    title: problem.title,
  };
}

function toThrownError(source: string, error: unknown): SpacesArtifactError {
  return {
    detail: error instanceof Error ? error.message : String(error),
    source,
  };
}

function mergeStringArrays(left?: string[], right?: string[]): string[] | undefined {
  const values = new Set([...(left ?? []), ...(right ?? [])]);
  return values.size > 0 ? [...values] : undefined;
}

function mergeSpace(existing: XSpace | undefined, next: XSpace): XSpace {
  if (!existing) {
    return next;
  }

  return {
    ...existing,
    ...next,
    host_ids: mergeStringArrays(existing.host_ids, next.host_ids),
    invited_user_ids: mergeStringArrays(existing.invited_user_ids, next.invited_user_ids),
    speaker_ids: mergeStringArrays(existing.speaker_ids, next.speaker_ids),
    topic_ids: mergeStringArrays(existing.topic_ids, next.topic_ids),
  };
}

function addUsers(usersById: Map<string, XUser>, users?: XUser[]): void {
  for (const user of users ?? []) {
    usersById.set(user.id, {
      ...usersById.get(user.id),
      ...user,
    });
  }
}

function addSourceForId(sourcesById: Map<string, Set<string>>, spaceId: string, source: string): void {
  const existing = sourcesById.get(spaceId);

  if (existing) {
    existing.add(source);
    return;
  }

  sourcesById.set(spaceId, new Set([source]));
}

function addResponseErrors(errors: SpacesArtifactError[], source: string, response: XSpacesResponse): void {
  for (const problem of response.errors ?? []) {
    errors.push(toArtifactError(source, problem));
  }
}

function addPostResponseErrors(errors: SpacesArtifactError[], source: string, response: XPostLookupResponse): void {
  for (const problem of response.errors ?? []) {
    errors.push(toArtifactError(source, problem));
  }
}

function addPostForSpace(postIdsBySpaceId: Map<string, Set<string>>, spaceId: string, postId: string): void {
  const existing = postIdsBySpaceId.get(spaceId);

  if (existing) {
    existing.add(postId);
    return;
  }

  postIdsBySpaceId.set(spaceId, new Set([postId]));
}

function mergePostReference(existing: SpacePostReference | undefined, next: SpacePostReference): SpacePostReference {
  if (!existing) {
    return next;
  }

  return {
    ...existing,
    ...next,
    author: next.author ?? existing.author,
    created_at: next.created_at ?? existing.created_at,
    line: existing.line ?? next.line,
    raw: existing.raw ?? next.raw,
    sources: [...new Set([...existing.sources, ...next.sources])].sort(),
    space_ids: [...new Set([...existing.space_ids, ...next.space_ids])],
    url: existing.url || next.url,
    username: existing.username ?? next.username,
  };
}

function addPostReference(
  postsById: Map<string, SpacePostReference>,
  postIdsBySpaceId: Map<string, Set<string>>,
  reference: SpacePostReference
): void {
  const merged = mergePostReference(postsById.get(reference.id), reference);
  postsById.set(reference.id, merged);

  for (const spaceId of merged.space_ids) {
    addPostForSpace(postIdsBySpaceId, spaceId, merged.id);
  }
}

function extractSpaceIdsFromPost(post: XPost): string[] {
  const ids = new Set<string>();

  for (const url of post.entities?.urls ?? []) {
    for (const candidate of [url.expanded_url, url.unwound_url, url.url]) {
      if (candidate) {
        extractSpaceIdsFromText(candidate).forEach((id) => ids.add(id));
      }
    }
  }

  extractSpaceIdsFromText(post.text).forEach((id) => ids.add(id));
  return [...ids];
}

function postUrl(postId: string, username?: string): string {
  return username ? `https://x.com/${username}/status/${postId}` : `${POST_URL_BASE}${postId}`;
}

function createInputPostReference(post: ParsedPostInputReference): SpacePostReference {
  return {
    id: post.id,
    line: post.line,
    raw: post.raw,
    sources: ["input"],
    space_ids: post.spaceIds,
    url: post.url,
    username: post.username,
  };
}

function createPostReferenceFromPost(
  post: XPost,
  usersById: Map<string, XUser>,
  source: string,
  existing?: SpacePostReference
): SpacePostReference {
  const author = post.author_id ? usersById.get(post.author_id) : undefined;
  const extractedSpaceIds = extractSpaceIdsFromPost(post);

  return {
    author,
    author_id: post.author_id,
    created_at: post.created_at,
    id: post.id,
    line: existing?.line,
    raw: existing?.raw,
    sources: [source],
    space_ids: [...new Set([...(existing?.space_ids ?? []), ...extractedSpaceIds])],
    text: post.text,
    url: existing?.url ?? postUrl(post.id, author?.username),
    username: existing?.username ?? author?.username,
  };
}

function addSpacesFromResponse(
  spacesById: Map<string, XSpace>,
  usersById: Map<string, XUser>,
  sourcesById: Map<string, Set<string>>,
  response: XSpacesResponse,
  source: string,
  filter?: (space: XSpace) => boolean
): number {
  addUsers(usersById, response.includes?.users);
  let count = 0;

  for (const space of response.data ?? []) {
    if (filter && !filter(space)) {
      continue;
    }

    spacesById.set(space.id, mergeSpace(spacesById.get(space.id), space));
    addSourceForId(sourcesById, space.id, source);
    count += 1;
  }

  return count;
}

function getSortTimestamp(space: XSpace): string {
  return space.started_at ?? space.scheduled_start ?? space.created_at ?? space.ended_at ?? "";
}

function hydrateSpaces(
  spacesById: Map<string, XSpace>,
  usersById: Map<string, XUser>,
  sourcesById: Map<string, Set<string>>,
  postsById: Map<string, SpacePostReference>,
  postIdsBySpaceId: Map<string, Set<string>>
): EnrichedSpace[] {
  const spaces: EnrichedSpace[] = [];

  for (const space of spacesById.values()) {
    spaces.push({
      ...space,
      creator: space.creator_id ? usersById.get(space.creator_id) : undefined,
      hosts: (space.host_ids ?? []).map((id) => usersById.get(id)).filter((user): user is XUser => Boolean(user)),
      invited_users: (space.invited_user_ids ?? []).map((id) => usersById.get(id)).filter((user): user is XUser => Boolean(user)),
      posts: [...(postIdsBySpaceId.get(space.id) ?? new Set<string>())]
        .map((postId) => postsById.get(postId))
        .filter((post): post is SpacePostReference => Boolean(post)),
      sources: [...(sourcesById.get(space.id) ?? new Set<string>())].sort(),
      speakers: (space.speaker_ids ?? []).map((id) => usersById.get(id)).filter((user): user is XUser => Boolean(user)),
      url: `${SPACE_URL_BASE}${space.id}`,
    });
  }

  spaces.sort((left, right) => getSortTimestamp(right).localeCompare(getSortTimestamp(left)) || left.id.localeCompare(right.id));
  return spaces;
}

async function tryResponse(
  errors: SpacesArtifactError[],
  source: string,
  callback: () => Promise<XSpacesResponse>
): Promise<XSpacesResponse> {
  try {
    const response = await callback();
    addResponseErrors(errors, source, response);
    return response;
  } catch (error) {
    errors.push(toThrownError(source, error));
    return { data: [], errors: [], includes: { users: [] } };
  }
}

async function tryPostResponse(
  errors: SpacesArtifactError[],
  source: string,
  callback: () => Promise<XPostLookupResponse>
): Promise<XPostLookupResponse> {
  try {
    const response = await callback();
    addPostResponseErrors(errors, source, response);
    return response;
  } catch (error) {
    errors.push(toThrownError(source, error));
    return { data: [], errors: [], includes: { users: [] } };
  }
}

export async function collectSpaces(options: CollectSpacesOptions): Promise<SpacesArtifact> {
  const generatedAt = (options.now ?? (() => new Date()))().toISOString();
  const spacesById = new Map<string, XSpace>();
  const postsById = new Map<string, SpacePostReference>();
  const postIdsBySpaceId = new Map<string, Set<string>>();
  const usersById = new Map<string, XUser>();
  const sourcesById = new Map<string, Set<string>>();
  const idsToLookup = new Set<string>();
  const postIdsToLookup = new Set<string>();
  const errors: SpacesArtifactError[] = [];
  const sources: SpacesArtifactSource[] = [];
  let inputIdCount = 0;
  let inputPostCount = 0;
  let user: XUser | undefined;

  if (options.input) {
    inputIdCount = options.input.ids.length;
    inputPostCount = options.input.postIds.length;

    for (const spaceId of options.input.ids) {
      idsToLookup.add(spaceId);
      addSourceForId(sourcesById, spaceId, "input");
    }

    for (const post of options.input.posts) {
      postIdsToLookup.add(post.id);
      addPostReference(postsById, postIdsBySpaceId, createInputPostReference(post));

      for (const spaceId of post.spaceIds) {
        idsToLookup.add(spaceId);
        addSourceForId(sourcesById, spaceId, "input-post");
      }
    }

    for (const invalid of options.input.invalidEntries) {
      errors.push({
        detail: invalid.error ?? "Invalid input line",
        source: options.input.path ? `input:${options.input.path}:${invalid.line}` : `input:${invalid.line}`,
      });
    }

    sources.push({
      discovered_ids: options.input.ids.length,
      invalid_lines: options.input.invalidEntries.length,
      label: options.input.path ?? "input",
      path: options.input.path,
      type: "input",
    });

    if (options.input.postIds.length > 0) {
      sources.push({
        label: "Post links from input",
        path: options.input.path,
        posts: options.input.postIds.length,
        type: "input-post",
      });
    }
  }

  if (postIdsToLookup.size > 0) {
    const postLookupResponse = await tryPostResponse(errors, "post-lookup", () => options.client.lookupPostsByIds([...postIdsToLookup]));
    addUsers(usersById, postLookupResponse.includes?.users);

    for (const post of postLookupResponse.data ?? []) {
      const existing = postsById.get(post.id);
      const reference = createPostReferenceFromPost(post, usersById, "post-lookup", existing);
      addPostReference(postsById, postIdsBySpaceId, reference);

      for (const spaceId of reference.space_ids) {
        idsToLookup.add(spaceId);
        addSourceForId(sourcesById, spaceId, "input-post");
      }
    }

    sources.push({
      discovered_ids: [...postIdsBySpaceId.keys()].length,
      label: "Post lookup by ID",
      posts: postLookupResponse.data?.length ?? 0,
      type: "post-lookup",
    });
  }

  if (options.username) {
    const username = options.username;

    try {
      const userResult = await options.client.getUserByUsername(username);
      user = userResult.user;
      usersById.set(user.id, user);
      userResult.errors.forEach((problem) => errors.push(toArtifactError("user", problem)));

      const creatorResponse = await tryResponse(errors, "user-creator", () => options.client.getSpacesByCreatorIds([user!.id]));
      const creatorCount = addSpacesFromResponse(spacesById, usersById, sourcesById, creatorResponse, "user-creator");

      sources.push({
        discovered_spaces: creatorCount,
        label: `Spaces created by @${username}`,
        type: "user-creator",
        user_id: user.id,
        username,
      });

      const searchResponse = await tryResponse(errors, "space-search", () => options.client.searchSpaces(username));
      const belongsToUser = (space: XSpace): boolean => space.creator_id === user!.id || (space.host_ids ?? []).includes(user!.id);
      const searchCount = addSpacesFromResponse(spacesById, usersById, sourcesById, searchResponse, "space-search", belongsToUser);

      sources.push({
        discovered_spaces: searchCount,
        label: `Space search for @${username}`,
        query: username,
        type: "space-search",
        username,
      });

      try {
        const recentResult = await options.client.searchRecentPostsForSpaceLinks(username);
        const recentSpaceIds = new Set(recentResult.spaceIds);

        addUsers(usersById, recentResult.users);
        recentResult.errors.forEach((problem) => errors.push(toArtifactError("recent-post-search", problem)));

        for (const tweet of recentResult.tweets) {
          const reference = createPostReferenceFromPost(tweet, usersById, "recent-post-search");
          addPostReference(postsById, postIdsBySpaceId, reference);

          for (const spaceId of reference.space_ids) {
            recentSpaceIds.add(spaceId);
          }
        }

        for (const spaceId of recentSpaceIds) {
          idsToLookup.add(spaceId);
          addSourceForId(sourcesById, spaceId, "recent-post-search");
        }

        sources.push({
          discovered_ids: recentResult.spaceIds.length,
          label: `Recent posts by @${username}`,
          posts: recentResult.tweets.length,
          query: `from:${username} space links`,
          type: "recent-post-search",
          username,
        });
      } catch (error) {
        errors.push(toThrownError("recent-post-search", error));
        sources.push({
          discovered_ids: 0,
          label: `Recent posts by @${username}`,
          posts: 0,
          query: `from:${username} space links`,
          type: "recent-post-search",
          username,
        });
      }
    } catch (error) {
      errors.push(toThrownError("user", error));
    }
  }

  const missingIds = [...idsToLookup].filter((spaceId) => !spacesById.has(spaceId));

  if (missingIds.length > 0) {
    const lookupResponse = await tryResponse(errors, "lookup", () => options.client.lookupSpacesByIds(missingIds));
    const lookupCount = addSpacesFromResponse(spacesById, usersById, sourcesById, lookupResponse, "lookup");

    sources.push({
      discovered_ids: missingIds.length,
      discovered_spaces: lookupCount,
      label: "Space lookup by ID",
      type: "lookup",
    });
  }

  const spaces = hydrateSpaces(spacesById, usersById, sourcesById, postsById, postIdsBySpaceId);
  const posts = [...postsById.values()].sort(
    (left, right) =>
      (right.created_at ?? "").localeCompare(left.created_at ?? "")
      || (left.line ?? Number.MAX_SAFE_INTEGER) - (right.line ?? Number.MAX_SAFE_INTEGER)
      || left.id.localeCompare(right.id)
  );

  return {
    errors,
    generated_at: generatedAt,
    posts,
    sources,
    spaces,
    totals: {
      errors: errors.length,
      input_ids: inputIdCount,
      input_posts: inputPostCount,
      posts: posts.length,
      spaces: spaces.length,
      unique_ids: sourcesById.size,
      users: usersById.size,
    },
    user,
  };
}
