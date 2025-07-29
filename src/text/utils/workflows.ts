// src/utils/workflows.ts

import { l, err, logSeparator, logInitialFunctionCall } from '../../logging.ts'
import { execPromise, mkdirSync, existsSync } from '../../node-utils.ts'
import { processRSS } from '../process-commands/rss.ts'
import type { ProcessingOptions } from '@/types.ts'

export async function logOperation(
  command: string,
  operationName: string,
  logFn: any,
  description: string
): Promise<void> {
  console.log('')
  logFn(`[${operationName}] Starting ${operationName}: ${description}`)
  logFn(`[${operationName}] Executing command: ${command}`)
  try {
    const { stdout, stderr } = await execPromise(command)
    logFn(`[${operationName}] stdout:`)
    console.log(stdout)
    if (stderr) {
      l.warn(`[${operationName}] stderr:`)
      console.warn(stderr)
    }
    logFn(`[${operationName}] Successfully finished ${operationName}: ${description}`)
  } catch (error: any) {
    err(`[${operationName}] Error during ${operationName}: ${error.message}`)
    throw error
  }
}

export async function logCopy(source: string, destination: string, operationName: string, successMessage: string): Promise<void> {
  await logOperation(`cp -R "${source}" "${destination}"`, operationName, l, successMessage)
}

