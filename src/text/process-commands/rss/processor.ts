import { generateMarkdown } from '../../process-steps/01-generate-markdown.ts'
import { downloadAudio, saveAudio } from '../../process-steps/02-download-audio.ts'
import { runTranscription } from '../../process-steps/03-run-transcription.ts'
import { selectPrompts } from '../../process-steps/04-select-prompt.ts'
import { runLLM } from '../../process-steps/05-run-llm.ts'
import { saveInfo } from '../../utils/save-info.ts'
import { l, err, logSeparator } from '../../../logging.ts'
import { selectRSSItemsToProcess } from './fetch.ts'
import { logRSSProcessingStatus } from './logging.ts'
import type { ProcessingOptions, ShowNoteMetadata } from '@/types.ts'

export async function processRSSFeeds(
  options: ProcessingOptions,
  expandedRssUrls: string[],
  llmServices?: string,
  transcriptServices?: string
): Promise<void> {
  l.dim(`[processRSSFeeds] Starting RSS feeds processing for ${expandedRssUrls.length} URLs`)
  let allItemsForCombined: ShowNoteMetadata[] = []
  
  for (const rssUrl of expandedRssUrls) {
    l.dim(`[processRSSFeeds] Processing RSS URL: ${rssUrl}`)
    
    if (options.item && options.item.length > 0) {
      l.dim('\nProcessing specific items:')
      options.item.forEach((url) => l.dim(`  - ${url}`))
    } else if (options.last) {
      l.dim(`\nProcessing the last ${options.last} items`)
    } else if (options.days) {
      l.dim(`\nProcessing items from the last ${options.days} days`)
    }
    
    try {
      const { items, channelTitle } = await selectRSSItemsToProcess(rssUrl, options)
      l.dim(`[processRSSFeeds] Selected ${items.length} items from ${channelTitle}`)
      
      if (options.info) {
        if (typeof options.info === 'string' && options.info === 'combined') {
          l.dim(`[processRSSFeeds] Collecting items from feed: ${channelTitle || rssUrl} for combined output`)
          allItemsForCombined = [...allItemsForCombined, ...items]
          continue
        }
        
        if (items.length > 0) {
          await saveAudio('', true)
          await saveInfo('rss', items, channelTitle || '')
        }
        continue
      }
      
      if (items.length === 0) {
        l.dim('[processRSSFeeds] No items found matching the provided criteria for this feed. Skipping...')
        continue
      }
      
      logRSSProcessingStatus(items.length, items.length, options)
      
      const results = []
      for (const [index, item] of items.entries()) {
        logSeparator({
          type: 'rss',
          index,
          total: items.length,
          descriptor: item.title
        })
        l.opts('Parameters passed to processItem:\n')
        l.opts(`  - llmServices: ${llmServices}\n  - transcriptServices: ${transcriptServices}\n`)
        
        try {
          l.dim(`[processRSSFeeds] Processing item ${index + 1}/${items.length}: ${item.title}`)
          const { frontMatter, finalPath, filename, metadata } = await generateMarkdown(options, item)
          if (item.showLink) {
            await downloadAudio(options, item.showLink, filename)
          } else {
            throw new Error(`showLink is undefined for item: ${item.title}`)
          }
          const { transcript, modelId: transcriptionModel } = await runTranscription(options, finalPath, transcriptServices)
          const selectedPrompts = await selectPrompts(options)
          const llmOutput = await runLLM(
            options,
            finalPath,
            frontMatter,
            selectedPrompts,
            transcript,
            metadata as ShowNoteMetadata,
            llmServices,
            transcriptServices,
            transcriptionModel
          )
          if (!options.saveAudio) {
            await saveAudio(finalPath)
          }
          results.push({
            frontMatter,
            prompt: selectedPrompts,
            llmOutput: llmOutput || '',
            transcript,
          })
          l.dim(`[processRSSFeeds] Successfully processed item: ${item.title}`)
        } catch (error) {
          err(`[processRSSFeeds] Error processing item ${item.title}: ${(error as Error).message}`)
          results.push({
            frontMatter: '',
            prompt: '',
            llmOutput: '',
            transcript: '',
          })
        }
      }
    } catch (error) {
      err(`[processRSSFeeds] Error processing RSS feed ${rssUrl}: ${(error as Error).message}`)
      throw error
    }
  }
  
  if (options.info === 'combined' && allItemsForCombined.length > 0) {
    l.dim(`[processRSSFeeds] Processing combined info for ${allItemsForCombined.length} items from ${expandedRssUrls.length} RSS feeds`)
    allItemsForCombined.sort((a, b) => {
      const dateA = new Date(a.publishDate || '1970-01-01')
      const dateB = new Date(b.publishDate || '1970-01-01')
      return dateB.getTime() - dateA.getTime()
    })
    l.dim(`[processRSSFeeds] Sorted ${allItemsForCombined.length} items by publish date (newest first)`)
    await saveAudio('', true)
    await saveInfo('combined', allItemsForCombined, 'combined-feeds')
  }
  
  l.dim('[processRSSFeeds] RSS feeds processing completed')
}