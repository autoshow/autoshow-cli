import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { WebArticleMetadata } from '~/types'
import { validateData } from '~/utils/validate/validation'
import { ensureGlmApiKey, resolveGlmBaseUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/glm-ocr/glm'
import {
  byteLength,
  cleanString,
  countWords,
  createUrlProviderHttpError,
  ensureMeaningfulMarkdown,
  fallbackTitleFromSource,
  getUrlRequestTimeoutMs,
  isRecord,
  tryFetchRemoteHtml,
  withUrlProviderTimeout,
  type UrlArticleRunResult
} from '../../url-utils'
import {
  assertUrlArticleOptionsSupported,
  type UrlArticleProviderAdapter,
  type UrlArticleRunOptions
} from '../../url-provider-adapter'

const GLM_READER_CAPABILITIES = [
  'remote-html',
  'main-content',
  'timeout'
] as const

const GlmReaderResponseSchema = v.looseObject({
  reader_result: v.looseObject({
    content: v.string(),
    description: v.optional(v.string(), undefined),
    title: v.optional(v.string(), undefined),
    url: v.optional(v.string(), undefined)
  })
})

const runGlmReader = async (
  source: string,
  options?: UrlArticleRunOptions
): Promise<{ preparedMarkdown: string, web: WebArticleMetadata }> => {
  assertUrlArticleOptionsSupported({
    displayName: 'GLM Reader',
    capabilities: GLM_READER_CAPABILITIES
  }, options)

  const apiKey = ensureGlmApiKey('GLM Reader')
  const timeoutMs = getUrlRequestTimeoutMs(options)
  const requestOptions = { ...options, timeoutMs }
  const response = await withUrlProviderTimeout('GLM Reader', requestOptions, async (signal) =>
    await fetch(`${resolveGlmBaseUrl()}/reader`, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: source,
        return_format: 'markdown',
        no_cache: false,
        retain_images: false,
        no_gfm: false,
        keep_img_data_url: false,
        with_images_summary: false,
        with_links_summary: false,
        timeout: Math.ceil(timeoutMs / 1000)
      })
    })
  )

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
    throw createUrlProviderHttpError('GLM Reader', 'request', response, message)
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

export const runGlmReaderUrl = async (
  source: string,
  sourceUrl: string | undefined,
  options?: UrlArticleRunOptions
): Promise<UrlArticleRunResult> => {
  l.write('info', 'Using GLM Reader backend for article extraction')
  const glmResult = await runGlmReader(source, options)
  const htmlFallback = await tryFetchRemoteHtml(source)

  const markdown = ensureMeaningfulMarkdown(glmResult.preparedMarkdown, 'glm-reader')
  const web = { ...glmResult.web }
  if (sourceUrl) web.sourceUrl = sourceUrl

  return {
    markdown,
    web,
    fileSize: htmlFallback?.fileSize ?? byteLength(markdown),
    title: glmResult.web.title ?? fallbackTitleFromSource(source)
  }
}

export const glmReaderArticleAdapter: UrlArticleProviderAdapter = {
  id: 'glm-reader',
  displayName: 'GLM Reader',
  capabilities: GLM_READER_CAPABILITIES,
  run: runGlmReaderUrl
}
