import { l, err, logSeparator, logInitialFunctionCall } from '@/logging'
import { basename } from '@/node-utils'
import { processRSS } from './index.ts'
import { logCopy, logMkdir, logFindMove, logRemove, logMoveMd } from './rss-logging.ts'
import { ensureWorkflowDirectories, validateFeedsFile } from './rss-validation.ts'
import type { ProcessingOptions } from '@/text/text-types'

const WORKFLOWS_DIR = 'output/workflows'

async function copyFeeds(): Promise<void> {
  await logCopy(`./${WORKFLOWS_DIR}/feeds`, './output', 'copyFeeds', 'feeds folder copied to ./output')
}

async function removeDailySubfolder(dirName: string, subfolder: string): Promise<void> {
  await logRemove(`./${WORKFLOWS_DIR}/${dirName}/${subfolder}`, 'removeDailySubfolder', `subfolder: ${subfolder} from ./${WORKFLOWS_DIR}/${dirName}`)
}

async function copyBackToDaily(dirName: string, subfolder: string): Promise<void> {
  await logCopy(`./output/${subfolder}`, `./${WORKFLOWS_DIR}/${dirName}`, 'copyBackToDaily', `${subfolder} copied to ./${WORKFLOWS_DIR}/${dirName}`)
}

export function extractDirectoryName(feedFilename: string): string {
  const p = '[text/process-commands/rss/workflows]'
  
  const baseName = basename(feedFilename)
  const dirName = baseName.replace(/-feeds\.md$/i, '')
  
  if (dirName === baseName) {
    err(`${p} Invalid feed filename format. Expected format: "XX-name-feeds.md"`)
    throw new Error('Feed filename must end with "-feeds.md"')
  }
  
  return dirName
}

export async function prepareShownotes(dirName: string, feedFilename: string, options: ProcessingOptions): Promise<void> {
  const p = '[text/process-commands/rss/workflows]'
  logInitialFunctionCall('prepareShownotes', { dirName, feedFilename, options })
  const subfolder = `${dirName}-shownotes`
  
  const filterInfo = []
  if (options.date && options.date.length > 0) {
    filterInfo.push(`dates: ${options.date.join(', ')}`)
  }
  if (options.days !== undefined) {
    filterInfo.push(`last ${options.days} days`)
  }
  if (options.last !== undefined) {
    filterInfo.push(`last ${options.last} items`)
  }
  const filterString = filterInfo.length > 0 ? filterInfo.join(', ') : 'latest available'
  
  l.dim(`${p} Processing shownotes for ${dirName} with ${filterString}`)
  
  await copyFeeds()
  await logMkdir(`./output/${subfolder}`, 'createDirectoryForShownotes')
  
  const rssOptions: ProcessingOptions = {
    ...options,
    rss: [`./output/feeds/${feedFilename}`],
    whisperCoreml: options.whisperCoreml || 'large-v3-turbo',
    feed: undefined,
    metaInfo: undefined
  }
  
  try {
    await processRSS(rssOptions, rssOptions.llmServices, rssOptions.transcriptServices)
  } catch (e) {
    err(`${p} Error during RSS processing for shownotes: ${(e as Error).message}`)
    throw e
  }
  
  await logFindMove('.md', './output', `./output/${subfolder}`, 'moveGeneratedMdToSubfolder')
  await logMoveMd(subfolder, dirName, 'moveShownotesToSource')
  await logRemove('./output/feeds', 'cleanupShownotes', 'feeds folder from ./output')
  await logRemove(`./output/${subfolder}`, 'cleanupShownotes', `${subfolder} from ./output`)
  
  l.final(`${p} prepareShownotes completed for ${dirName}`)
}

export async function prepareInfo(dirName: string, feedFilename: string): Promise<void> {
  const p = '[text/process-commands/rss/workflows]'
  logInitialFunctionCall('prepareInfo', { dirName, feedFilename })
  const subfolder = `${dirName}-info`
  
  await copyFeeds()
  await logMkdir(`./output/${subfolder}`, 'createDirectoryForInfo')
  
  const rssOptions: ProcessingOptions = {
    info: true,
    rss: [`./output/feeds/${feedFilename}`],
  }
  
  try {
    await processRSS(rssOptions)
  } catch (e) {
    err(`${p} Error during RSS processing for info: ${(e as Error).message}`)
    throw e
  }
  
  await logFindMove('.json', './output', `./output/${subfolder}`, 'moveGeneratedJsonToSubfolder')
  await removeDailySubfolder(dirName, subfolder)
  await copyBackToDaily(dirName, subfolder)
  await logRemove('./output/feeds', 'cleanupInfo', 'feeds folder from ./output')
  await logRemove(`./output/${subfolder}`, 'cleanupInfo', `${subfolder} from ./output`)
  
  l.final(`${p} prepareInfo completed for ${dirName}`)
}

export async function handleWorkflow(options: ProcessingOptions): Promise<boolean> {
  const p = '[text/process-commands/rss/workflows]'
  const feedFilename = options.feed
  
  if (!feedFilename) {
    return false
  }
  
  const dirName = extractDirectoryName(feedFilename)
  
  if (!validateFeedsFile(feedFilename)) {
    console.log('')
    err(`Error: Required feed file not found.`)
    console.log('')
    l.warn('To get started, run these commands:')
    console.log('')
    console.log(`  mkdir -p ${WORKFLOWS_DIR}/feeds`)
    console.log(`  echo 'https://feeds.megaphone.fm/MLN2155636147' > ${WORKFLOWS_DIR}/feeds/${feedFilename}`)
    console.log('')
    process.exit(1)
  }
  
  await ensureWorkflowDirectories(dirName)
  
  try {
    if (options.metaInfo) {
      l.final(`${p} Running workflow with both Info and Shownotes for ${dirName} from ${WORKFLOWS_DIR}`)
      await prepareInfo(dirName, feedFilename)
      logSeparator({ type: 'completion', descriptor: `Workflow Info for ${dirName}` })
    } else {
      l.final(`${p} Running workflow: Shownotes only for ${dirName} from ${WORKFLOWS_DIR}`)
    }
    
    await prepareShownotes(dirName, feedFilename, options)
    logSeparator({ type: 'completion', descriptor: `Workflow Shownotes for ${dirName}` })
    
    return true
  } catch (error) {
    err(`${p} Error in workflow for ${dirName}: ${(error as Error).message}`)
    process.exit(1)
  }
}