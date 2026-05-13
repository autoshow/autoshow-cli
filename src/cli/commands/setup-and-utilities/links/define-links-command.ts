import { defineCommand } from 'clerc'
import modelLinks from './model-links'
import * as l from '~/utils/logger'
import { extractHtmlToMarkdown } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-local/defuddle/run-defuddle-url'
import { runFirecrawlUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/firecrawl/run-firecrawl-url'
import { CLIUsageError } from '~/utils/error-handler'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { LINKS_FETCH_TIMEOUT_MS } from '~/utils/timeouts'
import type {
  FetchFn,
  LinksSelection,
  ModelLinksData,
  RunLinksOptions
} from '~/types'

const data = modelLinks as ModelLinksData
export const LINKS_OUTPUT_DIR = new URL('../../../../../project/links/', import.meta.url)
const HTML_MIME_HINTS = ['text/html', 'application/xhtml+xml'] as const
type FetchUrlResult = {
  content: string
  failedUrl?: string
}

const normalizeTokens = (tokens: string[]): string[] => [...new Set(tokens.map(token => token.toLowerCase()))].sort()
const isHtmlContentType = (contentType: string): boolean =>
  HTML_MIME_HINTS.some((hint) => contentType.includes(hint))
const looksLikeHtmlDocument = (content: string): boolean =>
  /^(?:<!doctype html\b|<html\b|<head\b|<body\b)/i.test(content.trimStart())
const formatErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
const getFetchableDocumentationUrl = (url: string): string => {
  const match = /^blob:(https?:\/\/.+)$/i.exec(url)
  return match?.[1] ?? url
}
const createHttpFetchError = (response: Response): Error & { status: number, headers: Headers } => {
  const error = new Error(`HTTP ${response.status} ${response.statusText}`) as Error & { status: number, headers: Headers }
  error.status = response.status
  error.headers = response.headers
  return error
}
let defuddleConsoleErrorQueue: Promise<void> = Promise.resolve()
const isDefuddleConsoleError = (args: Parameters<typeof console.error>): boolean =>
  typeof args[0] === 'string' && args[0].startsWith('Defuddle')
const withSuppressedDefuddleConsoleErrors = async <T>(operation: () => Promise<T>): Promise<T> => {
  const previousExtraction = defuddleConsoleErrorQueue
  let releaseExtraction: () => void = () => {}
  defuddleConsoleErrorQueue = new Promise<void>((resolve) => {
    releaseExtraction = resolve
  })

  await previousExtraction

  const originalConsoleError = console.error
  console.error = (...args: Parameters<typeof console.error>): void => {
    if (isDefuddleConsoleError(args)) return
    originalConsoleError(...args)
  }

  try {
    return await operation()
  } finally {
    console.error = originalConsoleError
    releaseExtraction()
  }
}

export const getDefaultLinksOutputFileName = (
  serviceSelections: Map<string, string[]>,
  globalSections: string[]
): string => {
  const groups = [
    ...(globalSections.length > 0 || serviceSelections.size === 0
      ? [['all', normalizeTokens(globalSections.length > 0 ? globalSections : ['all'])] as const]
      : []),
    ...[...serviceSelections.entries()].map(([serviceName, sections]) => [
      serviceName.toLowerCase(),
      normalizeTokens(sections.length > 0 ? sections : ['all'])
    ] as const)
  ]

  const stem = groups
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([serviceName, sections]) => [serviceName, ...sections].join('-'))
    .join('--')

  return `${stem}-links.md`
}

const getDefaultOutputPath = (
  serviceSelections: Map<string, string[]>,
  globalSections: string[]
): URL => new URL(getDefaultLinksOutputFileName(serviceSelections, globalSections), LINKS_OUTPUT_DIR)

