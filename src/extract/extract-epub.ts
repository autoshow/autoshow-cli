import { l, err, success } from '@/logging'
import { stat, writeFile, readdir, join, basename, extname, ensureDir } from '@/node-utils'
import type { EpubExtractOptions, EpubExtractResult, EpubBatchResult } from '@/extract/extract-types'

const p = '[extract/extract-epub]'

const DEFAULT_MAX_CHARS = 39000

function getTextContent(node: any): string {
  if (!node) return ''
  
  if (node.type === 'text') {
    return node.data || ''
  }
  
  if (node.type === 'tag' && node.children) {
    return node.children.map((child: any) => getTextContent(child)).join('')
  }
  
  if (Array.isArray(node)) {
    return node.map((n: any) => getTextContent(n)).join('')
  }
  
  if (node.children) {
    return node.children.map((child: any) => getTextContent(child)).join('')
  }
  
  return ''
}

function findElements(node: any, selector: (el: any) => boolean): any[] {
  const results: any[] = []
  
  function traverse(n: any): void {
    if (Array.isArray(n)) {
      for (const child of n) {
        traverse(child)
      }
      return
    }
    
    if (n.type === 'tag') {
      if (selector(n)) {
        results.push(n)
      }
      if (n.children) {
        for (const child of n.children) {
          if (child.type === 'tag') {
            traverse(child)
          }
        }
      }
    }
  }
  
  traverse(node)
  return results
}

function cleanHtmlForTTS(html: string, parseDocument: (html: string) => any): string {
  const dom = parseDocument(html)

  if (dom.children) {
    for (const child of dom.children) {
      if (child.type === 'tag') {
        const toRemove = findElements(child, (el) => 
          el.name === 'script' || el.name === 'style'
        )
        for (const el of toRemove) {
          if (el.parent && 'children' in el.parent) {
            const idx = el.parent.children.indexOf(el)
            if (idx !== -1) el.parent.children.splice(idx, 1)
          }
        }
      }
    }
  }

  if (dom.children) {
    for (const child of dom.children) {
      if (child.type === 'tag') {
        const toRemove = findElements(child, (el) => {
          const attrs = el.attribs || {}
          const href = attrs.href || ''
          const role = attrs.role || ''
          const className = attrs.class || ''
          
          return (
            href.startsWith('#fn') ||
            href.startsWith('#footnote') ||
            el.name === 'sup' ||
            className.includes('footnote-ref') ||
            role === 'doc-noteref' ||
            role === 'doc-endnotes' ||
            role === 'doc-footnote' ||
            className.includes('footnotes') ||
            attrs.id === 'footnotes'
          )
        })
        
        for (const el of toRemove) {
          if (el.parent && 'children' in el.parent) {
            const idx = el.parent.children.indexOf(el)
            if (idx !== -1) el.parent.children.splice(idx, 1)
          }
        }
      }
    }
  }

  let text = getTextContent(dom)

  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_: string, num: string) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)))

  text = text.replace(/\[\d+\]/g, '')
  text = text.replace(/\(\d+\)/g, '')

  text = text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, '')

  text = text.replace(/\[[a-z*†‡§]\]/gi, '')

  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\n[ \t]+/g, '\n')
  text = text.replace(/[ \t]+\n/g, '\n')
  text = text.replace(/\n{3,}/g, '\n\n')

  return text.trim()
}

function finalCleanup(text: string): string {
  text = text.replace(/^[\s-]*Page\s+\d+[\s-]*$/gim, '')
  text = text.replace(/^[\s-]*\d+[\s-]*$/gm, '')

  text = text.replace(/^[\s-]*(Chapter|CHAPTER)[\s-]*$/gm, '')

  text = text.replace(/\n{3,}/g, '\n\n')

  text = text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')

  return text.trim()
}

