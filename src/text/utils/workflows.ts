import { l, err, logSeparator, logInitialFunctionCall } from '@/logging'
import { execPromise, mkdirSync, existsSync, basename } from '@/node-utils'
import { processRSS } from '../process-commands/rss'
import type { ProcessingOptions } from '@/types'

const WORKFLOWS_DIR = 'output/workflows'

export async function logOperation(
  command: string,
  operationName: string,
  logFn: any,
  description: string
): Promise<void> {
  const p = '[text/utils/workflows]'
  console.log('')
  logFn(`${p}[${operationName}] Starting ${operationName}: ${description}`)
  logFn(`${p}[${operationName}] Executing command: ${command}`)
  try {
    const { stdout, stderr } = await execPromise(command)
    logFn(`${p}[${operationName}] stdout:`)
    console.log(stdout)
    if (stderr) {
      l.warn(`${p}[${operationName}] stderr:`)
      console.warn(stderr)
    }
    logFn(`${p}[${operationName}] Successfully finished ${operationName}: ${description}`)
  } catch (error: any) {
    err(`${p}[${operationName}] Error during ${operationName}: ${error.message}`)
    throw error
  }
}

export async function logCopy(source: string, destination: string, operationName: string, successMessage: string): Promise<void> {
  await logOperation(`cp -R "${source}" "${destination}"`, operationName, l, successMessage)
}

export async function logMkdir(targetPath: string, operationName: string): Promise<void> {
  const p = '[text/utils/workflows]'
  console.log('')
  l(`${p}[${operationName}] Starting ${operationName}: Creating directory ${targetPath}`)
  try {
    if (!existsSync(targetPath)) {
      mkdirSync(targetPath, { recursive: true })
      l(`${p}[${operationName}] Successfully created directory: ${targetPath}`)
    } else {
      l(`${p}[${operationName}] Directory already exists: ${targetPath}`)
    }
  } catch (error: any) {
    err(`${p}[${operationName}] Error creating directory ${targetPath}: ${error.message}`)
    throw error
  }
}

export async function logFindMove(extension: string, sourceFolder: string, destFolder: string, operationName: string): Promise<void> {
  const command = `find "${sourceFolder}" -maxdepth 1 -type f -name '*${extension}' -exec mv {} "${destFolder}/" \\;`
  await logOperation(command, operationName, l, `Moving *${extension} files from ${sourceFolder} to ${destFolder}`)
}

export async function logRemove(targetPath: string, operationName: string, extraDescription: string): Promise<void> {
  await logOperation(`rm -rf "${targetPath}"`, operationName, l, `Removing ${extraDescription} (${targetPath})`)
}

export async function logMoveMd(subfolder: string, dirName: string, operationName: string): Promise<void> {
  const sourcePath = `./content/${subfolder}`
  const destPath = `./${WORKFLOWS_DIR}/${dirName}/${subfolder}/`
  await logMkdir(destPath, `${operationName} (ensure_dest)`)
  const command = `find "${sourcePath}" -maxdepth 1 -type f -name '*.md' -exec mv {} "${destPath}" \\;`
  await logOperation(command, operationName, l, `Moving .md files from ${sourcePath} to ${destPath}`)
}

async function copyFeeds(): Promise<void> {
  await logCopy(`./${WORKFLOWS_DIR}/feeds`, './content', 'copyFeeds', 'feeds folder copied to ./content')
}

async function removeDailySubfolder(dirName: string, subfolder: string): Promise<void> {
  await logRemove(`./${WORKFLOWS_DIR}/${dirName}/${subfolder}`, 'removeDailySubfolder', `subfolder: ${subfolder} from ./${WORKFLOWS_DIR}/${dirName}`)
}

async function copyBackToDaily(dirName: string, subfolder: string): Promise<void> {
  await logCopy(`./content/${subfolder}`, `./${WORKFLOWS_DIR}/${dirName}`, 'copyBackToDaily', `${subfolder} copied to ./${WORKFLOWS_DIR}/${dirName}`)
}

