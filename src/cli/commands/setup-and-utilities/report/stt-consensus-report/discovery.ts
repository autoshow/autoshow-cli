import { discoverRunDirectories } from '~/cli/commands/setup-and-utilities/report/report-internals/run-discovery'

export const discoverAnalyzableRunDirectories = async (targetPath: string): Promise<string[]> =>
  discoverRunDirectories(
    targetPath,
    (resolvedTarget) => `No STT output runs found under ${resolvedTarget}`
  )
