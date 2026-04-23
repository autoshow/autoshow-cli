import { parseHTML } from 'linkedom'
import type { DomDocument, DomElement, DomNode } from '../ocr-types'

const ELEMENT_NODE = 1
const TEXT_NODE = 3

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'caption',
  'dd',
  'div',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul'
])

const SKIP_TAGS = new Set(['head', 'script', 'style', 'noscript'])

const FOOTNOTE_ROLE_TOKENS = new Set(['doc-noteref', 'doc-endnotes', 'doc-footnote', 'doc-endnote', 'note', 'footnote'])
const FOOTNOTE_TYPE_TOKENS = new Set(['noteref', 'endnotes', 'footnote', 'endnote'])

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ')

const normalizeLineWhitespace = (value: string): string =>
  value.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n')

const lower = (value: string | null): string =>
  value?.toLowerCase() ?? ''

const attrIncludesToken = (value: string, token: string): boolean =>
  value.split(/\s+/).includes(token)

const attrContainsWord = (value: string, word: string): boolean =>
  new RegExp(`(?:^|[^a-z])${word}(?:[^a-z]|$)`, 'i').test(value)

const getAttributeBag = (element: DomElement): string[] => {
  const values = [
    lower(element.getAttribute('class')),
    lower(element.getAttribute('id')),
    lower(element.getAttribute('role')),
    lower(element.getAttribute('epub:type')),
    lower(element.getAttribute('type'))
  ]

  return values.filter((value) => value.length > 0)
}

const hasFootnoteAttributes = (element: DomElement): boolean => {
  const values = getAttributeBag(element)
  return values.some((value) =>
    FOOTNOTE_ROLE_TOKENS.has(value)
    || FOOTNOTE_TYPE_TOKENS.has(value)
    || value.includes('footnote')
    || value.includes('endnote')
    || value.includes('noteref')
    || attrIncludesToken(value, 'doc-noteref')
    || attrIncludesToken(value, 'doc-footnote')
    || attrIncludesToken(value, 'doc-endnote')
    || attrIncludesToken(value, 'doc-endnotes')
    || attrIncludesToken(value, 'noteref')
    || attrIncludesToken(value, 'footnote')
    || attrIncludesToken(value, 'endnote')
    || attrIncludesToken(value, 'endnotes')
    || attrContainsWord(value, 'footnote')
    || attrContainsWord(value, 'endnote')
    || attrContainsWord(value, 'notes')
  )
}

const isFootnoteReference = (element: DomElement): boolean => {
  const tag = element.localName.toLowerCase()
  if (tag === 'sup') {
    return true
  }

  const href = lower(element.getAttribute('href'))
  if (tag === 'a' && (/^#(?:fn|footnote|endnote|note)/.test(href) || hasFootnoteAttributes(element))) {
    return true
  }

  return hasFootnoteAttributes(element) && ['a', 'span', 'label'].includes(tag)
}

const isFootnoteContainer = (element: DomElement): boolean => {
  if (!hasFootnoteAttributes(element)) {
    return false
  }

  const tag = element.localName.toLowerCase()
  return ['aside', 'div', 'footer', 'li', 'nav', 'ol', 'section'].includes(tag)
}

const trimTrailingWhitespace = (value: string): string =>
  value.replace(/[ \t]+$/g, '')

const ensureLineBreak = (value: string): string => {
  const trimmed = trimTrailingWhitespace(value)
  if (trimmed.length === 0 || trimmed.endsWith('\n')) {
    return trimmed
  }
  return `${trimmed}\n`
}

const ensureParagraphBreak = (value: string): string => {
  const trimmed = trimTrailingWhitespace(value)
  if (trimmed.length === 0 || trimmed.endsWith('\n\n')) {
    return trimmed
  }
  if (trimmed.endsWith('\n')) {
    return `${trimmed}\n`
  }
  return `${trimmed}\n\n`
}

const appendInlineText = (value: string, addition: string): string => {
  const normalized = normalizeWhitespace(addition).trim()
  if (normalized.length === 0) {
    return value
  }

  if (value.length === 0) {
    return normalized
  }

  const lastChar = value.at(-1) ?? ''
  if (lastChar === '\n' || lastChar === '\t' || lastChar === ' ' || /^[,.;:!?)}\]%]/.test(normalized)) {
    return `${value}${normalized}`
  }

  return `${value} ${normalized}`
}

const walkNodeText = (node: DomNode, output: string): string => {
  if (node.nodeType === TEXT_NODE) {
    return appendInlineText(output, node.textContent ?? '')
  }

  if (node.nodeType !== ELEMENT_NODE) {
    return output
  }

  const element = node as DomElement
  const tag = element.localName.toLowerCase()

  if (SKIP_TAGS.has(tag)) {
    return output
  }

  if (tag === 'br') {
    return ensureLineBreak(output)
  }

  let next = output
  for (const child of Array.from(element.childNodes ?? [])) {
    next = walkNodeText(child, next)
  }

  if (tag === 'td' || tag === 'th') {
    return next.endsWith('\t') || next.endsWith('\n') || next.length === 0
      ? next
      : `${trimTrailingWhitespace(next)}\t`
  }

  if (tag === 'tr') {
    return ensureParagraphBreak(next)
  }

  if (BLOCK_TAGS.has(tag)) {
    return ensureParagraphBreak(next)
  }

  return next
}

const removeUnwantedElements = (document: DomDocument): void => {
  const elements = Array.from(document.querySelectorAll('*'))
  for (const element of elements) {
    if (isFootnoteReference(element) || isFootnoteContainer(element)) {
      element.remove()
    }
  }
}

export const finalizeEpubText = (text: string): string => {
  const cleaned = normalizeLineWhitespace(text.replace(/\r/g, ''))
    .replace(/^[\s-]*Page\s+\d+[\s-]*$/gim, '')
    .replace(/^[\s-]*\d+[\s-]*$/gm, '')
    .replace(/^[\s-]*(Chapter|CHAPTER)[\s-]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')

  return cleaned.trim()
}

export const cleanEpubHtmlToText = (html: string): string => {
  const { document } = parseHTML(html)
  const domDocument = document as unknown as DomDocument
  removeUnwantedElements(domDocument)

  const root = domDocument.body ?? domDocument.documentElement ?? domDocument
  let output = ''
  for (const child of Array.from(root.childNodes ?? [])) {
    output = walkNodeText(child, output)
  }

  return finalizeEpubText(output)
}