function splitWithHardLimit(text: string, maxChars: number): string[] {
  const chunks: string[] = []
  const paragraphs = text.split(/\n\n+/)
  
  let currentChunk = ''
  
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim()
    if (!trimmed) continue
    
    const separator = currentChunk.length > 0 ? '\n\n' : ''
    const testChunk = currentChunk + separator + trimmed
    
    if (testChunk.length > maxChars) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk)
        currentChunk = ''
      }
      
      if (trimmed.length > maxChars) {
        const words = trimmed.split(/\s+/)
        let tempChunk = ''
        
        for (const word of words) {
          const wordSeparator = tempChunk.length > 0 ? ' ' : ''
          const testLength = tempChunk.length + wordSeparator.length + word.length
          
          if (testLength > maxChars) {
            if (tempChunk.length > 0) {
              chunks.push(tempChunk)
              tempChunk = ''
            }
            
            if (word.length > maxChars) {
              for (let i = 0; i < word.length; i += maxChars) {
                chunks.push(word.slice(i, i + maxChars))
              }
            } else {
              tempChunk = word
            }
          } else {
            tempChunk = tempChunk.length > 0 ? tempChunk + ' ' + word : word
          }
        }
        
        if (tempChunk.length > 0) {
          currentChunk = tempChunk
        }
      } else {
        currentChunk = trimmed
      }
    } else {
      currentChunk = testChunk
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk)
  }
  
  return chunks
}

function splitIntoNParts(text: string, n: number): string[] {
  if (n <= 0) return [text]
  if (n === 1) return [text]
  
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim())
  const totalLength = text.length
  const targetLength = Math.ceil(totalLength / n)
  
  const chunks: string[] = []
  let currentChunk = ''
  
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim()
    if (!trimmed) continue
    
    const separator = currentChunk.length > 0 ? '\n\n' : ''
    const testChunk = currentChunk + separator + trimmed
    
    if (testChunk.length >= targetLength && chunks.length < n - 1) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk)
        currentChunk = trimmed
      } else {
        chunks.push(testChunk)
        currentChunk = ''
      }
    } else {
      currentChunk = testChunk
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk)
  }
  
  while (chunks.length < n && chunks.length > 0) {
    let maxIdx = 0
    let maxLen = 0
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i]!.length > maxLen) {
        maxLen = chunks[i]!.length
        maxIdx = i
      }
    }
    
    const largestChunk = chunks[maxIdx]!
    const midPoint = Math.floor(largestChunk.length / 2)
    
    let splitPoint = midPoint
    
    const paragraphBreak = largestChunk.indexOf('\n\n', midPoint - 1000)
    if (paragraphBreak !== -1 && paragraphBreak < midPoint + 1000) {
      splitPoint = paragraphBreak + 2
    } else {
      const sentenceBreak = largestChunk.indexOf('. ', midPoint - 500)
      if (sentenceBreak !== -1 && sentenceBreak < midPoint + 500) {
        splitPoint = sentenceBreak + 2
      }
    }
    
    const firstHalf = largestChunk.slice(0, splitPoint).trim()
    const secondHalf = largestChunk.slice(splitPoint).trim()
    
    chunks.splice(maxIdx, 1, firstHalf, secondHalf)
  }
  
  return chunks
}