const serviceEntries = Object.entries(data)
const serviceKeySet = new Set(serviceEntries.map(([serviceName]) => serviceName.toLowerCase()))
const serviceSectionKeyMap = new Map(
  serviceEntries.map(([serviceName, sections]) => [
    serviceName.toLowerCase(),
    new Set(Object.keys(sections).map(sectionName => sectionName.toLowerCase()))
  ])
)
const globalSectionKeySet = new Set(
  serviceEntries.flatMap(([, sections]) => Object.keys(sections).map(sectionName => sectionName.toLowerCase()))
)
const knownProviders = [...serviceKeySet].sort()
const knownSections = [...globalSectionKeySet].sort()

export const parseLinksArgv = (argv: string[]): LinksSelection => {
  const linksIdx = argv.findIndex((a) => a === 'links')
  const args = linksIdx >= 0 ? argv.slice(linksIdx + 1) : []

  const serviceSelections = new Map<string, string[]>()
  const globalSections: string[] = []
  let currentService: string | null = null

  for (const arg of args) {
    if (arg === '--help' || arg === '-h' || arg === '--version' || arg === '-v') continue
    if (arg.startsWith('--')) {
      const flag = arg.slice(2).toLowerCase()
      if (serviceKeySet.has(flag)) {
        currentService = flag
        if (!serviceSelections.has(currentService)) {
          serviceSelections.set(currentService, [])
        }
      } else {
        throw CLIUsageError(`Unknown links selector "--${flag}". Known providers: ${knownProviders.join(', ')}. Known sections: ${knownSections.join(', ')}.`)
      }
    } else if (currentService) {
      serviceSelections.get(currentService)!.push(arg.toLowerCase())
    } else {
      globalSections.push(arg.toLowerCase())
    }
  }

  return { serviceSelections, globalSections }
}

const assertKnownSections = (
  serviceSelections: Map<string, string[]>,
  globalSections: string[]
): void => {
  const unknownGlobalSections = globalSections.filter(sectionName => !globalSectionKeySet.has(sectionName))
  if (unknownGlobalSections.length > 0) {
    throw CLIUsageError(`Unknown links section(s): ${unknownGlobalSections.join(', ')}. Known sections: ${knownSections.join(', ')}`)
  }

  for (const [serviceName, sections] of serviceSelections) {
    const serviceSections = serviceSectionKeyMap.get(serviceName)
    const unknownSections = sections.filter(sectionName => !serviceSections?.has(sectionName))
    if (unknownSections.length > 0) {
      throw CLIUsageError(`Unknown links section(s) for --${serviceName}: ${unknownSections.join(', ')}`)
    }
  }
}

export const collectLinks = (
  serviceSelections: Map<string, string[]>,
  globalSections: string[]
): string[] => {
  const links: string[] = []
  const hasServiceSelections = serviceSelections.size > 0
  const hasGlobalSections = globalSections.length > 0

  if (hasServiceSelections) {
    for (const [serviceName, sections] of Object.entries(data)) {
      const requested = serviceSelections.get(serviceName.toLowerCase())
      if (!requested) continue
      for (const [sectionName, urls] of Object.entries(sections)) {
        if (requested.length === 0 || requested.includes(sectionName.toLowerCase())) {
          links.push(...urls)
        }
      }
    }
  }

  if (hasGlobalSections) {
    for (const sections of Object.values(data)) {
      for (const [sectionName, urls] of Object.entries(sections)) {
        if (globalSections.includes(sectionName.toLowerCase())) {
          links.push(...urls)
        }
      }
    }
  }

  if (!hasServiceSelections && !hasGlobalSections) {
    for (const sections of Object.values(data)) {
      for (const urls of Object.values(sections)) {
        links.push(...urls)
      }
    }
  }

  return [...new Set(links)]
}

