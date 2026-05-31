import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  ExtractHtmlToMarkdownInput,
  ExtractHtmlToMarkdownResult,
  WebArticleMetadata
} from '~/types'
import {
  cleanString,
  countWords,
  ensureMeaningfulMarkdown,
  fallbackTitleFromSource,
  fetchRemoteHtml,
  getUrlRequestTimeoutMs,
  isRecord,
  isRemoteSource,
  normalizeMarkdown,
  readLocalHtml,
  type UrlArticleRunResult
} from '../../url-utils'
import {
  assertUrlArticleOptionsSupported,
  type UrlArticleProviderAdapter,
  type UrlArticleRunOptions
} from '../../url-provider-adapter'
import {
  ensureDefuddleCliSetup,
  formatDefuddleCliOutput,
  runDefuddleCliCapture
} from './defuddle-cli'

const DEFUDDLE_CAPABILITIES = [
  'local-html',
  'remote-html',
  'main-content',
  'timeout'
] as const

export const extractHtmlToMarkdown = async (
  input: ExtractHtmlToMarkdownInput
): Promise<ExtractHtmlToMarkdownResult> => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'autoshow-defuddle-'))
  const tempHtmlPath = join(tempRoot, 'article.html')

  try {
    await Bun.write(tempHtmlPath, input.html)

    const defuddleBin = await ensureDefuddleCliSetup()
    const result = await runDefuddleCliCapture(
      defuddleBin,
      ['parse', tempHtmlPath, '--markdown', '--json'],
      { allowFailure: true }
    )

    if (result.exitCode !== 0) {
      throw new Error(`Defuddle CLI failed: ${formatDefuddleCliOutput(result)}`)
    }

    let parsedValue: unknown
    try {
      parsedValue = JSON.parse(result.stdout)
    } catch {
      throw new Error(`Defuddle CLI returned invalid JSON: ${formatDefuddleCliOutput(result)}`)
    }

    if (!isRecord(parsedValue)) {
      throw new Error(`Defuddle CLI returned non-object JSON: ${formatDefuddleCliOutput(result)}`)
    }

    const parsed = parsedValue
    const markdown = ensureMeaningfulMarkdown(
      normalizeMarkdown(parsed['contentMarkdown'] ?? parsed['content']),
      'defuddle'
    )
    const title = cleanString(parsed['title'])
    const author = cleanString(parsed['author'])

    return {
      markdown,
      web: buildDefuddleWebMetadata(input.sourceUrl, input.finalUrl, parsed, markdown),
      ...(title ? { title } : {}),
      ...(author ? { author } : {})
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }
}

const buildDefuddleWebMetadata = (
  sourceUrl: string | undefined,
  finalUrl: string | undefined,
  parsed: Record<string, unknown>,
  markdown: string
): WebArticleMetadata => {
  const web: WebArticleMetadata = {}
  const title = cleanString(parsed['title'])
  const author = cleanString(parsed['author'])
  const site = cleanString(parsed['site'])
  const published = cleanString(parsed['published'])
  const language = cleanString(parsed['language'])
  const description = cleanString(parsed['description'])

  if (sourceUrl) web.sourceUrl = sourceUrl
  if (finalUrl) web.finalUrl = finalUrl
  if (title) web.title = title
  if (author) web.author = author
  if (site) web.site = site
  if (published) web.published = published
  if (language) web.language = language
  web.wordCount = typeof parsed['wordCount'] === 'number' && Number.isFinite(parsed['wordCount'])
    ? parsed['wordCount']
    : countWords(markdown)
  if (description) web.description = description

  return web
}

const runDefuddleUrl = async (
  source: string,
  sourceUrl?: string,
  options?: UrlArticleRunOptions
): Promise<UrlArticleRunResult> => {
  assertUrlArticleOptionsSupported({
    displayName: 'Defuddle',
    capabilities: DEFUDDLE_CAPABILITIES
  }, options)

  if (isRemoteSource(source)) {
    const htmlInput = await fetchRemoteHtml(source, {
      timeoutMs: getUrlRequestTimeoutMs(options),
      signal: options?.requestSignal,
      providerLabel: 'Defuddle'
    })
    const extracted = await extractHtmlToMarkdown({
      html: htmlInput.html,
      documentUrl: htmlInput.finalUrl,
      ...(sourceUrl ? { sourceUrl } : {}),
      finalUrl: htmlInput.finalUrl
    })

    return {
      markdown: extracted.markdown,
      web: extracted.web,
      fileSize: htmlInput.fileSize,
      title: extracted.title ?? fallbackTitleFromSource(source),
      ...(extracted.author ? { author: extracted.author } : {})
    }
  }

  const htmlInput = await readLocalHtml(source)
  const extracted = await extractHtmlToMarkdown({
    html: htmlInput.html,
    documentUrl: htmlInput.localFileUrl
  })

  return {
    markdown: extracted.markdown,
    web: extracted.web,
    fileSize: htmlInput.fileSize,
    title: extracted.title ?? fallbackTitleFromSource(source),
    ...(extracted.author ? { author: extracted.author } : {})
  }
}

export const defuddleArticleAdapter: UrlArticleProviderAdapter = {
  id: 'defuddle',
  displayName: 'Defuddle',
  capabilities: DEFUDDLE_CAPABILITIES,
  run: runDefuddleUrl
}
