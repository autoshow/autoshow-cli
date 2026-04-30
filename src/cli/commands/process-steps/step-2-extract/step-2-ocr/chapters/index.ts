export { buildPdfChapterArtifacts } from './artifacts'
export {
  dedupeResolvedChapters,
  findDetectedHeadingAnchorPage,
  findTitleAnchorPage,
  parsePdfOutline,
  resolveLocalPdfChapterDetection,
  scoreOverallConfidence
} from './detection'
export {
  buildPageLabelSpans,
  buildTextPageMapSpans,
  extractPrintedPageCandidates,
  mergePageMapSpans,
  parsePdfPageLabels
} from './page-map'
export { parseTocEntriesFromPage } from './toc'
