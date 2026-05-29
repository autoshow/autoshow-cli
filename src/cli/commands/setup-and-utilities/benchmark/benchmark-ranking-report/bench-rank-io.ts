import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { PROJECT_ROOT } from '~/utils/runtime-paths'
import type { JsonObject } from './bench-rank-types'

export const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const getObject = (object: JsonObject, key: string): JsonObject | undefined => {
  const value = object[key]
  return isObject(value) ? value : undefined
}

export const getArray = (object: JsonObject, key: string): unknown[] => {
  const value = object[key]
  return Array.isArray(value) ? value : []
}

export const getObjectArray = (object: JsonObject, key: string): JsonObject[] =>
  getArray(object, key).filter(isObject)

export const getString = (object: JsonObject, key: string): string | undefined => {
  const value = object[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export const getNumber = (object: JsonObject, key: string): number | undefined => {
  const value = object[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export const getBoolean = (object: JsonObject, key: string): boolean | undefined => {
  const value = object[key]
  return typeof value === 'boolean' ? value : undefined
}

export const getNestedNumber = (object: JsonObject | undefined, key: string): number | undefined =>
  object ? getNumber(object, key) : undefined

const normalizePath = (path: string): string => path.split('\\').join('/')

export const relativeToProject = (path: string): string => normalizePath(relative(PROJECT_ROOT, path))

export const readJson = async (path: string): Promise<unknown> => {
  const text = await Bun.file(path).text()
  return JSON.parse(text) as unknown
}

export const listFilesRecursive = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const entryPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(entryPath))
    } else if (entry.isFile()) {
      files.push(entryPath)
    }
  }

  return files
}

export const firstPathSegment = (path: string): string | undefined => {
  const segments = normalizePath(path).split('/')
  return segments[0]
}

export const parentDirectoryName = (path: string): string => {
  const segments = normalizePath(path).split('/')
  return segments.length >= 2 ? segments[segments.length - 2] ?? '' : ''
}
