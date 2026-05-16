import { mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { StructuredScriptDataSchema } from '../schemas/schemas'
import { parseJsonFile } from './json-prompt-utils'
import {
  getPanelPromptCoverageReportPath,
  getPanelPromptsDirectory,
  getStructuredScriptPath,
} from './project-paths'
import type {
  ScenePromptData,
  StructuredScriptData,
  StructuredScriptSourceSegment,
} from '../types'

type SourceCoverageField = 'speakerLabel' | 'delivery' | 'text'

type SourceCoverageItem = {
  id: string
  type: StructuredScriptSourceSegment['type']
  field: SourceCoverageField
  text: string
}

export type SourcePromptFile = {
  path: string
  content: string
}

export type MissingSourceCoverageItem = {
  id: string
  type: StructuredScriptSourceSegment['type']
  field: SourceCoverageField
  excerpt: string
}

export type SourceCoverageReport = {
  complete: boolean
  totalSegments: number
  coveredSegments: number
  missingSegments: Array<{
    id: string
    type: StructuredScriptSourceSegment['type']
    excerpt: string
  }>
  missingItems: MissingSourceCoverageItem[]
  promptFiles: string[]
}

const PANEL_DIRECTORY_PATTERN = /^panel-\d+$/

const formatExcerpt = (text: string): string => {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized
}

const getSourceCoverageItems = (
  segment: StructuredScriptSourceSegment
): SourceCoverageItem[] => {
  const items: SourceCoverageItem[] = []

  if (segment.speakerLabel) {
    items.push({
      id: segment.id,
      type: segment.type,
      field: 'speakerLabel',
      text: segment.speakerLabel,
    })
  }

  if (segment.delivery) {
    items.push({
      id: segment.id,
      type: segment.type,
      field: 'delivery',
      text: segment.delivery,
    })
  }

  items.push({
    id: segment.id,
    type: segment.type,
    field: 'text',
    text: segment.text,
  })

  return items.filter(item => item.text.trim().length > 0)
}

export const validateSceneSourceSegmentCoverage = (
  sceneData: ScenePromptData,
  sourceSegments: StructuredScriptSourceSegment[]
): void => {
  const validSourceSegmentIds = new Set(sourceSegments.map(segment => segment.id))
  const coveredSourceSegmentIds = new Set<string>()
  const unknownSourceSegmentRefs: Array<{ id: string; panelNumber: number }> = []

  for (const panel of sceneData.panels) {
    for (const sourceSegmentId of panel.sourceSegmentIds) {
      if (!validSourceSegmentIds.has(sourceSegmentId)) {
        unknownSourceSegmentRefs.push({ id: sourceSegmentId, panelNumber: panel.number })
        continue
      }

      coveredSourceSegmentIds.add(sourceSegmentId)
    }
  }

  if (unknownSourceSegmentRefs.length > 0) {
    const details = unknownSourceSegmentRefs
      .map(ref => `${ref.id} (panel ${ref.panelNumber})`)
      .join(', ')
    throw new Error(`Scene JSON references unknown source segment ID(s): ${details}`)
  }

  const missingSegments = sourceSegments.filter(segment => !coveredSourceSegmentIds.has(segment.id))
  if (missingSegments.length > 0) {
    const details = missingSegments
      .slice(0, 8)
      .map(segment => `${segment.id} "${formatExcerpt(segment.text)}"`)
      .join('; ')
    const suffix = missingSegments.length > 8 ? `; and ${missingSegments.length - 8} more` : ''

    throw new Error(
      `Scene JSON source coverage incomplete: missing ${missingSegments.length} ` +
      `source segment(s): ${details}${suffix}`
    )
  }
}

export const resolvePanelSourceSegments = (
  sourceSegmentIds: string[],
  sourceSegments: StructuredScriptSourceSegment[]
): StructuredScriptSourceSegment[] => {
  const segmentById = new Map(sourceSegments.map(segment => [segment.id, segment]))

  return sourceSegmentIds.map(sourceSegmentId => {
    const sourceSegment = segmentById.get(sourceSegmentId)
    if (!sourceSegment) {
      throw new Error(`Panel references unknown source segment ID "${sourceSegmentId}"`)
    }

    return sourceSegment
  })
}

export const formatSourceSegmentsMarkdown = (
  sourceSegments: StructuredScriptSourceSegment[]
): string => {
  const sections = [
    '## Source Segments',
    'These source-authored script segments must be represented by this panel without paraphrasing dialogue.',
  ]

  if (sourceSegments.length === 0) {
    sections.push('No source segments are assigned to this panel.')
    return sections.join('\n\n')
  }

  for (const segment of sourceSegments) {
    const headingParts = [
      `### ${segment.id}`,
      `Type: ${segment.type}`,
      ...(segment.beatIndex ? [`Beat: ${segment.beatIndex}`] : []),
    ]
    const metadata = [
      ...(segment.speakerLabel ? [`Speaker Label: ${segment.speakerLabel}`] : []),
      ...(segment.delivery ? [`Delivery: ${segment.delivery}`] : []),
    ]

    sections.push([
      headingParts.join('\n'),
      ...metadata,
      '',
      '```text',
      segment.text,
      '```',
    ].join('\n'))
  }

  return sections.join('\n\n')
}

export const verifySourceSegmentCoverageInPromptFiles = (
  sourceSegments: StructuredScriptSourceSegment[],
  promptFiles: SourcePromptFile[]
): SourceCoverageReport => {
  const combinedPromptContent = promptFiles.map(promptFile => promptFile.content).join('\n\n')
  const missingItems = sourceSegments
    .flatMap(getSourceCoverageItems)
    .filter(item => !combinedPromptContent.includes(item.text))
    .map(item => ({
      id: item.id,
      type: item.type,
      field: item.field,
      excerpt: formatExcerpt(item.text),
    }))

  const missingSegmentIds = new Set(missingItems.map(item => item.id))
  const missingSegments = sourceSegments
    .filter(segment => missingSegmentIds.has(segment.id))
    .map(segment => ({
      id: segment.id,
      type: segment.type,
      excerpt: formatExcerpt(segment.text),
    }))

  return {
    complete: missingItems.length === 0,
    totalSegments: sourceSegments.length,
    coveredSegments: sourceSegments.length - missingSegments.length,
    missingSegments,
    missingItems,
    promptFiles: promptFiles.map(promptFile => promptFile.path),
  }
}

export const formatPromptCoverageError = (report: SourceCoverageReport): string => {
  const details = report.missingItems
    .slice(0, 8)
    .map(item => `${item.id}.${item.field} "${item.excerpt}"`)
    .join('; ')
  const suffix = report.missingItems.length > 8
    ? `; and ${report.missingItems.length - 8} more`
    : ''

  return (
    `Panel prompt source coverage incomplete: missing ${report.missingItems.length} ` +
    `source text item(s): ${details}${suffix}`
  )
}

export const assertSourceCoverageReportComplete = (
  report: SourceCoverageReport
): void => {
  if (!report.complete) {
    throw new Error(formatPromptCoverageError(report))
  }
}

const readPanelPromptFiles = async (sceneSlug: string): Promise<SourcePromptFile[]> => {
  const panelPromptsDirectory = getPanelPromptsDirectory(sceneSlug)
  const sceneEntries = await readdir(panelPromptsDirectory, { withFileTypes: true })
  const panelDirectories = sceneEntries
    .filter(entry => entry.isDirectory() && PANEL_DIRECTORY_PATTERN.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name))
  const promptFiles: SourcePromptFile[] = []

  for (const panelDirectoryEntry of panelDirectories) {
    const panelDirectory = join(panelPromptsDirectory, panelDirectoryEntry.name)
    const panelEntries = await readdir(panelDirectory, { withFileTypes: true })
    const markdownFiles = panelEntries
      .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
      .sort((left, right) => left.name.localeCompare(right.name))

    for (const markdownFile of markdownFiles) {
      const promptPath = join(panelDirectory, markdownFile.name)
      promptFiles.push({
        path: promptPath,
        content: await Bun.file(promptPath).text(),
      })
    }
  }

  return promptFiles
}

export const verifyPanelPromptSourceCoverage = async (
  sceneSlug: string
): Promise<SourceCoverageReport> => {
  const structuredScript = await parseJsonFile<StructuredScriptData>(
    getStructuredScriptPath(sceneSlug),
    StructuredScriptDataSchema,
  )
  const promptFiles = await readPanelPromptFiles(sceneSlug)
  return verifySourceSegmentCoverageInPromptFiles(structuredScript.sourceSegments, promptFiles)
}

export const writePanelPromptCoverageReport = async (
  sceneSlug: string,
  report: SourceCoverageReport
): Promise<void> => {
  const reportPath = getPanelPromptCoverageReportPath(sceneSlug)
  await mkdir(dirname(reportPath), { recursive: true })
  await Bun.write(reportPath, JSON.stringify(report, null, 2))
}

export const assertPanelPromptSourceCoverage = async (
  sceneSlug: string
): Promise<SourceCoverageReport> => {
  const report = await verifyPanelPromptSourceCoverage(sceneSlug)
  await writePanelPromptCoverageReport(sceneSlug, report)
  assertSourceCoverageReportComplete(report)
  return report
}
