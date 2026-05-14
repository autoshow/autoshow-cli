type HtmlRewriterText = {
  text: string
}

type HtmlRewriterElement = {
  tagName: string
  selfClosing: boolean
  canHaveContent: boolean
  getAttribute: (name: string) => string | null
  onEndTag: (handler: () => void) => void
}

type HtmlRewriterHandlers = {
  element?: (element: HtmlRewriterElement) => void
  text?: (text: HtmlRewriterText) => void
}

type HtmlRewriterInstance = {
  on: (selector: string, handlers: HtmlRewriterHandlers) => HtmlRewriterInstance
  transform: (response: Response) => Response
}

type HtmlRewriterConstructor = new () => HtmlRewriterInstance

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

const ENTITY_REPLACEMENTS: Record<string, string> = {
  amp: '&',
  apos: "'",
  copy: '\u00a9',
  gt: '>',
  hellip: '\u2026',
  ldquo: '\u201c',
  lsquo: '\u2018',
  lt: '<',
  mdash: '\u2014',
  nbsp: ' ',
  ndash: '\u2013',
  quot: '"',
  rdquo: '\u201d',
  reg: '\u00ae',
  rsquo: '\u2019',
  trade: '\u2122'
}

const decodeEpubEntities = (value: string): string =>
  value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9-]*);/gi, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const codePoint = Number.parseInt(entity.slice(2), 16)
      return Number.isFinite(codePoint) ? codePointToString(codePoint, match) : match
    }

    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(codePoint) ? codePointToString(codePoint, match) : match
    }

    return ENTITY_REPLACEMENTS[entity.toLowerCase()] ?? match
  })

const codePointToString = (codePoint: number, fallback: string): string => {
  try {
    return String.fromCodePoint(codePoint)
  } catch {
    return fallback
  }
}

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

const getAttributeBag = (element: HtmlRewriterElement): string[] => {
  const values = [
    lower(decodeEpubEntities(element.getAttribute('class') ?? '')),
    lower(decodeEpubEntities(element.getAttribute('id') ?? '')),
    lower(decodeEpubEntities(element.getAttribute('role') ?? '')),
    lower(decodeEpubEntities(element.getAttribute('epub:type') ?? '')),
    lower(decodeEpubEntities(element.getAttribute('type') ?? ''))
  ]

  return values.filter((value) => value.length > 0)
}

const hasFootnoteAttributes = (element: HtmlRewriterElement): boolean => {
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

const isFootnoteReference = (element: HtmlRewriterElement): boolean => {
  const tag = element.tagName.toLowerCase()
  if (tag === 'sup') {
    return true
  }

  const href = lower(decodeEpubEntities(element.getAttribute('href') ?? ''))
  if (tag === 'a' && (/^#(?:fn|footnote|endnote|note)/.test(href) || hasFootnoteAttributes(element))) {
    return true
  }

  return hasFootnoteAttributes(element) && ['a', 'span', 'label'].includes(tag)
}

const isFootnoteContainer = (element: HtmlRewriterElement): boolean => {
  if (!hasFootnoteAttributes(element)) {
    return false
  }

  const tag = element.tagName.toLowerCase()
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

type ExtractionState = {
  bodyDepth: number
  bodyText: string
  documentText: string
  hasBody: boolean
  skipDepth: number
}

const appendToActiveOutputs = (
  state: ExtractionState,
  append: (value: string) => string
): void => {
  state.documentText = append(state.documentText)
  if (state.bodyDepth > 0) {
    state.bodyText = append(state.bodyText)
  }
}

const applyElementEnd = (tag: string, state: ExtractionState): void => {
  if (tag === 'td' || tag === 'th') {
    appendToActiveOutputs(state, (value) =>
      value.endsWith('\t') || value.endsWith('\n') || value.length === 0
        ? value
        : `${trimTrailingWhitespace(value)}\t`
    )
    return
  }

  if (tag === 'tr') {
    appendToActiveOutputs(state, ensureParagraphBreak)
    return
  }

  if (BLOCK_TAGS.has(tag)) {
    appendToActiveOutputs(state, ensureParagraphBreak)
  }
}

const shouldSkipElement = (element: HtmlRewriterElement): boolean => {
  const tag = element.tagName.toLowerCase()
  return SKIP_TAGS.has(tag) || isFootnoteReference(element) || isFootnoteContainer(element)
}

const elementCanHaveEndTag = (element: HtmlRewriterElement): boolean =>
  element.selfClosing !== true && element.canHaveContent !== false

const getHtmlRewriter = (): HtmlRewriterConstructor => {
  const htmlRewriterGlobal = globalThis as typeof globalThis & { HTMLRewriter?: HtmlRewriterConstructor }
  const HTMLRewriterCtor = htmlRewriterGlobal.HTMLRewriter
  if (typeof HTMLRewriterCtor !== 'function') {
    throw new Error('Bun HTMLRewriter is required for EPUB HTML cleanup.')
  }
  return HTMLRewriterCtor
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

export const cleanEpubHtmlToText = async (html: string): Promise<string> => {
  const state: ExtractionState = {
    bodyDepth: 0,
    bodyText: '',
    documentText: '',
    hasBody: false,
    skipDepth: 0
  }

  const HTMLRewriterCtor = getHtmlRewriter()
  const rewriter = new HTMLRewriterCtor().on('*', {
    element(element) {
      const tag = element.tagName.toLowerCase()

      if (state.skipDepth > 0) {
        return
      }

      if (shouldSkipElement(element)) {
        if (elementCanHaveEndTag(element)) {
          state.skipDepth += 1
          element.onEndTag(() => {
            state.skipDepth = Math.max(0, state.skipDepth - 1)
          })
        }
        return
      }

      if (tag === 'body') {
        state.hasBody = true
        if (elementCanHaveEndTag(element)) {
          state.bodyDepth += 1
          element.onEndTag(() => {
            state.bodyDepth = Math.max(0, state.bodyDepth - 1)
          })
        }
        return
      }

      if (tag === 'br') {
        appendToActiveOutputs(state, ensureLineBreak)
        return
      }

      if (!elementCanHaveEndTag(element)) {
        applyElementEnd(tag, state)
        return
      }

      element.onEndTag(() => {
        if (state.skipDepth > 0) {
          return
        }
        applyElementEnd(tag, state)
      })
    },
    text(text) {
      if (state.skipDepth > 0) {
        return
      }

      appendToActiveOutputs(state, (value) => appendInlineText(value, decodeEpubEntities(text.text)))
    }
  })

  await rewriter.transform(new Response(html)).text()

  return finalizeEpubText(state.hasBody ? state.bodyText : state.documentText)
}
