export {
  EXIT_SUCCESS,
  EXIT_ERROR,
  EXIT_USAGE,
  EXIT_API,
  EXIT_IO
} from './exit-codes.ts'

export {
  initCliContext,
  getCliContext,
  resetCliContext,
  DEFAULT_NETWORK_CONFIG,
  type CliContext,
  type OutputFormat,
  type NetworkConfig
} from './cli-context.ts'

export {
  createSpinner,
  type SpinnerOptions
} from './spinner.ts'

export {
  withPager,
  wouldUsePager
} from './pager.ts'

export {
  createJsonOutput,
  setJsonError,
  outputJson,
  isJsonMode,
  type JsonOutput,
  type JsonOutputBase,
  type JsonOutputBuilder,
  type TextJsonOutput,
  type TtsJsonOutput,
  type ImageJsonOutput,
  type VideoJsonOutput,
  type MusicJsonOutput,
  type MediaJsonOutput,
  type ExtractJsonOutput
} from './json-output.ts'

export {
  loadApiKey,
  requireApiKey
} from './load-api-key.ts'

export {
  deprecate,
  createDeprecatedFlagHandler,
  resetDeprecationWarnings,
  type DeprecationInfo
} from './deprecation.ts'

export {
  createBatchProgress,
  formatBatchProgress,
  type BatchProgress,
  type BatchProgressOptions,
  type BatchSummary
} from './batch-progress.ts'

export {
  checkDependency,
  requireDependency,
  checkDependencies,
  listDependencyStatus,
  DEPENDENCIES,
  type DependencyInfo,
  type DependencyCheckResult
} from './dependencies.ts'

export {
  installSignalHandlers,
  registerProcess,
  registerTempDir,
  registerAbortController,
  registerCleanup,
  isCancelled,
  resetSignalHandler,
  getRegistryCounts,
  EXIT_SIGINT
} from './signal-handler.ts'

export {
  getConfigDir,
  getDataDir,
  getCacheDir,
  getTempDir,
  getUserConfigPath,
  loadUserConfig,
  saveUserConfig,
  getUserApiKey,
  setUserApiKey,
  getUserVoice,
  hasUserConfig,
  ensureXdgDirs,
  type UserConfig
} from './xdg-paths.ts'
