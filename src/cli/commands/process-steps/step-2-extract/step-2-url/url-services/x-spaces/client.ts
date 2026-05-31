import { extractSpaceIdsFromText } from "./input";
import type {
  RecentSpaceLinkSearchResult,
  SpacesClientContract,
  XApiProblem,
  XPost,
  XPostLookupResponse,
  XPostSearchResponse,
  XSpacesResponse,
  XUser,
  XUserLookupResponse,
} from "./types";

const DEFAULT_BASE_URL = "https://api.x.com";
const SPACE_FIELDS = [
  "created_at",
  "creator_id",
  "ended_at",
  "host_ids",
  "id",
  "invited_user_ids",
  "is_ticketed",
  "lang",
  "participant_count",
  "scheduled_start",
  "speaker_ids",
  "started_at",
  "state",
  "subscriber_count",
  "title",
  "topic_ids",
  "updated_at",
].join(",");
const SPACE_EXPANSIONS = "creator_id,host_ids,invited_user_ids,speaker_ids";
const USER_FIELDS = [
  "created_at",
  "description",
  "id",
  "location",
  "name",
  "profile_image_url",
  "protected",
  "public_metrics",
  "url",
  "username",
  "verified",
  "verified_type",
].join(",");
const TWEET_FIELDS = "author_id,created_at,entities";

class XApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseText: string
  ) {
    super(message);
    this.name = "XApiError";
  }
}

interface XApiClientOptions {
  baseUrl?: string;
  bearerToken: string;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
  verbose?: boolean;
}

function problemMessage(problem: XApiProblem): string {
  return problem.detail ?? problem.message ?? problem.title ?? "X API error";
}

