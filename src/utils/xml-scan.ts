
import type { ScanBlocksOptions } from '~/types'


const isWs = (ch: string | undefined): boolean =>
  ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t'

const isNameBoundary = (ch: string | undefined): boolean =>
  ch === undefined || isWs(ch) || ch === '>' || ch === '/'

const stripBom = (s: string): string => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s)

const stripCdata = (s: string): string => {
  const open = '<![CDATA['
  const close = ']]>'
  let out = ''
  let i = 0
  while (i < s.length) {
    const start = s.indexOf(open, i)
    if (start === -1) {
      out += s.slice(i)
      break
    }
    out += s.slice(i, start)
    const end = s.indexOf(close, start + open.length)
    if (end === -1) {

      out += s.slice(start)
      break
    }
    out += s.slice(start + open.length, end)
    i = end + close.length
  }
  return out
}

export const decodeXmlEntities = (s: string): string => {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'"
  }

  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_m, body: string) => {
    const key = String(body)

    if (key in named) return named[key] as string

    if (key.startsWith('#x') || key.startsWith('#X')) {
      const hex = key.slice(2)
      const code = Number.parseInt(hex, 16)
      if (!Number.isFinite(code)) return _m
      try {
        return String.fromCodePoint(code)
      } catch {
        return _m
      }
    }

    if (key.startsWith('#')) {
      const dec = key.slice(1)
      const code = Number.parseInt(dec, 10)
      if (!Number.isFinite(code)) return _m
      try {
        return String.fromCodePoint(code)
      } catch {
        return _m
      }
    }

    return _m
  })
}

const sanitizeText = (s: string): string => decodeXmlEntities(stripCdata(s)).trim()

const findStartTagIndex = (xml: string, tag: string, fromIndex: number): number => {

  const needle = `<${tag}`
  let i = fromIndex

  while (i < xml.length) {
    const at = xml.indexOf(needle, i)
    if (at === -1) return -1
    const boundary = xml[at + needle.length]
    if (isNameBoundary(boundary)) return at
    i = at + 1
  }

  return -1
}

const findTagEnd = (xml: string, ltIndex: number): number => {

  let quote: '"' | "'" | null = null
  for (let i = ltIndex + 1; i < xml.length; i++) {
    const ch = xml[i]
    if (quote) {
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch as '"' | "'"
      continue
    }
    if (ch === '>') return i
  }
  return -1
}

const isSelfClosing = (xml: string, tagEndIndex: number): boolean => {

  for (let i = tagEndIndex - 1; i >= 0; i--) {
    const ch = xml[i]
    if (isWs(ch)) continue
    return ch === '/'
  }
  return false
}

const isOpenTagAt = (xml: string, idx: number, tag: string): boolean => {
  if (!xml.startsWith(`<${tag}`, idx)) return false
  return isNameBoundary(xml[idx + 1 + tag.length])
}

const isCloseTagAt = (xml: string, idx: number, tag: string): boolean => {
  if (!xml.startsWith(`</${tag}`, idx)) return false
  return isNameBoundary(xml[idx + 2 + tag.length])
}

const skipSpecialSection = (xml: string, idx: number): number => {

  if (xml.startsWith('<![CDATA[', idx)) {
    const end = xml.indexOf(']]>', idx + 9)
    return end === -1 ? xml.length : end + 3
  }
  if (xml.startsWith('<!--', idx)) {
    const end = xml.indexOf('-->', idx + 4)
    return end === -1 ? xml.length : end + 3
  }
  if (xml.startsWith('<?', idx)) {
    const end = xml.indexOf('?>', idx + 2)
    return end === -1 ? xml.length : end + 2
  }

  if (xml.startsWith('<!', idx)) {
    const end = xml.indexOf('>', idx + 2)
    return end === -1 ? xml.length : end + 1
  }
  return idx
}

const extractBlockFrom = (
  xml: string,
  tag: string,
  startLt: number
): { block: string; nextIndex: number } | null => {
  const startEnd = findTagEnd(xml, startLt)
  if (startEnd === -1) return null

  if (isSelfClosing(xml, startEnd)) {
    const block = xml.slice(startLt, startEnd + 1)
    return { block, nextIndex: startEnd + 1 }
  }

  let depth = 1
  let i = startEnd + 1

  while (i < xml.length) {
    const ch = xml[i]
    if (ch !== '<') {
      i++
      continue
    }

    const jumped = skipSpecialSection(xml, i)
    if (jumped !== i) {
      i = jumped
      continue
    }

    if (isCloseTagAt(xml, i, tag)) {
      const end = findTagEnd(xml, i)
      if (end === -1) return null
      depth--
      i = end + 1
      if (depth === 0) {
        const block = xml.slice(startLt, i)
        return { block, nextIndex: i }
      }
      continue
    }

    if (isOpenTagAt(xml, i, tag)) {
      const end = findTagEnd(xml, i)
      if (end === -1) return null
      if (!isSelfClosing(xml, end)) depth++
      i = end + 1
      continue
    }

    const end = findTagEnd(xml, i)
    if (end === -1) return null
    i = end + 1
  }

  return null
}

export const scanTagBlocks = (xmlRaw: string, tag: string, opts: ScanBlocksOptions = {}): string[] => {
  const xml = stripBom(xmlRaw)
  const max = typeof opts.max === 'number' && opts.max > 0 ? opts.max : Number.POSITIVE_INFINITY

  const blocks: string[] = []
  let i = 0

  while (i < xml.length && blocks.length < max) {
    const start = findStartTagIndex(xml, tag, i)
    if (start === -1) break

    const extracted = extractBlockFrom(xml, tag, start)
    if (!extracted) break

    blocks.push(extracted.block)
    i = extracted.nextIndex
  }

  return blocks
}

export const firstTagBlock = (xml: string, tag: string): string | undefined => {
  const blocks = scanTagBlocks(xml, tag, { max: 1 })
  return blocks[0]
}

export const firstStartTag = (xmlRaw: string, tag: string): string | undefined => {
  const xml = stripBom(xmlRaw)
  const start = findStartTagIndex(xml, tag, 0)
  if (start === -1) return undefined
  const end = findTagEnd(xml, start)
  if (end === -1) return undefined
  return xml.slice(start, end + 1)
}

export const innerXml = (tagBlock: string, tag: string): string => {
  const openStart = tagBlock.indexOf(`<${tag}`)
  if (openStart === -1) return ''
  const openEnd = findTagEnd(tagBlock, openStart)
  if (openEnd === -1) return ''

  if (isSelfClosing(tagBlock, openEnd)) return ''

  const closeStart = tagBlock.lastIndexOf(`</${tag}`)
  if (closeStart === -1 || closeStart <= openEnd) return ''
  return tagBlock.slice(openEnd + 1, closeStart)
}

export const firstTagText = (xmlOrBlock: string, tag: string): string | undefined => {
  const block = firstTagBlock(xmlOrBlock, tag)
  if (!block) return undefined
  const raw = innerXml(block, tag)
  const text = sanitizeText(raw)
  return text.length > 0 ? text : undefined
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const readAttr = (startTagSnippet: string, attrName: string): string | undefined => {
  const name = escapeRegExp(attrName)
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')
  const m = startTagSnippet.match(re)
  const v = (m?.[1] ?? m?.[2] ?? '').trim()
  return v.length > 0 ? decodeXmlEntities(v) : undefined
}

export const firstTagAttr = (xmlOrBlock: string, tag: string, attrName: string): string | undefined => {
  const open = firstStartTag(xmlOrBlock, tag)
  if (!open) return undefined
  return readAttr(open, attrName)
}
