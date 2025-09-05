import { generateMarkdown } from '../../process-steps/01-process-content/generate-markdown.ts'
import { downloadAudio, saveAudio } from '../../process-steps/01-process-content/download-audio.ts'
import { runTranscription } from '../../process-steps/02-run-transcription/run-transcription.ts'
import { selectPrompts } from '../../process-steps/03-select-prompts/select-prompt.ts'
import { runLLM } from '../../process-steps/04-run-llm/run-llm.ts'
import { saveInfo } from '../../utils/save-info.ts'
import { l, err, logSeparator } from '@/logging'
import { selectRSSItemsToProcess } from './fetch.ts'
import { logRSSProcessingStatus } from './rss-logging.ts'
import type { ProcessingOptions, ShowNoteMetadata } from '@/text/text-types'

export async function processRSSFeeds(
  options: ProcessingOptions,
  expandedRssUrls: string[],
  llmServices?: string,
  transcriptServices?: string
): Promise<void> {
  const p = '[text/process-commands/rss/processor]'
  let allItemsForCombined: ShowNoteMetadata[] = []
  
  for (const rssUrl of expandedRssUrls) {
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
      
      if (options.info) {
        if (typeof options.info === 'string' && options.info === 'combined') {
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
        l.warn(`${p} No items found matching criteria for ${channelTitle || rssUrl}`)
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
          const { frontMatter, finalPath, filename, metadata } = await generateMarkdown(options, item)
          if (item.showLink) {
            await downloadAudio(options, item.showLink, filename)
          } else {
            throw new Error(`showLink is undefined for item: ${item.title}`)
          }
          const { transcript, modelId: transcriptionModel, costPerMinuteCents, audioDuration } = await runTranscription(options, finalPath, transcriptServices)
          const selectedPrompts = await selectPrompts(options)
          const transcriptionCost = costPerMinuteCents * ((audioDuration || 0) / 60) / 100
          const llmOutput = await runLLM(
            options,
            finalPath,
            frontMatter,
            selectedPrompts,
            transcript,
            metadata as ShowNoteMetadata,
            llmServices,
            transcriptServices,
            transcriptionModel,
            transcriptionCost,
            audioDuration
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
        } catch (error) {
          err(`${p} Error processing item ${item.title}: ${(error as Error).message}`)
          results.push({
            frontMatter: '',
            prompt: '',
            llmOutput: '',
            transcript: '',
          })
        }
      }
    } catch (error) {
      err(`${p} Error processing RSS feed ${rssUrl}: ${(error as Error).message}`)
      throw error
    }
  }
  
  if (options.info === 'combined' && allItemsForCombined.length > 0) {
    allItemsForCombined.sort((a, b) => {
      const dateA = new Date(a.publishDate || '1970-01-01')
      const dateB = new Date(b.publishDate || '1970-01-01')
      return dateB.getTime() - dateA.getTime()
    })
    await saveAudio('', true)
    await saveInfo('combined', allItemsForCombined, 'combined-feeds')
  }
}