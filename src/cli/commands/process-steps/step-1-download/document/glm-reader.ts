import * as v from 'valibot'
import type { WebArticleMetadata } from '~/types'
import { validateData } from '~/utils/validate/validation'
import { ensureGlmApiKey, resolveGlmBaseUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/glm-ocr/glm'

const GlmReaderResponseSchema = v.looseObject({
  reader_result: v.looseObject({
    content: v.string(),
    description: v.optional(v.string(), undefined),
    title: v.optional(v.string(), undefined),
    url: v.optional(v.string(), undefined)
  })
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const cleanString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

const countWords = (text: string): number => {
  return text.split(/\s+/).filter(Boolean).length
}

export const runGlmReader = async (
  source: string
): Promise<{ preparedMarkdown: string, web: WebArticleMetadata }> => {
  const apiKey = ensureGlmApiKey('GLM Reader')
  const response = await fetch(`${resolveGlmBaseUrl()}/reader`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: source,
      return_format: 'markdown',
      timeout: 20,
      no_cache: false,
      retain_images: false,
      no_gfm: false,
      keep_img_data_url: false,
      with_images_summary: false,
      with_links_summary: false
    })
  })

  const rawText = await response.text()
  let payload: unknown = null
  try {
    payload = JSON.parse(rawText) as unknown
  } catch {
    payload = rawText
  }

  if (!response.ok) {
    const message = isRecord(payload)
      ? cleanString(payload['message']) ?? cleanString(payload['error'])
      : undefined
    throw new Error(`GLM Reader request failed (${response.status} ${response.statusText})${message ? `: ${message}` : ''}`)
  }

  const validated = validateData(GlmReaderResponseSchema, payload, 'GLM Reader response')
  const content = validated.reader_result.content.trim()
  const web: WebArticleMetadata = {
    sourceUrl: source,
    wordCount: countWords(content)
  }

  const finalUrl = cleanString(validated.reader_result.url)
  const title = cleanString(validated.reader_result.title)
  const description = cleanString(validated.reader_result.description)

  if (finalUrl) web.finalUrl = finalUrl
  if (title) web.title = title
  if (description) web.description = description

  return {
    preparedMarkdown: content,
    web
  }
}
