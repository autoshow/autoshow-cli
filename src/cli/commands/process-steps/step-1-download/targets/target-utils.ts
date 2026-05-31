export { buildOptsFromFlags } from './build-opts-from-flags'
export {
  DOCUMENT_EXTENSIONS,
  IMAGE_EXTENSIONS,
  classifyInputFamily,
  classifyUrlInput,
  isDocumentLikeTarget,
  isHtmlArticleTarget,
  isLikelyUrl
} from './source-input/input-classifier'
export {
  classifyTopLevelTarget,
  collectInputFiles,
  isInputDirectoryPath,
  readInputList
} from './source-input/input-collection'
export { resolveInputRoutingForCommand } from './routing/input-routing'
export { logSttBatchFinalSummary } from './batch/batch-summary'
export { planBatchInputsForCommand } from './batch/batch-planner'
export { processBatch } from './batch/process-batch'