function extractDirectoryName(feedFilename: string): string {
  const p = '[text/utils/workflows]'
  l.dim(`${p} Extracting directory name from feed filename: ${feedFilename}`)
  
  const baseName = basename(feedFilename)
  const dirName = baseName.replace(/-feeds\.md$/i, '')
  
  if (dirName === baseName) {
    err(`${p} Invalid feed filename format. Expected format: "XX-name-feeds.md"`)
    throw new Error('Feed filename must end with "-feeds.md"')
  }
  
  l.dim(`${p} Extracted directory name: ${dirName}`)
  return dirName
}

async function ensureWorkflowDirectories(dirName: string): Promise<void> {
  const p = '[text/utils/workflows]'
  l.dim(`${p} Ensuring workflow directories for: ${dirName}`)
  
  const directories = [
    `${WORKFLOWS_DIR}/${dirName}`,
    `${WORKFLOWS_DIR}/${dirName}/${dirName}-info`,
    `${WORKFLOWS_DIR}/${dirName}/${dirName}-shownotes`
  ]
  
  for (const dir of directories) {
    await logMkdir(dir, 'ensureWorkflowDirectories')
  }
}

function validateFeedsFile(feedFilename: string): boolean {
  const p = '[text/utils/workflows]'
  const feedsDir = `./${WORKFLOWS_DIR}/feeds`
  const feedFile = `${feedsDir}/${feedFilename}`
  
  l.dim(`${p} Checking for feeds directory at: ${feedsDir}`)
  
  if (!existsSync(feedsDir)) {
    l.warn(`${p} Feeds directory not found at ${feedsDir}`)
    return false
  }
  
  l.dim(`${p} Checking for feed file at: ${feedFile}`)
  
  if (!existsSync(feedFile)) {
    l.warn(`${p} Feed file not found at ${feedFile}`)
    return false
  }
  
  l.dim(`${p} Feed file validation successful`)
  return true
}

export async function prepareShownotes(dirName: string, feedFilename: string, dateParams: string[] | undefined): Promise<void> {
  const p = '[text/utils/workflows]'
  logInitialFunctionCall('prepareShownotes', { dirName, feedFilename, dateParams })
  const subfolder = `${dirName}-shownotes`
  
  l.dim(`${p} Preparing to process shownotes for ${dirName} with dates: ${dateParams ? dateParams.join(', ') : 'latest available'}`)
  
  await copyFeeds()
  await logMkdir(`./content/${subfolder}`, 'createDirectoryForShownotes')
  
  const rssOptions: ProcessingOptions = {
    rss: [`./content/feeds/${feedFilename}`],
    whisperCoreml: 'large-v3-turbo',
  }
  
  if (dateParams && dateParams.length > 0) {
    l.dim(`${p} Setting date parameters: ${dateParams.join(', ')}`)
    rssOptions.date = dateParams
  }
  
  try {
    await processRSS(rssOptions, rssOptions.llmServices, rssOptions.transcriptServices)
  } catch (e) {
    err(`${p} Error during RSS processing for shownotes: ${(e as Error).message}`)
    throw e
  }
  
  await logFindMove('.md', './content', `./content/${subfolder}`, 'moveGeneratedMdToSubfolder')
  await logMoveMd(subfolder, dirName, 'moveShownotesToSource')
  await logRemove('./content/feeds', 'cleanupShownotes', 'feeds folder from ./content')
  await logRemove(`./content/${subfolder}`, 'cleanupShownotes', `${subfolder} from ./content`)
  
  l.final(`${p} prepareShownotes completed for ${dirName}`)
}

