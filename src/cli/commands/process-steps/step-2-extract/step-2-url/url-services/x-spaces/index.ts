export { XApiClient, XApiError } from "./client";
export { collectSpaces } from "./collect";
export {
  createInputErrors,
  extractPostReferencesFromText,
  extractSpaceIdsFromText,
  isSpaceId,
  normalizeUsername,
  parseSpaceInput,
  validateUsername,
} from "./input";
export { renderSpacesJson, renderSpacesMarkdown } from "./report";
export type {
  EnrichedSpace,
  ParsedPostInputReference,
  ParsedSpaceInput,
  ParsedSpaceInputEntry,
  RecentSpaceLinkSearchResult,
  SpacePostReference,
  SpacesArtifact,
  SpacesArtifactError,
  SpacesArtifactSource,
  SpacesClientContract,
  XApiProblem,
  XIncludes,
  XPost,
  XPostSearchResponse,
  XSpace,
  XSpacesResponse,
  XUser,
} from "./types";
