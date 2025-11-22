import { l, err } from '@/logging'
import { execPromise, existsSync, ensureDir, join } from '@/node-utils'
import type { ProcessingOptions } from '@/text/text-types'

export function logRSSProcessingStatus(
  total: number,
  processing: number,
  options: ProcessingOptions
): void {
  if (options.item && options.item.length > 0) {
    l.dim(`Found ${total} items in the RSS feed.`)
    l.dim(`Processing ${processing} specified items.`)
  } else if (options.last) {
    l.dim(`Found ${total} items in the RSS feed.`)
    l.dim(`Processing the last ${options.last} items.`)
  } else if (options.days) {
    l.dim(`Found ${total} items in the RSS feed.`)
    l.dim(`Processing ${processing} items from the last ${options.days} days.`)
  } else {
    l.dim(`Found ${total} item(s) in the RSS feed.`)
    l.dim(`Processing ${processing} item(s).`)
  }
}

export async function logOperation(
  command: string,
  operationName: string,
  logFn: any,
  description: string
): Promise<void> {
  logFn(description)
  try {
    const { stdout, stderr } = await execPromise(command)
    if (stdout && stdout.trim()) {
      console.log(stdout)
    }
    if (stderr) {
      l.warn(stderr)
    }
  } catch (error: any) {
    err(`Error during ${operationName}: ${error.message}`)
    throw error
  }
}

export async function logCopy(source: string, destination: string, operationName: string, successMessage: string): Promise<void> {
  await logOperation(`cp -R "${source}" "${destination}"`, operationName, l, successMessage)
}

export async function logMkdir(targetPath: string, operationName: string): Promise<void> {
  try {
    if (!existsSync(targetPath)) {
      await ensureDir(targetPath)
    }
  } catch (error: any) {
    err(`Error creating directory ${targetPath}: ${error.message}`)
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
  const sourcePath = join('output', subfolder)
  const destPath = join('output', 'workflows', dirName, subfolder)
  await logMkdir(destPath, `${operationName} (ensure_dest)`)
  const command = `find "${sourcePath}" -maxdepth 1 -type f -name '*.md' -exec mv {} "${destPath}/" \\;`
  await logOperation(command, operationName, l, `Moving .md files from ${sourcePath} to ${destPath}`)
}