async function processEpubForTTS(
  epubPath: string,
  options: EpubExtractOptions,
  requestId: string
): Promise<EpubExtractResult> {
  const startTime = Date.now()
  
  try {
    l(`${p}[${requestId}] Processing`, { epubPath })

    const EPub = (await import('epub')).default
    const { parseDocument } = await import('htmlparser2')

    const epub = new EPub(epubPath)
    const baseFilename = basename(epubPath, extname(epubPath))
    const outputDir = options.output || join('output', baseFilename)

    await new Promise<void>((resolve, reject) => {
      epub.on('end', () => resolve())
      epub.on('error', (err: Error) => reject(err))
      epub.parse()
    })

    let fullText = ''
    const chapterList: any[] = epub.flow || []

    if (chapterList.length === 0) {
      const zip = (epub as any).zip
      
      if (zip && zip.names) {
        const xhtmlFiles = zip.names
          .filter((name: string) => name.endsWith('.xhtml') || name.endsWith('.html'))
          .filter((name: string) => !name.includes('toc.') && !name.includes('nav.'))
          .sort((a: string, b: string) => {
            const aMatch = a.match(/part(\d+)/)
            const bMatch = b.match(/part(\d+)/)
            if (aMatch && bMatch && aMatch[1] && bMatch[1]) {
              return parseInt(aMatch[1]) - parseInt(bMatch[1])
            }
            return a.localeCompare(b)
          })
        
        for (let i = 0; i < xhtmlFiles.length; i++) {
          const filename = xhtmlFiles[i]
          try {
            const fileData = await new Promise<Buffer>((resolve, reject) => {
              zip.readFile(filename, (error: Error | null, data: Buffer) => {
                if (error) reject(error)
                else resolve(data)
              })
            })
            
            const htmlContent = fileData.toString('utf-8')
            const cleanText = cleanHtmlForTTS(htmlContent, parseDocument)
            
            if (cleanText.trim()) {
              fullText += cleanText + '\n\n'
            }
          } catch (error) {
            l(`${p}[${requestId}] Could not process file`, { filename })
          }
        }
      }
    } else {
      for (let i = 0; i < chapterList.length; i++) {
        const chapter = chapterList[i]
        if (!chapter?.id) continue

        try {
          const chapterData = await new Promise<string>((resolve, reject) => {
            epub.getChapter(chapter.id, (error: Error | null, data: string) => {
              if (error) reject(error)
              else resolve(data)
            })
          })

          if (chapterData) {
            const cleanText = cleanHtmlForTTS(chapterData, parseDocument)
            if (cleanText.trim()) {
              fullText += cleanText + '\n\n'
            }
          }
        } catch (error) {
          l(`${p}[${requestId}] Could not process chapter`, { chapterId: chapter.id })
        }
      }
    }

    fullText = finalCleanup(fullText)

    await ensureDir(outputDir)

    let finalChunks: string[]
    if (options.split && options.split > 0) {
      finalChunks = splitIntoNParts(fullText, options.split)
    } else {
      const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS
      finalChunks = splitWithHardLimit(fullText, maxChars)
    }
    
    for (let i = 0; i < finalChunks.length; i++) {
      const chunk = finalChunks[i]
      if (!chunk) continue
      const filename = `${baseFilename}-${String(i + 1).padStart(3, '0')}.txt`
      const filepath = join(outputDir, filename)
      await writeFile(filepath, chunk, 'utf-8')
    }

    const totalWords = fullText.split(/\s+/).length
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    success(`${p}[${requestId}] Output written to`, { outputDir })
    l(`${p}[${requestId}] Files created`, { filesCreated: finalChunks.length })
    l(`${p}[${requestId}] Content stats`, { characters: fullText.length.toLocaleString(), words: totalWords.toLocaleString() })
    l(`${p}[${requestId}] Completed`, { duration })

    return {
      success: true,
      outputDir,
      filesCreated: finalChunks.length,
      totalChars: fullText.length,
      totalWords
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    err(`${p}[${requestId}] Failed`, { duration, error: errorMessage })
    
    return {
      success: false,
      error: errorMessage
    }
  }
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath)
    return stats.isFile()
  } catch {
    return false
  }
}

async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const stats = await stat(dirPath)
    return stats.isDirectory()
  } catch {
    return false
  }
}

export async function extractEpub(
  inputPath: string,
  options: EpubExtractOptions
): Promise<EpubExtractResult | EpubBatchResult> {
  const requestId = Math.random().toString(36).substring(2, 10)
  
  const isFileInput = await isFile(inputPath)
  const isDirInput = await isDirectory(inputPath)
  
  if (!isFileInput && !isDirInput) {
    return {
      success: false,
      error: `Path not found: ${inputPath}`
    }
  }
  
  if (isFileInput) {
    if (!inputPath.toLowerCase().endsWith('.epub')) {
      return {
        success: false,
        error: `Not an EPUB file: ${inputPath}`
      }
    }
    return processEpubForTTS(inputPath, options, requestId)
  }
  
  l(`${p}[${requestId}] Scanning directory`, { inputPath })
  
  try {
    const files = await readdir(inputPath)
    const epubFiles = files.filter(file => file.toLowerCase().endsWith('.epub'))
    
    if (epubFiles.length === 0) {
      return {
        success: false,
        error: `No EPUB files found in directory: ${inputPath}`
      }
    }
    
    l(`${p}[${requestId}] Found EPUB files to process`, { count: epubFiles.length })
    
    const failedFiles: string[] = []
    let processedCount = 0
    
    for (const file of epubFiles) {
      const epubPath = join(inputPath, file)
      const fileRequestId = Math.random().toString(36).substring(2, 10)
      
      try {
        const result = await processEpubForTTS(epubPath, options, fileRequestId)
        if (result.success) {
          processedCount++
        } else {
          failedFiles.push(file)
        }
      } catch (error) {
        l(`${p}[${requestId}] Error processing`, { file })
        failedFiles.push(file)
      }
    }
    
    success(`${p}[${requestId}] Batch processing complete`, { processedCount, total: epubFiles.length })
    
    return {
      success: failedFiles.length === 0,
      epubsProcessed: processedCount,
      failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
      error: failedFiles.length > 0 ? `${failedFiles.length} file(s) failed to process` : undefined
    }
  } catch (error) {
    return {
      success: false,
      error: `Error reading directory: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}
