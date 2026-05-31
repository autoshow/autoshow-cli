

import { inflateRawSync } from 'node:zlib'
import { scanTagBlocks, innerXml, firstTagText } from '~/utils/xml-scan'
import type { ZipXmlPage, ZipXmlResult, ZipEntry } from '~/types'

const EOCD_SIG = 0x06054b50
const CD_SIG   = 0x02014b50
const LFH_SIG  = 0x04034b50

const findEocd = (buf: Buffer): number => {

  const limit = Math.max(0, buf.length - 65557)
  for (let i = buf.length - 22; i >= limit; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i
  }
  throw new Error('Not a valid ZIP file: End of Central Directory not found')
}

const readZipCentralDirectory = (buf: Buffer): ZipEntry[] => {
  const eocd = findEocd(buf)
  const cdCount  = buf.readUInt16LE(eocd + 10)
  const cdOffset = buf.readUInt32LE(eocd + 16)

  const entries: ZipEntry[] = []
  let pos = cdOffset

  for (let i = 0; i < cdCount; i++) {
    if (buf.readUInt32LE(pos) !== CD_SIG) break

    const method       = buf.readUInt16LE(pos + 10)
    const compSize     = buf.readUInt32LE(pos + 20)
    const uncompSize   = buf.readUInt32LE(pos + 24)
    const fnLen        = buf.readUInt16LE(pos + 28)
    const extraLen     = buf.readUInt16LE(pos + 30)
    const commentLen   = buf.readUInt16LE(pos + 32)
    const localOffset  = buf.readUInt32LE(pos + 42)
    const name         = buf.subarray(pos + 46, pos + 46 + fnLen).toString('utf8')

    entries.push({ name, method, compSize, uncompSize, localOffset })
    pos += 46 + fnLen + extraLen + commentLen
  }

  return entries
}

export const readZipEntryData = (buf: Buffer, entry: ZipEntry): Buffer => {
  const lpos = entry.localOffset
  if (buf.readUInt32LE(lpos) !== LFH_SIG) {
    throw new Error(`Local file header missing for entry: ${entry.name}`)
  }

  const lfnLen   = buf.readUInt16LE(lpos + 26)
  const lextra   = buf.readUInt16LE(lpos + 28)
  const dataStart = lpos + 30 + lfnLen + lextra
  const raw = buf.subarray(dataStart, dataStart + entry.compSize)

  if (entry.method === 0) return Buffer.from(raw)
  if (entry.method === 8) return inflateRawSync(raw)
  throw new Error(`Unsupported ZIP compression method ${entry.method} for: ${entry.name}`)
}

const readEntryText = (buf: Buffer, entry: ZipEntry): string =>
  readZipEntryData(buf, entry).toString('utf8')

export const openZip = async (filePath: string): Promise<{ buf: Buffer, entries: Map<string, ZipEntry> }> => {
  const buf = Buffer.from(await Bun.file(filePath).arrayBuffer())
  const list = readZipCentralDirectory(buf)
  const entries = new Map(list.map(e => [e.name, e]))
  return { buf, entries }
}

const stripNsPrefixes = (xml: string): string =>
  xml.replace(/<\/?[a-zA-Z][a-zA-Z0-9]*:/g, m => m[0] === '<' && m[1] === '/' ? '</' : '<')

const collectParagraphTexts = (xml: string): string[] => {
  const stripped = stripNsPrefixes(xml)
  return scanTagBlocks(stripped, 'p')
    .map(block => {

      const runs = scanTagBlocks(block, 't').map(t => innerXml(t, 't')).join('')
      return runs.trim()
    })
    .filter(s => s.length > 0)
}

const buildResult = (pages: ZipXmlPage[]): ZipXmlResult => ({
  pages,
  totalPages: pages.length,
  text: pages.map(p => p.text).filter(Boolean).join('\n\n')
})

export const extractDocx = async (filePath: string): Promise<ZipXmlResult> => {
  const { buf, entries } = await openZip(filePath)
  const entry = entries.get('word/document.xml')
  if (!entry) throw new Error('word/document.xml not found in DOCX archive')

  const xml = readEntryText(buf, entry)
  const paragraphs = collectParagraphTexts(xml)
  const text = paragraphs.join(' ').replace(/\s{2,}/g, ' ').trim()

  return buildResult([{ page: 1, text }])
}

export const extractPptx = async (filePath: string): Promise<ZipXmlResult> => {
  const { buf, entries } = await openZip(filePath)

  const slideEntries = [...entries.values()]
    .filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.name))
    .sort((a, b) => {
      const na = parseInt(a.name.match(/\d+/)?.[0] ?? '0', 10)
      const nb = parseInt(b.name.match(/\d+/)?.[0] ?? '0', 10)
      return na - nb
    })

  const pages: ZipXmlPage[] = slideEntries
    .map((entry, idx) => {
      const xml = readEntryText(buf, entry)
      const text = collectParagraphTexts(xml).join(' ').replace(/\s{2,}/g, ' ').trim()
      return { page: idx + 1, text }
    })
    .filter(p => p.text.length > 0)

  return buildResult(pages)
}

export const extractXlsx = async (filePath: string): Promise<ZipXmlResult> => {
  const { buf, entries } = await openZip(filePath)

  const sharedStrings: string[] = []
  const ssEntry = entries.get('xl/sharedStrings.xml')
  if (ssEntry) {
    const ssXml = stripNsPrefixes(readEntryText(buf, ssEntry))
    for (const siBlock of scanTagBlocks(ssXml, 'si')) {

      const text = scanTagBlocks(siBlock, 't').map(t => innerXml(t, 't')).join('')
      sharedStrings.push(text)
    }
  }

  const sheetEntries = [...entries.values()]
    .filter(e => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name))
    .sort((a, b) => {
      const na = parseInt(a.name.match(/\d+/)?.[0] ?? '0', 10)
      const nb = parseInt(b.name.match(/\d+/)?.[0] ?? '0', 10)
      return na - nb
    })

  const pages: ZipXmlPage[] = sheetEntries.map((entry, idx) => {
    const rawXml = readEntryText(buf, entry)
    const xml = stripNsPrefixes(rawXml)

    const lines: string[] = []
    for (const rowBlock of scanTagBlocks(xml, 'row')) {
      const cells: string[] = []
      for (const cBlock of scanTagBlocks(rowBlock, 'c')) {

        const isSharedStr = cBlock.includes('t="s"') || cBlock.includes("t='s'")
        const vText = firstTagText(cBlock, 'v') ?? ''

        if (isSharedStr) {
          const idx = parseInt(vText, 10)
          cells.push(Number.isFinite(idx) ? (sharedStrings[idx] ?? vText) : vText)
        } else {
          cells.push(vText)
        }
      }
      if (cells.some(c => c.length > 0)) {
        lines.push(cells.join('\t'))
      }
    }

    return { page: idx + 1, text: lines.join('\n') }
  }).filter(p => p.text.length > 0)

  return buildResult(pages)
}

export const extractOdf = async (filePath: string): Promise<ZipXmlResult> => {
  const { buf, entries } = await openZip(filePath)
  const entry = entries.get('content.xml')
  if (!entry) throw new Error('content.xml not found in ODF archive')

  const xml = stripNsPrefixes(readEntryText(buf, entry))

  const paragraphs = scanTagBlocks(xml, 'p')
    .map(block => innerXml(block, 'p').trim())
    .filter(s => s.length > 0)

  const text = paragraphs.join(' ').replace(/\s{2,}/g, ' ').trim()

  return buildResult([{ page: 1, text }])
}
