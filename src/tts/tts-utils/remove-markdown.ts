import { l } from '@/logging'

const p = '[tts/tts-utils/remove-markdown]'

export interface RemoveMarkdownOptions {
  listUnicodeChar?: string | false
  stripListLeaders?: boolean
  gfm?: boolean
  useImgAltText?: boolean
  abbr?: boolean
  replaceLinksWithURL?: boolean
  htmlTagsToSkip?: string[]
  throwError?: boolean
}

export function removeMarkdown(md: string, options: RemoveMarkdownOptions = {}): string {
  const opts: Required<RemoveMarkdownOptions> = {
    listUnicodeChar: options.listUnicodeChar ?? false,
    stripListLeaders: options.stripListLeaders ?? true,
    gfm: options.gfm ?? true,
    useImgAltText: options.useImgAltText ?? true,
    abbr: options.abbr ?? false,
    replaceLinksWithURL: options.replaceLinksWithURL ?? false,
    htmlTagsToSkip: options.htmlTagsToSkip ?? [],
    throwError: options.throwError ?? false
  }

  let output = md || ''
  
  l.dim(`${p} Processing markdown text with ${output.length} characters`)

  output = output.replace(/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/gm, '')

  try {
    if (opts.stripListLeaders) {
      if (opts.listUnicodeChar) {
        output = output.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, opts.listUnicodeChar + ' $1')
      } else {
        output = output.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, '$1')
      }
    }
    
    if (opts.gfm) {
      output = output
        .replace(/\n={2,}/g, '\n')
        .replace(/~{3}.*\n/g, '')
        .replace(/~~/g, '')
        .replace(/```(?:.*)\n([\s\S]*?)```/g, (_, code) => code.trim())
    }
    
    if (opts.abbr) {
      output = output.replace(/\*\[.*\]:.*\n/, '')
    }
    
    let htmlReplaceRegex = /<[^>]*>/g
    if (opts.htmlTagsToSkip && opts.htmlTagsToSkip.length > 0) {
      const joinedHtmlTagsToSkip = opts.htmlTagsToSkip.join('|')
      htmlReplaceRegex = new RegExp(
        `<(?!\/?(${joinedHtmlTagsToSkip})(?=>|\s[^>]*>))[^>]*>`,
        'g'
      )
    }

    output = output
      .replace(htmlReplaceRegex, '')
      .replace(/^[=\-]{2,}\s*$/g, '')
      .replace(/\[\^.+?\](\: .*?$)?/g, '')
      .replace(/\s{0,2}\[.*?\]: .*?$/g, '')
      .replace(/\!\[(.*?)\][\[\(].*?[\]\)]/g, opts.useImgAltText ? '$1' : '')
      .replace(/\[([\s\S]*?)\]\s*[\(\[].*?[\)\]]/g, opts.replaceLinksWithURL ? '$2' : '$1')
      .replace(/^(\n)?\s{0,3}>\s?/gm, '$1')
      .replace(/^\s{1,2}\[(.*?)\]: (\S+)( ".*?")?\s*$/g, '')
      .replace(/^(\n)?\s{0,}#{1,6}\s*( (.+))? +#+$|^(\n)?\s{0,}#{1,6}\s*( (.+))?$/gm, '$1$3$4$6')
      .replace(/([\*]+)(\S)(.*?\S)??\1/g, '$2$3')
      .replace(/(^|\W)([_]+)(\S)(.*?\S)??\2($|\W)/g, '$1$3$4$5')
      .replace(/(`{3,})(.*?)\1/gm, '$2')
      .replace(/`(.+?)`/g, '$1')
      .replace(/~(.*?)~/g, '$1')
      
    l.dim(`${p} Successfully stripped markdown, output length: ${output.length} characters`)
  } catch (error) {
    l.dim(`${p} Error while removing markdown: ${error}`)
    if (opts.throwError) throw error
    return md
  }
  
  return output
}