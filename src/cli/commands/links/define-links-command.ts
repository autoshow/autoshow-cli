import { defineCommand } from 'clerc'
import modelLinks from '~/../../docs/links/model-links.json'

type ModelLinksData = Record<string, Record<string, string[]>>

const data = modelLinks as ModelLinksData

const serviceKeySet = new Set(Object.keys(data).map((s) => s.toLowerCase()))

/**
 * Parse argv after the "links" command into two structures:
 *   - serviceSelections: Map<service, section[]>  (from --service section1 section2 ...)
 *   - globalSections: string[]                     (bare words not preceded by a --service flag)
 *
 * Examples:
 *   links --openai general text --minimax video
 *     => serviceSelections: { openai: [general, text], minimax: [video] }
 *
 *   links general tts stt
 *     => globalSections: [general, tts, stt]
 */
const parseLinksArgv = (): {
  serviceSelections: Map<string, string[]>
  globalSections: string[]
} => {
  const argv = process.argv
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
        currentService = null
      }
    } else if (currentService) {
      serviceSelections.get(currentService)!.push(arg.toLowerCase())
    } else {
      globalSections.push(arg.toLowerCase())
    }
  }

  return { serviceSelections, globalSections }
}

const collectLinks = (
  serviceSelections: Map<string, string[]>,
  globalSections: string[]
): string[] => {
  const links: string[] = []
  const hasServiceSelections = serviceSelections.size > 0
  const hasGlobalSections = globalSections.length > 0

  if (hasServiceSelections) {
    for (const [serviceName, sections] of Object.entries(data)) {
      const requested = serviceSelections.get(serviceName.toLowerCase())
      if (!requested || requested.length === 0) continue
      for (const [sectionName, urls] of Object.entries(sections)) {
        if (requested.includes(sectionName.toLowerCase())) {
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

const runLinks = async (): Promise<void> => {
  const { serviceSelections, globalSections } = parseLinksArgv()
  const links = collectLinks(serviceSelections, globalSections)
  for (const link of links) {
    console.log(link)
  }
}

export const linksCommand = defineCommand({
  name: 'links',
  description: 'Print API documentation links for model providers'
}, runLinks)