export async function prepareInfo(dirName: string, feedFilename: string): Promise<void> {
  const p = '[text/utils/workflows]'
  logInitialFunctionCall('prepareInfo', { dirName, feedFilename })
  const subfolder = `${dirName}-info`
  
  await copyFeeds()
  await logMkdir(`./content/${subfolder}`, 'createDirectoryForInfo')
  
  const rssOptions: ProcessingOptions = {
    info: true,
    rss: [`./content/feeds/${feedFilename}`],
  }
  
  try {
    await processRSS(rssOptions)
  } catch (e) {
    err(`${p} Error during RSS processing for info: ${(e as Error).message}`)
    throw e
  }
  
  await logFindMove('.json', './content', `./content/${subfolder}`, 'moveGeneratedJsonToSubfolder')
  await removeDailySubfolder(dirName, subfolder)
  await copyBackToDaily(dirName, subfolder)
  await logRemove('./content/feeds', 'cleanupInfo', 'feeds folder from ./content')
  await logRemove(`./content/${subfolder}`, 'cleanupInfo', `${subfolder} from ./content'`)
  
  l.final(`${p} prepareInfo completed for ${dirName}`)
}

export async function handleMetaWorkflow(options: ProcessingOptions): Promise<boolean> {
  const p = '[text/utils/workflows]'
  l.dim(`${p} handleMetaWorkflow called with options: ${JSON.stringify({
    feed: options['feed'],
    metaInfo: options['metaInfo'],
    metaShownotes: options['metaShownotes'],
    metaDate: options['metaDate']
  }, null, 2)}`)
  
  if (options['feed']) {
    if (!options['metaShownotes']) {
      err('Error: --metaShownotes is required for the meta-workflow.')
      process.exit(1)
    }
    
    const feedFilename = options['feed']
    const dirName = extractDirectoryName(feedFilename)
    
    l.dim(`${p} Validating feed file: ${feedFilename}`)
    
    if (!validateFeedsFile(feedFilename)) {
      console.log('')
      err(`Error: Required feed file not found.`)
      console.log('')
      l.warn('To get started, run these commands:')
      console.log('')
      console.log(`  mkdir -p ${WORKFLOWS_DIR}/feeds`)
      console.log(`  echo 'https://feeds.megaphone.fm/MLN2155636147' > ${WORKFLOWS_DIR}/feeds/${feedFilename}`)
      console.log('')
      l.dim(`${p} Then run your command again.`)
      process.exit(1)
    }
    
    l.dim(`${p} Ensuring workflow directories exist`)
    await ensureWorkflowDirectories(dirName)
    
    try {
      const metaDates = options['metaDate'] 
        ? (Array.isArray(options['metaDate']) 
            ? options['metaDate'] 
            : [options['metaDate']])
        : undefined
      
      if (options['metaInfo']) {
        l.final(`${p} Running meta-workflow with both Info and Shownotes for ${dirName} from ${WORKFLOWS_DIR}`)
        l.dim(`${p} Step 1/2: Generating info files`)
        await prepareInfo(dirName, feedFilename)
        logSeparator({ type: 'completion', descriptor: `Meta-Workflow Info for ${dirName}` })
        l.dim(`${p} Step 2/2: Generating shownotes`)
      } else {
        l.final(`${p} Running meta-workflow: Shownotes only for ${dirName} from ${WORKFLOWS_DIR}`)
      }
      
      const dateInfoString = metaDates 
        ? `Dates: ${metaDates.join(', ')}` 
        : 'Date: latest available'
      
      l.dim(`${p} Processing shownotes (${dateInfoString})`)
      await prepareShownotes(dirName, feedFilename, metaDates)
      logSeparator({ type: 'completion', descriptor: `Meta-Workflow Shownotes for ${dirName}` })
      
      return true
    } catch (error) {
      err(`${p} Error in meta-workflow for ${dirName}: ${(error as Error).message}`)
      process.exit(1)
    }
  }
  
  l.dim(`${p} No feed specified, skipping meta-workflow`)
  return false
}