const downloadUrl = async (
  url: string,
  fetchImpl: FetchFn
): Promise<{ contentType: string, finalUrl: string, fetchedText: string, requestUrl: string }> => withRetry(
  {
    retryClass: 'runtime_http_read',
    operationName: `links fetch ${url}`,
    timeoutMs: LINKS_FETCH_TIMEOUT_MS
  },
  async (signal) => {
    const requestUrl = getFetchableDocumentationUrl(url)
    const response = await fetchImpl(requestUrl, signal ? { signal } : undefined)
    if (!response.ok) {
      throw createHttpFetchError(response)
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
    const fetchedText = (await response.text()).trim()

    return {
      contentType,
      finalUrl: response.url || requestUrl,
      fetchedText,
      requestUrl
    }
  },
  (error) => classifyFetchRetry(error, 'runtime_http_read')
)

const fetchUrl = async (url: string, fetchImpl: FetchFn): Promise<FetchUrlResult> => {
  try {
    const { contentType, finalUrl, fetchedText, requestUrl } = await downloadUrl(url, fetchImpl)
    if (fetchedText.length === 0) {
      l.warn(`Fetched empty response from ${url}`)
      return { content: `<!-- Empty response from ${url} -->` }
    }

    let content: string
    if (isHtmlContentType(contentType) || looksLikeHtmlDocument(fetchedText)) {
      try {
        content = (await withSuppressedDefuddleConsoleErrors(async () =>
          await extractHtmlToMarkdown({
            html: fetchedText,
            documentUrl: finalUrl,
            sourceUrl: url,
            finalUrl
          })
        )).markdown
      } catch (defuddleError) {
        l.warn(`Defuddle failed for ${url}; falling back to Firecrawl: ${formatErrorMessage(defuddleError)}`)
        try {
          content = (await runFirecrawlUrl(requestUrl, url)).markdown
        } catch (firecrawlError) {
          throw new Error(
            `Defuddle failed and Firecrawl fallback failed. ` +
            `Defuddle: ${formatErrorMessage(defuddleError)} Firecrawl: ${formatErrorMessage(firecrawlError)}`
          )
        }
      }
    } else {
      content = fetchedText
    }

    return { content: `<!-- Source: ${url} -->\n\n${content}` }
  } catch (error) {
    l.warn(`Failed to fetch ${url}`, error)
    return {
      content: `<!-- Failed to fetch ${url} -->`,
      failedUrl: url
    }
  }
}

export const runLinksWithArgv = async (
  argv: string[],
  options: RunLinksOptions = {}
): Promise<{ outputPath: string, urlCount: number, lineCount: number }> => {
  const { serviceSelections, globalSections } = parseLinksArgv(argv)
  assertKnownSections(serviceSelections, globalSections)
  const links = collectLinks(serviceSelections, globalSections)

  if (links.length === 0) {
    throw CLIUsageError('No documentation links matched the provided selections')
  }

  const outputPath = options.outputPath ?? getDefaultOutputPath(serviceSelections, globalSections)
  const fetchImpl = options.fetchImpl ?? fetch

  l.write('info', `Fetching ${links.length} documentation URLs`)

  const fetchResults = await Promise.all(links.map(url => fetchUrl(url, fetchImpl)))
  const failedUrls = fetchResults
    .map(result => result.failedUrl)
    .filter((url): url is string => typeof url === 'string')
  if (failedUrls.length > 0) {
    l.warn(
      `Failed to fetch ${failedUrls.length}/${links.length} documentation URL${failedUrls.length === 1 ? '' : 's'} after retries:\n` +
      failedUrls.map(url => `- ${url}`).join('\n')
    )
  }

  const fetchedContents = fetchResults.map(result => result.content)
  const combinedContent = `${fetchedContents.join('\n\n')}\n`
  await Bun.write(outputPath, combinedContent)

  const resolvedOutputPath = typeof outputPath === 'string'
    ? outputPath
    : decodeURIComponent(outputPath.pathname)
  const lineCount = combinedContent.split('\n').length

  l.write('success', `Wrote ${resolvedOutputPath} from ${links.length} URLs (${lineCount} lines)`)

  return {
    outputPath: resolvedOutputPath,
    urlCount: links.length,
    lineCount
  }
}

const runLinks = async (): Promise<void> => {
  await runLinksWithArgv(process.argv)
}

export const linksCommand = defineCommand({
  name: 'links',
  description: 'Fetch provider documentation markdown and write a combined file',
  help: {
    examples: [
      ['bun as links', 'Fetch all provider documentation'],
      ['bun as links stt', 'Fetch STT documentation across every provider']
    ]
  }
}, runLinks)
