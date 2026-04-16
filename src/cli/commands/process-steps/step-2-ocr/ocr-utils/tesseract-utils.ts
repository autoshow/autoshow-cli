import { exec, commandExists } from '~/utils/cli-utils'
import { setupExtractionOcr } from '../ocr-local/extract'
import type { OcrOutputFormat, OcrResult } from '~/types'

const parseTsvConfidence = (tsv: string): number | undefined => {
  const rows = tsv.split('\n').map(r => r.trim()).filter(Boolean)
  if (rows.length <= 1) return undefined
  let total = 0
  let count = 0
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i]?.split('\t')
    const conf = cols?.[10]
    if (!conf) continue
    const num = Number.parseFloat(conf)
    if (Number.isFinite(num) && num >= 0) {
      total += num
      count++
    }
  }
  if (count === 0) return undefined
  return total / count
}

export const ensureTesseractSetup = async (): Promise<void> => {
  if (commandExists('tesseract')) return
  await setupExtractionOcr()
}

export const ocrImage = async (
  imagePath: string,
  lang: string,
  oem: number,
  psm: number,
  outputFormat: OcrOutputFormat,
  extraConfig?: Record<string, string | number>
): Promise<OcrResult> => {
  await ensureTesseractSetup()
  const args = [imagePath, 'stdout', '-l', lang, '--oem', String(oem), '--psm', String(psm)]
  if (extraConfig) {
    for (const [key, value] of Object.entries(extraConfig)) {
      args.push('-c', `${key}=${String(value)}`)
    }
  }
  if (outputFormat === 'tsv' || outputFormat === 'hocr') {
    args.push(outputFormat)
  }
  const result = await exec('tesseract', args, { env: { OMP_THREAD_LIMIT: '2' } })
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `OCR failed for ${imagePath}`)
  }
  if (outputFormat === 'tsv') {
    const confidence = parseTsvConfidence(result.stdout)
    return {
      text: result.stdout,
      ...(confidence !== undefined ? { confidence } : {})
    }
  }
  return { text: result.stdout }
}
