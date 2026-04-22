import { defineCommand } from 'clerc'
import modelLinks from './model-links.json'
import * as l from '~/logger'
import { CLIUsageError } from '~/utils/error-handler'

type ModelLinksData = Record<string, Record<string, string[]>>
type LinksSelection = {
  serviceSelections: Map<string, string[]>
  globalSections: string[]
}
type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
type RunLinksOptions = {
  outputPath?: string | URL
  fetchImpl?: FetchFn
}

const data = modelLinks as ModelLinksData
export const LINKS_OUTPUT_DIR = new URL('../../../../../project/links/', import.meta.url)

const normalizeTokens = (tokens: string[]): string[] => [...new Set(tokens.map(token => token.toLowerCase()))].sort()

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

const fetchUrl = async (url: string, fetchImpl: FetchFn): Promise<string> => {
  try {
    const response = await fetchImpl(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`)
    }

    const content = (await response.text()).trim()
    if (content.length === 0) {
      l.warn(`Fetched empty response from ${url}`)
      return `<!-- Empty response from ${url} -->`
    }

    return `<!-- Source: ${url} -->\n\n${content}`
  } catch (error) {
    l.warn(`Failed to fetch ${url}`, error)
    return `<!-- Failed to fetch ${url} -->`
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

  l.info(`Fetching ${links.length} documentation URLs`)

  const fetchedContents = await Promise.all(links.map(url => fetchUrl(url, fetchImpl)))
  const combinedContent = `${fetchedContents.join('\n\n')}\n`
  await Bun.write(outputPath, combinedContent)

  const resolvedOutputPath = typeof outputPath === 'string'
    ? outputPath
    : decodeURIComponent(outputPath.pathname)
  const lineCount = combinedContent.split('\n').length

  l.success(`Wrote ${resolvedOutputPath} from ${links.length} URLs (${lineCount} lines)`)

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
