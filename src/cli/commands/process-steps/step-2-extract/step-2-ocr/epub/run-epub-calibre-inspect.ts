import type { EpubInspectOutput } from '~/types'
import { runEpubZipInspect } from './run-epub-bun-inspect'

export const runEpubCalibreInspect = async (filePath: string): Promise<EpubInspectOutput> =>
  await runEpubZipInspect(filePath, 'calibre')
