import type { PageResult, ZipXmlFormat, ZipXmlPage } from '~/types'
import {
  extractDocx,
  extractOdf,
  extractPptx,
  extractXlsx
} from '~/cli/commands/process-steps/step-1-download/document/zip-xml-utils'

const ZIP_XML_FORMATS = new Set(['docx', 'pptx', 'xlsx', 'odf'] as const)

export const isZipXmlFormat = (format: string): format is ZipXmlFormat =>
  ZIP_XML_FORMATS.has(format as ZipXmlFormat)

export const buildCombinedText = (
  pages: PageResult[],
  pageSeparator: string,
  includePageLabels = true
): string => {
  return pages
    .map(page => includePageLabels ? `Page ${page.pageNumber}\n${page.text.trim()}` : page.text.trim())
    .join(pageSeparator)
    .trim()
}

const zipXmlPageToPageResult = (page: ZipXmlPage): PageResult => ({
  pageNumber: page.page,
  method: 'text',
  text: page.text
})

export const runZipXmlExtract = async (
  filePath: string,
  format: ZipXmlFormat
): Promise<{ pages: PageResult[], extractionMethod: string }> => {
  switch (format) {
    case 'docx': {
      const docxResult = await extractDocx(filePath)
      return { pages: docxResult.pages.map(zipXmlPageToPageResult), extractionMethod: 'docx' }
    }
    case 'pptx': {
      const pptxResult = await extractPptx(filePath)
      return { pages: pptxResult.pages.map(zipXmlPageToPageResult), extractionMethod: 'pptx' }
    }
    case 'xlsx': {
      const xlsxResult = await extractXlsx(filePath)
      return { pages: xlsxResult.pages.map(zipXmlPageToPageResult), extractionMethod: 'xlsx' }
    }
    case 'odf': {
      const odfResult = await extractOdf(filePath)
      return { pages: odfResult.pages.map(zipXmlPageToPageResult), extractionMethod: 'odf' }
    }
  }
}

const RTF_IGNORED_DESTINATIONS = new Set([
  'annotation',
  'author',
  'colortbl',
  'datastore',
  'fonttbl',
  'footer',
  'footerf',
  'footerl',
  'footerr',
  'footnote',
  'generator',
  'header',
  'headerf',
  'headerl',
  'headerr',
  'info',
  'listoverridetable',
  'listtable',
  'object',
  'pict',
  'revtbl',
  'rsidtbl',
  'stylesheet',
  'themedata',
  'xmlnstbl'
])

type RtfState = {
  ignored: boolean
  uc: number
}

const isAsciiLetter = (value: string | undefined): boolean =>
  value !== undefined && /[a-zA-Z]/.test(value)

const isAsciiDigit = (value: string | undefined): boolean =>
  value !== undefined && /[0-9]/.test(value)

const skipRtfFallbackChars = (rtf: string, start: number, count: number): number => {
  let index = start
  let skipped = 0
  while (index < rtf.length && skipped < count) {
    if (rtf[index] === '\\' && rtf[index + 1] === "'") {
      index += 4
    } else {
      index++
    }
    skipped++
  }
  return index
}

const extractRtfText = (rtf: string): string => {
  const stack: RtfState[] = [{ ignored: false, uc: 1 }]
  let output = ''
  let index = 0

  const state = (): RtfState => stack[stack.length - 1]!
  const append = (text: string): void => {
    if (!state().ignored) output += text
  }

  while (index < rtf.length) {
    const char = rtf[index]

    if (char === '{') {
      const current = state()
      stack.push({ ignored: current.ignored, uc: current.uc })
      index++
      continue
    }

    if (char === '}') {
      if (stack.length > 1) stack.pop()
      index++
      continue
    }

    if (char !== '\\') {
      append(char ?? '')
      index++
      continue
    }

    const next = rtf[index + 1]
    if (next === undefined) {
      index++
      continue
    }

    if (next === '\\' || next === '{' || next === '}') {
      append(next)
      index += 2
      continue
    }

    if (next === '*') {
      state().ignored = true
      index += 2
      continue
    }

    if (next === "'") {
      const hex = rtf.slice(index + 2, index + 4)
      const code = Number.parseInt(hex, 16)
      if (Number.isFinite(code)) append(String.fromCharCode(code))
      index += 4
      continue
    }

    if (!isAsciiLetter(next)) {
      switch (next) {
        case '~':
          append(' ')
          break
        case '-':
          append('')
          break
        case '_':
          append('-')
          break
        case '\n':
        case '\r':
          break
        default:
          append(next)
      }
      index += 2
      continue
    }

    let wordEnd = index + 1
    while (isAsciiLetter(rtf[wordEnd])) wordEnd++
    const word = rtf.slice(index + 1, wordEnd)

    let numberEnd = wordEnd
    if (rtf[numberEnd] === '-' || isAsciiDigit(rtf[numberEnd])) {
      numberEnd++
      while (isAsciiDigit(rtf[numberEnd])) numberEnd++
    }
    const numberRaw = rtf.slice(wordEnd, numberEnd)
    const number = numberRaw.length > 0 ? Number.parseInt(numberRaw, 10) : undefined

    index = numberEnd
    if (rtf[index] === ' ') index++

    if (RTF_IGNORED_DESTINATIONS.has(word)) {
      state().ignored = true
      continue
    }

    if (state().ignored) {
      continue
    }

    switch (word) {
      case 'par':
      case 'line':
        append('\n')
        break
      case 'tab':
        append('\t')
        break
      case 'emdash':
        append('--')
        break
      case 'endash':
        append('-')
        break
      case 'lquote':
      case 'rquote':
        append("'")
        break
      case 'ldblquote':
      case 'rdblquote':
        append('"')
        break
      case 'bullet':
        append('*')
        break
      case 'uc':
        if (number !== undefined && Number.isFinite(number) && number >= 0) {
          state().uc = number
        }
        break
      case 'u': {
        if (number === undefined || !Number.isFinite(number)) break
        const codePoint = number < 0 ? number + 65536 : number
        try {
          append(String.fromCodePoint(codePoint))
        } catch {
          // Ignore malformed code points and keep parsing the rest of the file.
        }
        index = skipRtfFallbackChars(rtf, index, state().uc)
        break
      }
    }
  }

  return output
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export const extractRtfFile = async (filePath: string): Promise<PageResult[]> => {
  const rtf = await Bun.file(filePath).text()
  return [{ pageNumber: 1, method: 'text', text: extractRtfText(rtf) }]
}