export async function logMkdir(targetPath: string, operationName: string): Promise<void> {
  console.log('')
  l(`[${operationName}] Starting ${operationName}: Creating directory ${targetPath}`)
  try {
    if (!existsSync(targetPath)) {
      mkdirSync(targetPath, { recursive: true })
      l(`[${operationName}] Successfully created directory: ${targetPath}`)
    } else {
      l(`[${operationName}] Directory already exists: ${targetPath}`)
    }
  } catch (error: any) {
    err(`[${operationName}] Error creating directory ${targetPath}: ${error.message}`)
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

export async function logMoveMd(subfolder: string, dirName: string, sourceDir: string, operationName: string): Promise<void> {
  const sourcePath = `./content/${subfolder}`
  const destPath = `./${sourceDir}/${dirName}/${subfolder}/`
  await logMkdir(destPath, `${operationName} (ensure_dest)`)
  const command = `find "${sourcePath}" -maxdepth 1 -type f -name '*.md' -exec mv {} "${destPath}" \\;`
  await logOperation(command, operationName, l, `Moving .md files from ${sourcePath} to ${destPath}`)
}

async function copyFeeds(sourceDir: string): Promise<void> {
  await logCopy(`./${sourceDir}/feeds`, './content', 'copyFeeds', 'feeds folder copied to ./content')
}

async function removeDailySubfolder(dirName: string, subfolder: string, sourceDir: string): Promise<void> {
  await logRemove(`./${sourceDir}/${dirName}/${subfolder}`, 'removeDailySubfolder', `subfolder: ${subfolder} from ./${sourceDir}/${dirName}`)
}

async function copyBackToDaily(dirName: string, subfolder: string, sourceDir: string): Promise<void> {
  await logCopy(`./content/${subfolder}`, `./${sourceDir}/${dirName}`, 'copyBackToDaily', `${subfolder} copied to ./${sourceDir}/${dirName}`)
}

export async function prepareShownotes(dirName: string, dateParams: string[] | undefined, sourceDir: string): Promise<void> {
  logInitialFunctionCall('prepareShownotes', { dirName, dateParams, sourceDir })
  const subfolder = `${dirName}-shownotes`
  const feedFile = `${dirName}-feeds.md`
  
  l.dim(`Preparing to process shownotes for ${dirName} with dates: ${dateParams ? dateParams.join(', ') : 'latest available'}`)
  
  await copyFeeds(sourceDir)
  await logMkdir(`./content/${subfolder}`, 'createDirectoryForShownotes')
  
  const rssOptions: ProcessingOptions = {
    rss: [`./content/feeds/${feedFile}`],
    whisper: 'large-v3-turbo',
  }
  
  if (dateParams && dateParams.length > 0) {
    l.dim(`Setting date parameters: ${dateParams.join(', ')}`)
    rssOptions.date = dateParams
  }
  
  try {
    await processRSS(rssOptions, rssOptions.llmServices, rssOptions.transcriptServices)
  } catch (e) {
    err(`Error during RSS processing for shownotes: ${(e as Error).message}`)
    throw e
  }
  
  await logFindMove('.md', './content', `./content/${subfolder}`, 'moveGeneratedMdToSubfolder')
  await logMoveMd(subfolder, dirName, sourceDir, 'moveShownotesToSource')
  await logRemove('./content/feeds', 'cleanupShownotes', 'feeds folder from ./content')
  await logRemove(`./content/${subfolder}`, 'cleanupShownotes', `${subfolder} from ./content`)
  
  l.final(`prepareShownotes completed for ${dirName}`)
}

export async function prepareInfo(dirName: string, sourceDir: string): Promise<void> {
  logInitialFunctionCall('prepareInfo', { dirName, sourceDir })
  const subfolder = `${dirName}-info`
  const feedFile = `${dirName}-feeds.md`
  await copyFeeds(sourceDir)
  await logMkdir(`./content/${subfolder}`, 'createDirectoryForInfo')
  const rssOptions: ProcessingOptions = {
    info: true,
    rss: [`./content/feeds/${feedFile}`],
  }
  try {
    await processRSS(rssOptions)
  } catch (e) {
    err(`Error during RSS processing for info: ${(e as Error).message}`)
    throw e
  }
  await logFindMove('.json', './content', `./content/${subfolder}`, 'moveGeneratedJsonToSubfolder')
  await removeDailySubfolder(dirName, subfolder, sourceDir)
  await copyBackToDaily(dirName, subfolder, sourceDir)
  await logRemove('./content/feeds', 'cleanupInfo', 'feeds folder from ./content')
  await logRemove(`./content/${subfolder}`, 'cleanupInfo', `${subfolder} from ./content`)
  l.final(`prepareInfo completed for ${dirName}`)
}

export async function handleMetaWorkflow(options: ProcessingOptions): Promise<boolean> {
  l.dim(`handleMetaWorkflow called with options: ${JSON.stringify({
    metaDir: options['metaDir'],
    metaSrcDir: options['metaSrcDir'],
    metaInfo: options['metaInfo'],
    metaShownotes: options['metaShownotes'],
    metaDate: options['metaDate']
  }, null, 2)}`)
  
  if (options['metaDir']) {
    if (!options['metaSrcDir']) {
      err('Error: --metaSrcDir is required when --metaDir is specified.')
      process.exit(1)
    }
    
    if (options['metaInfo'] && options['metaShownotes']) {
      err('Error: Both --metaInfo and --metaShownotes were provided. Choose one.')
      process.exit(1)
    }
    
    if (!options['metaInfo'] && !options['metaShownotes']) {
      err('Error: Neither --metaInfo nor --metaShownotes was provided for the meta-workflow.')
      process.exit(1)
    }
    
    try {
      if (options['metaInfo']) {
        l.final(`Starting meta-workflow: Info for ${options['metaDir']} from ${options['metaSrcDir']}`)
        await prepareInfo(options['metaDir'], options['metaSrcDir'])
        logSeparator({ type: 'completion', descriptor: `Meta-Workflow Info for ${options['metaDir']}` })
      } else if (options['metaShownotes']) {
        const metaDates = options['metaDate'] 
          ? (Array.isArray(options['metaDate']) 
              ? options['metaDate'] 
              : [options['metaDate']])
          : undefined
          
        const dateInfoString = metaDates 
          ? `Dates: ${metaDates.join(', ')}` 
          : 'Date: latest available'
          
        l.final(`Starting meta-workflow: Shownotes for ${options['metaDir']} from ${options['metaSrcDir']} (${dateInfoString})`)
        await prepareShownotes(options['metaDir'], metaDates, options['metaSrcDir'])
        logSeparator({ type: 'completion', descriptor: `Meta-Workflow Shownotes for ${options['metaDir']}` })
      }
      return true
    } catch (error) {
      err(`Error in meta-workflow for ${options['metaDir']}: ${(error as Error).message}`)
      process.exit(1)
    }
  }
  
  l.dim('No metaDir specified, skipping meta-workflow')
  return false
}