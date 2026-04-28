export interface XApiProblem {
  detail?: string | undefined;
  message?: string | undefined;
  resource_id?: string | undefined;
  resource_type?: string | undefined;
  status?: number | undefined;
  title?: string | undefined;
  type?: string | undefined;
  value?: string | undefined;
}

export interface XUser {
  created_at?: string | undefined;
  description?: string | undefined;
  id: string;
  location?: string | undefined;
  name?: string | undefined;
  profile_image_url?: string | undefined;
  protected?: boolean | undefined;
  public_metrics?: Record<string, number> | undefined;
  url?: string | undefined;
  username?: string | undefined;
  verified?: boolean | undefined;
  verified_type?: string | undefined;
}

export interface XSpace {
  created_at?: string | undefined;
  creator_id?: string | undefined;
  ended_at?: string | undefined;
  host_ids?: string[] | undefined;
  id: string;
  invited_user_ids?: string[] | undefined;
  is_ticketed?: boolean | string | undefined;
  lang?: string | undefined;
  participant_count?: number | undefined;
  scheduled_start?: string | undefined;
  speaker_ids?: string[] | undefined;
  started_at?: string | undefined;
  state?: string | undefined;
  subscriber_count?: number | undefined;
  title?: string | undefined;
  topic_ids?: string[] | undefined;
  updated_at?: string | undefined;
}

export interface XPostUrlEntity {
  display_url?: string | undefined;
  expanded_url?: string | undefined;
  unwound_url?: string | undefined;
  url?: string | undefined;
}

export interface XPost {
  author_id?: string | undefined;
  created_at?: string | undefined;
  entities?: {
    urls?: XPostUrlEntity[] | undefined;
  } | undefined;
  id: string;
  text: string;
}

export interface XIncludes {
  tweets?: XPost[] | undefined;
  users?: XUser[] | undefined;
}

export interface XListMeta {
  newest_id?: string | undefined;
  next_token?: string | undefined;
  oldest_id?: string | undefined;
  result_count?: number | undefined;
}

export interface XUserLookupResponse {
  data?: XUser | undefined;
  errors?: XApiProblem[] | undefined;
  includes?: XIncludes | undefined;
}

export interface XSpacesResponse {
  data?: XSpace[] | undefined;
  errors?: XApiProblem[] | undefined;
  includes?: XIncludes | undefined;
  meta?: XListMeta | undefined;
}

export interface XPostSearchResponse {
  data?: XPost[] | undefined;
  errors?: XApiProblem[] | undefined;
  includes?: XIncludes | undefined;
  meta?: XListMeta | undefined;
}

export interface XPostLookupResponse {
  data?: XPost[] | undefined;
  errors?: XApiProblem[] | undefined;
  includes?: XIncludes | undefined;
}

export interface RecentSpaceLinkSearchResult {
  errors: XApiProblem[];
  spaceIds: string[];
  tweets: XPost[];
  users: XUser[];
}

export interface SpacesClientContract {
  getUserByUsername(username: string): Promise<{ errors: XApiProblem[]; user: XUser }>;
  getSpacesByCreatorIds(userIds: string[]): Promise<XSpacesResponse>;
  lookupPostsByIds(postIds: string[]): Promise<XPostLookupResponse>;
  lookupSpacesByIds(spaceIds: string[]): Promise<XSpacesResponse>;
  searchRecentPostsForSpaceLinks(username: string): Promise<RecentSpaceLinkSearchResult>;
  searchSpaces(query: string): Promise<XSpacesResponse>;
}

export type SpaceInputEntrySource = "input";

export interface ParsedSpaceInputEntry {
  line: number;
  raw: string;
  source: SpaceInputEntrySource;
  spaceId?: string | undefined;
  spaceIds: string[];
  postId?: string | undefined;
  postReferences: ParsedPostInputReference[];
  error?: string | undefined;
}

export interface ParsedPostInputReference {
  id: string;
  line: number;
  raw: string;
  spaceIds: string[];
  source: SpaceInputEntrySource;
  url: string;
  username?: string | undefined;
}

export interface ParsedSpaceInput {
  entries: ParsedSpaceInputEntry[];
  ids: string[];
  invalidEntries: ParsedSpaceInputEntry[];
  path?: string | undefined;
  postIds: string[];
  posts: ParsedPostInputReference[];
}

export type SpacesArtifactSourceType =
  | "input"
  | "input-post"
  | "lookup"
  | "post-lookup"
  | "recent-post-search"
  | "space-search"
  | "user-creator";

export interface SpacesArtifactSource {
  discovered_ids?: number | undefined;
  discovered_spaces?: number | undefined;
  invalid_lines?: number | undefined;
  label: string;
  path?: string | undefined;
  posts?: number | undefined;
  query?: string | undefined;
  type: SpacesArtifactSourceType;
  user_id?: string | undefined;
  username?: string | undefined;
}

export interface SpacesArtifactError {
  detail: string;
  id?: string | undefined;
  source: string;
  status?: number | undefined;
  title?: string | undefined;
}

export interface EnrichedSpace extends XSpace {
  creator?: XUser | undefined;
  hosts: XUser[];
  invited_users: XUser[];
  posts: SpacePostReference[];
  sources: string[];
  speakers: XUser[];
  url: string;
}

export interface SpacePostReference {
  author?: XUser | undefined;
  author_id?: string | undefined;
  created_at?: string | undefined;
  id: string;
  line?: number | undefined;
  raw?: string | undefined;
  sources: string[];
  space_ids: string[];
  text?: string | undefined;
  url: string;
  username?: string | undefined;
}

export interface SpacesArtifactTotals {
  errors: number;
  input_ids: number;
  input_posts: number;
  posts: number;
  spaces: number;
  unique_ids: number;
  users: number;
}

export interface SpacesArtifact {
  errors: SpacesArtifactError[];
  generated_at: string;
  posts: SpacePostReference[];
  sources: SpacesArtifactSource[];
  spaces: EnrichedSpace[];
  totals: SpacesArtifactTotals;
  user?: XUser | undefined;
}