function getResponseDetail(data: unknown, fallback: string): string {
  if (typeof data === "object" && data !== null) {
    const body = data as {
      detail?: string;
      errors?: XApiProblem[];
      message?: string;
      title?: string;
    };
    const firstError = body.errors?.[0];
    return body.detail ?? body.message ?? body.title ?? (firstError ? problemMessage(firstError) : fallback);
  }

  return fallback;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

type MergeableXListResponse<TData> = {
  data?: TData[] | undefined;
  errors?: XApiProblem[] | undefined;
  includes?: {
    users?: XUser[] | undefined;
  } | undefined;
};

function mergeXListResponse<TData, TResponse extends MergeableXListResponse<TData>>(
  target: TResponse,
  response: TResponse
): void {
  target.data ??= [];
  target.includes ??= {};
  target.includes.users ??= [];
  target.errors ??= [];

  if (response.data) {
    target.data.push(...response.data);
  }

  if (response.includes?.users) {
    target.includes.users.push(...response.includes.users);
  }

  if (response.errors) {
    target.errors.push(...response.errors);
  }
}

export class XApiClient implements SpacesClientContract {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: XApiClientOptions) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getUserByUsername(username: string) {
    const response = await this.xGet<XUserLookupResponse>(
      `/2/users/by/username/${encodeURIComponent(username)}`,
      {
        "user.fields": USER_FIELDS,
      }
    );

    if (!response.data) {
      const detail = response.errors?.map(problemMessage).join("; ") || `User @${username} not found`;
      throw new Error(detail);
    }

    return {
      errors: response.errors ?? [],
      user: response.data,
    };
  }

  async getSpacesByCreatorIds(userIds: string[]): Promise<XSpacesResponse> {
    if (userIds.length === 0) {
      return { data: [], errors: [], includes: { users: [] } };
    }

    const combined: XSpacesResponse = { data: [], errors: [], includes: { users: [] } };

    for (const userIdBatch of chunk(userIds, 100)) {
      mergeXListResponse(
        combined,
        await this.xGet<XSpacesResponse>("/2/spaces/by/creator_ids", {
          expansions: SPACE_EXPANSIONS,
          "space.fields": SPACE_FIELDS,
          "user.fields": USER_FIELDS,
          user_ids: userIdBatch.join(","),
        })
      );
    }

    return combined;
  }

  async lookupSpacesByIds(spaceIds: string[]): Promise<XSpacesResponse> {
    if (spaceIds.length === 0) {
      return { data: [], errors: [], includes: { users: [] } };
    }

    const combined: XSpacesResponse = { data: [], errors: [], includes: { users: [] } };

    for (const spaceIdBatch of chunk(spaceIds, 100)) {
      mergeXListResponse(
        combined,
        await this.xGet<XSpacesResponse>("/2/spaces", {
          expansions: SPACE_EXPANSIONS,
          ids: spaceIdBatch.join(","),
          "space.fields": SPACE_FIELDS,
          "user.fields": USER_FIELDS,
        })
      );
    }

    return combined;
  }

  async lookupPostsByIds(postIds: string[]): Promise<XPostLookupResponse> {
    if (postIds.length === 0) {
      return { data: [], errors: [], includes: { users: [] } };
    }

    const combined: XPostLookupResponse = { data: [], errors: [], includes: { users: [] } };

    for (const postIdBatch of chunk(postIds, 100)) {
      mergeXListResponse(
        combined,
        await this.xGet<XPostLookupResponse>("/2/tweets", {
          expansions: "author_id",
          ids: postIdBatch.join(","),
          "tweet.fields": TWEET_FIELDS,
          "user.fields": USER_FIELDS,
        })
      );
    }

    return combined;
  }

  async searchSpaces(query: string): Promise<XSpacesResponse> {
    return this.xGet<XSpacesResponse>("/2/spaces/search", {
      expansions: SPACE_EXPANSIONS,
      max_results: "100",
      query,
      "space.fields": SPACE_FIELDS,
      state: "all",
      "user.fields": USER_FIELDS,
    });
  }

  async searchRecentPostsForSpaceLinks(username: string): Promise<RecentSpaceLinkSearchResult> {
    const tweets: XPost[] = [];
    const users: XUser[] = [];
    const errors: XApiProblem[] = [];
    const spaceIds = new Set<string>();
    let nextToken: string | undefined;

    do {
      const params: Record<string, string> = {
        expansions: "author_id",
        max_results: "100",
        query: `from:${username} (url:"x.com/i/spaces" OR url:"twitter.com/i/spaces")`,
        "tweet.fields": TWEET_FIELDS,
        "user.fields": USER_FIELDS,
      };

      if (nextToken) {
        params['next_token'] = nextToken;
      }

      const response = await this.xGet<XPostSearchResponse>("/2/tweets/search/recent", params);

      if (response.data) {
        tweets.push(...response.data);

        for (const tweet of response.data) {
          for (const url of tweet.entities?.urls ?? []) {
            for (const candidate of [url.expanded_url, url.unwound_url, url.url]) {
              if (candidate) {
                extractSpaceIdsFromText(candidate).forEach((id) => spaceIds.add(id));
              }
            }
          }

          extractSpaceIdsFromText(tweet.text).forEach((id) => spaceIds.add(id));
        }
      }

      if (response.includes?.users) {
        users.push(...response.includes.users);
      }

      if (response.errors) {
        errors.push(...response.errors);
      }

      nextToken = response.meta?.['next_token'];
    } while (nextToken);

    return {
      errors,
      spaceIds: [...spaceIds],
      tweets,
      users,
    };
  }

  private async xGet<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    if (this.options.verbose) {
      this.options.log?.(`[spaces] GET ${url.toString()}`);
      this.options.log?.("[spaces] Authorization: Bearer <redacted>");
    }

    const response = await this.fetchImpl(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.options.bearerToken}`,
      },
    });
    const responseText = await response.text();

    if (this.options.verbose) {
      this.options.log?.(`[spaces] ${response.status} ${response.statusText}`);
      this.options.log?.(`[spaces] rate-limit-remaining: ${response.headers.get("x-rate-limit-remaining") ?? "unknown"}`);
    }

    let data: unknown;

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new XApiError(`Non-JSON response (${response.status}): ${responseText.slice(0, 300)}`, response.status, responseText);
    }

    if (!response.ok) {
      const detail = getResponseDetail(data, responseText.slice(0, 300));
      throw new XApiError(`HTTP ${response.status}: ${detail}`, response.status, responseText);
    }

    return data as T;
  }
}
