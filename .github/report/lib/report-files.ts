/**
 * Report storage and discovery helpers.
 */

import { readdir } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'
import { REPORTS_DIR } from '../constants.ts'
import type { ReportType } from '../types.ts'
import { sanitizeForFilename } from './formatters.ts'
import { ensureDir, fileExists } from './utils.ts'

export interface SaveReportArtifactsOptions {
  reportType: ReportType
  status: 'success' | 'failed'
  command: string
  model?: string
  input?: string
  jsonContent: string
  markdownContent: string
}

export interface SaveReportArtifactsResult {
  name: string
  jsonPath: string
  mdPath: string
}

export interface FindReportPathResult {
  path: string | null
  matches: string[]
}

function buildReportName(command: string, model?: string, input?: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const commandSlug = sanitizeForFilename(command)
  const modelSlug = model ? `-${sanitizeForFilename(model)}` : ''
  const inputSlug = input
    ? `-${sanitizeForFilename(input.split('/').pop()?.replace(/\.[^.]+$/, '') || 'custom')}`
    : ''

  return `${timestamp}-${commandSlug}${modelSlug}${inputSlug}`
}

export async function saveReportArtifacts(options: SaveReportArtifactsOptions): Promise<SaveReportArtifactsResult> {
  const name = buildReportName(options.command, options.model, options.input)
  const outputDir = join(REPORTS_DIR, options.reportType, options.status)
  await ensureDir(outputDir)

  const jsonPath = join(outputDir, `${name}.json`)
  const mdPath = join(outputDir, `${name}.md`)

  await Bun.write(jsonPath, options.jsonContent)
  await Bun.write(mdPath, options.markdownContent)

  return { name, jsonPath, mdPath }
}

async function collectJsonFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        return collectJsonFiles(fullPath)
      }
      return entry.isFile() && entry.name.endsWith('.json') ? [fullPath] : []
    })
  )
  return nested.flat()
}

export async function listJsonReportFiles(rootDir: string = REPORTS_DIR): Promise<string[]> {
  if (!(await fileExists(rootDir))) {
    return []
  }
  return collectJsonFiles(rootDir)
}

function normalizeNameForMatching(path: string): string {
  return basename(path, '.json').toLowerCase()
}

function toDisplayName(path: string): string {
  const rel = relative(REPORTS_DIR, path).replace(/\\/g, '/')
  return rel.replace(/\.json$/, '')
}

export async function findReportPath(name: string): Promise<FindReportPathResult> {
  const target = name.toLowerCase()
  const jsonFiles = await listJsonReportFiles(REPORTS_DIR)

  if (jsonFiles.length === 0) {
    return { path: null, matches: [] }
  }

  const exactMatches = jsonFiles.filter((path) => {
    const baseName = normalizeNameForMatching(path)
    const displayName = toDisplayName(path).toLowerCase()
    return baseName === target || displayName === target
  })
  if (exactMatches.length === 1) {
    return { path: exactMatches[0], matches: [] }
  }
  if (exactMatches.length > 1) {
    return { path: null, matches: exactMatches.map(toDisplayName) }
  }

  const partialMatches = jsonFiles.filter((path) => normalizeNameForMatching(path).includes(target))
  if (partialMatches.length === 1) {
    return { path: partialMatches[0], matches: [] }
  }
  if (partialMatches.length > 1) {
    return { path: null, matches: partialMatches.map(toDisplayName) }
  }

  return { path: null, matches: [] }
}
