import { basename, extname } from 'node:path'
import type { OpenAIImageResponse } from '~/utils/openai/client'

const mimeToExtension = (mimeType: string | null | undefined, fallback = 'png'): string => {
  const normalized = mimeType?.split(';')[0]?.trim().toLowerCase()
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg'
  if (normalized === 'image/webp') return 'webp'
  if (normalized === 'image/png') return 'png'
  return fallback
}

const urlToExtension = (url: string, fallback = 'png'): string => {
  try {
    return extname(new URL(url).pathname).replace(/^\./, '') || fallback
  } catch {
    return fallback
  }
}

const outputPathForIndex = (outputDir: string, ext: string, index: number): { fileName: string, outputPath: string } => {
  const normalizedExt = ext === 'jpeg' ? 'jpg' : ext
  const fileName = index === 0
    ? `generated-image.${normalizedExt}`
    : `generated-image-${index + 1}.${normalizedExt}`
  return { fileName, outputPath: `${outputDir}/${fileName}` }
}

const downloadImageUrl = async (url: string, outputDir: string, index: number, fallbackExt: string): Promise<string> => {
  const response = await fetch(url, { headers: { accept: 'image/*,*/*;q=0.8' } })
  if (!response.ok) {
    throw new Error(`Generated image download failed (${response.status}): ${url}`)
  }

  const ext = mimeToExtension(response.headers.get('content-type'), urlToExtension(url, fallbackExt))
  const { outputPath } = outputPathForIndex(outputDir, ext, index)
  await Bun.write(outputPath, new Uint8Array(await response.arrayBuffer()))
  return outputPath
}

export const writeOpenAIImageResponseData = async (
  response: OpenAIImageResponse,
  outputDir: string,
  fallbackExt: string
): Promise<string[]> => {
  const data = response.data ?? []
  const imagePaths: string[] = []

  for (const [index, item] of data.entries()) {
    if (item.b64_json) {
      const ext = mimeToExtension(item.mime_type, fallbackExt)
      const { outputPath } = outputPathForIndex(outputDir, ext, index)
      await Bun.write(outputPath, Buffer.from(item.b64_json, 'base64'))
      imagePaths.push(outputPath)
      continue
    }

    if (item.url) {
      imagePaths.push(await downloadImageUrl(item.url, outputDir, index, fallbackExt))
    }
  }

  return imagePaths
}

export const getImageFileNames = (imagePaths: readonly string[]): string[] =>
  imagePaths.map((imagePath) => basename(imagePath))

export const getFirstRevisedPrompt = (response: OpenAIImageResponse): string | undefined => {
  const dataPrompt = response.data?.find((item) => typeof item.revised_prompt === 'string')?.revised_prompt
  if (dataPrompt) return dataPrompt
  return typeof response.revised_prompt === 'string' ? response.revised_prompt : undefined
}

export const getProviderReturnedModel = (
  requestedModel: string,
  response: OpenAIImageResponse | { model?: string | undefined, modelVersion?: string | undefined }
): string | undefined => {
  const model = 'modelVersion' in response ? response.modelVersion : response.model
  return typeof model === 'string' && model.length > 0 && model !== requestedModel ? model : undefined
}
