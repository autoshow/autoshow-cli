import { exec, commandExists } from '~/utils/cli-utils'
import { setupDocumentTools } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/document'
import type { MutoolDocInfo } from '~/types'

const parsePageCount = (stdout: string): number => {
  const direct = stdout.match(/Pages:\s*(\d+)/i)
  if (direct) {
    const num = Number.parseInt(direct[1] || '0', 10)
    return Number.isFinite(num) && num > 0 ? num : 0
  }
  const lines = stdout.split('\n').map(s => s.trim()).filter(Boolean)
  const pageNums = lines
    .map(line => {
      const m = line.match(/(?:^|\s)(\d+)(?:\s|$)/)
      return m ? Number.parseInt(m[1] || '0', 10) : 0
    })
    .filter(n => Number.isFinite(n) && n > 0)
  if (pageNums.length === 0) return 0
  return Math.max(...pageNums)
}

const withPassword = (args: string[], password?: string): string[] => {
  if (!password) return args
  return [...args, '-p', password]
}

export const ensureMutoolSetup = async (): Promise<void> => {
  if (commandExists('mutool')) return
  await setupDocumentTools()
}

const countEpubPages = async (filePath: string): Promise<number> => {

  const result = await exec('mutool', ['draw', '-F', 'txt', '-o', '-', filePath])
  const combined = result.stdout + result.stderr
  const matches = combined.match(/^page\s+\S+\s+\d+/gm)
  return matches ? matches.length : 1
}

export const getDocumentInfo = async (filePath: string, password?: string): Promise<MutoolDocInfo> => {
  await ensureMutoolSetup()

  if (filePath.toLowerCase().endsWith('.epub')) {
    const pageCount = await countEpubPages(filePath)
    return { pageCount }
  }

  const infoArgs = withPassword(['info', filePath], password)
  const infoResult = await exec('mutool', infoArgs)
  if (infoResult.exitCode === 0) {
    const pageCount = parsePageCount(infoResult.stdout)
    const title = infoResult.stdout.match(/Title:\s*(.*)/i)?.[1]?.trim()
    const author = infoResult.stdout.match(/Author:\s*(.*)/i)?.[1]?.trim()
    const docInfo: MutoolDocInfo = { pageCount }
    if (title) docInfo.title = title
    if (author) docInfo.author = author
    return docInfo
  }
  const pagesArgs = withPassword(['pages', filePath], password)
  const pagesResult = await exec('mutool', pagesArgs)
  if (pagesResult.exitCode !== 0) {
    throw new Error(pagesResult.stderr || `Failed to read document info for ${filePath}`)
  }
  return { pageCount: parsePageCount(pagesResult.stdout) }
}

export const extractPageText = async (filePath: string, page: number, password?: string): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  await ensureMutoolSetup()
  const args = withPassword(['draw', '-F', 'txt', '-o', '-', filePath, String(page)], password)
  return await exec('mutool', args)
}

export const renderPageToImage = async (
  filePath: string,
  page: number,
  dpi: number,
  outPath: string,
  password?: string,
  rotate: number = 0
): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  await ensureMutoolSetup()
  const base = ['draw', '-F', 'png', '-r', String(dpi), '-R', String(rotate), '-o', outPath, filePath, String(page)]
  const args = withPassword(base, password)
  return await exec('mutool', args)
}

export const convertDocumentToPdf = async (
  filePath: string,
  outPath: string,
  password?: string
): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  await ensureMutoolSetup()
  const base = ['convert', '-F', 'pdf', '-o', outPath, filePath]
  const args = withPassword(base, password)
  return await exec('mutool', args)
}

export const showPdfObject = async (
  filePath: string,
  objectPath: string,
  password?: string
): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  await ensureMutoolSetup()
  const args = withPassword(['show', filePath, objectPath], password)
  return await exec('mutool', args)
}

export const showPdfOutline = async (
  filePath: string,
  password?: string
): Promise<{ stdout: string, stderr: string, exitCode: number }> =>
  await showPdfObject(filePath, 'outline', password)
