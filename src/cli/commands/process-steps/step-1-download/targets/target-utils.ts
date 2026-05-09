export { buildOptsFromFlags } from './build-opts-from-flags'
export {
  DOCUMENT_EXTENSIONS,
  IMAGE_EXTENSIONS,
  classifyInputFamily,
  classifyUrlInput,
  isDocumentByExtension,
  isDocumentLikeTarget,
  isHtmlArticleTarget,
  isHtmlDocumentPath,
  isLikelyUrl
} from './input/input-classifier'
export {
  classifyTopLevelTarget,
  collectInputFiles,
  isDirectoryPath,
  isInputDirectoryPath,
  isUrlListFilePath,
  readInputList
} from './input/input-collection'
export { describeUnsupportedInputForCommand, resolveInputRoutingForCommand } from './routing/input-routing'
export { getBatchManifestErrorCount, getBatchManifestErrors } from './batch/batch-manifest'
export {
  buildBatchCompletionTable,
  buildBatchPartialFailureTable,
  buildSttBatchFinalSummaryTable,
  logSttBatchFinalSummary
} from './batch/batch-summary'
export { planBatchInputsForCommand } from './batch/batch-planner'
export { processBatch } from './batch/process-batch'
