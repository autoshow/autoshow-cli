import { inflateRawSync } from 'node:zlib'
import { inspectEpubWithReader, normalizeEntryPath } from './inspect-core'
import type { EpubContentEntry, EpubContentReader, EpubInspectOutput, ZipEntry } from '~/types'

const EOCD_SIG = 0x06054b50
const CD_SIG = 0x02014b50
const LFH_SIG = 0x04034b50

const findEocd = (buffer: Buffer): number => {
  const limit = Math.max(0, buffer.length - 65557)
  for (let idx = buffer.length - 22; idx >= limit; idx--) {
    if (buffer.readUInt32LE(idx) === EOCD_SIG) return idx
  }
  throw new Error('Not a valid ZIP file: End of Central Directory not found')
}

const readCentralDirectory = (buffer: Buffer): ZipEntry[] => {
  const eocd = findEocd(buffer)
  const count = buffer.readUInt16LE(eocd + 10)
  const offset = buffer.readUInt32LE(eocd + 16)

  const entries: ZipEntry[] = []
  let pos = offset
  for (let idx = 0; idx < count; idx++) {
    if (buffer.readUInt32LE(pos) !== CD_SIG) break
    const method = buffer.readUInt16LE(pos + 10)
    const compSize = buffer.readUInt32LE(pos + 20)
    const uncompSize = buffer.readUInt32LE(pos + 24)
    const fnLen = buffer.readUInt16LE(pos + 28)
    const extraLen = buffer.readUInt16LE(pos + 30)
    const commentLen = buffer.readUInt16LE(pos + 32)
    const localOffset = buffer.readUInt32LE(pos + 42)
    const name = buffer.subarray(pos + 46, pos + 46 + fnLen).toString('utf8')
    entries.push({
      name: normalizeEntryPath(name),
      method,
      compSize,
      uncompSize,
      localOffset
    })
    pos += 46 + fnLen + extraLen + commentLen
  }
  return entries
}

const readEntryData = (buffer: Buffer, entry: ZipEntry): Buffer => {
  const localPos = entry.localOffset
  if (buffer.readUInt32LE(localPos) !== LFH_SIG) {
    throw new Error(`Local file header missing for entry: ${entry.name}`)
  }

  const nameLength = buffer.readUInt16LE(localPos + 26)
  const extraLength = buffer.readUInt16LE(localPos + 28)
  const dataStart = localPos + 30 + nameLength + extraLength
  const compressed = buffer.subarray(dataStart, dataStart + entry.compSize)

  if (entry.method === 0) return Buffer.from(compressed)
  if (entry.method === 8) return inflateRawSync(compressed)
  throw new Error(`Unsupported ZIP compression method ${entry.method} for entry: ${entry.name}`)
}

const createZipReader = async (filePath: string): Promise<EpubContentReader> => {
  const buffer = Buffer.from(await Bun.file(filePath).arrayBuffer())
  const zipEntries = readCentralDirectory(buffer)
  const byPath = new Map(zipEntries.map(entry => [entry.name, entry]))
  const entries: EpubContentEntry[] = zipEntries.map(entry => ({
    path: entry.name,
    size: entry.uncompSize,
    compressedSize: entry.compSize
  }))

  return {
    adapterLabel: 'bun-zip',
    entries,
    hasEntry: (entryPath: string) => byPath.has(normalizeEntryPath(entryPath)),
    readText: async (entryPath: string) => {
      const normalized = normalizeEntryPath(entryPath)
      const entry = byPath.get(normalized)
      if (!entry) {
        throw new Error(`EPUB entry not found: ${normalized}`)
      }
      return readEntryData(buffer, entry).toString('utf8')
    }
  }
}

export const runEpubBunInspect = async (filePath: string): Promise<EpubInspectOutput> => {
  const reader = await createZipReader(filePath)
  return await inspectEpubWithReader(reader, 'bun')
}
