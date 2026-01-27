import { generateMarkdown } from '../../process-steps/01-process-content/generate-markdown'
import { downloadAudio, saveAudio } from '../../process-steps/01-process-content/download-audio'
import { runTranscription } from '../../process-steps/02-run-transcription/run-transcription'
import { selectPrompts } from '../../process-steps/03-select-prompts/select-prompt'
import { runLLM } from '../../process-steps/04-run-llm/run-llm'
import { generateMusic } from '../../process-steps/05-generate-music/generate-music'
import { saveInfo } from '../../utils/save-info'
import { l, err } from '@/logging'
import { selectRSSItemsToProcess } from './fetch'
import { logRSSProcessingStatus } from './rss-logging'
import type { ProcessingOptions, ShowNoteMetadata } from '@/text/text-types'

export async function processRSSFeeds(
  options: ProcessingOptions,
  expandedRssUrls: string[],
  llmServices?: string,
  transcriptServices?: string
): Promise<void> {
  let allItemsForCombined: ShowNoteMetadata[] = []
  const skippedFeeds: string[] = []
  
  for (const rssUrl of expandedRssUrls) {
    if (options.item && options.item.length > 0) {
      l.dim('Processing specific items:')
      options.item.forEach((url) => l.dim(`${url}`))
    } else if (options.last) {
      l.dim(`Processing the last ${options.last} items`)
    } else if (options.days) {
      l.dim(`Processing items from the last ${options.days} days`)
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
        skippedFeeds.push(channelTitle || rssUrl)
        continue
      }
      
      logRSSProcessingStatus(items.length, items.length, options)
      
      const results = []
      for (const [index, item] of items.entries()) {
        l.final(`Item ${index + 1}/${items.length} processing: ${item.title}`)
        
        try {
          const { frontMatter, finalPath, filename, metadata } = await generateMarkdown(options, item)
          if (item.showLink) {
            await downloadAudio(options, item.showLink, filename)
          } else {
            throw new Error(`showLink is undefined for item: ${item.title}`)
          }
          const { transcript } = await runTranscription(options, finalPath, transcriptServices)
          const selectedPrompts = await selectPrompts(options)
          const llmOutput = await runLLM(
            options,
            finalPath,
            frontMatter,
            selectedPrompts,
            transcript,
            metadata as ShowNoteMetadata,
            llmServices
          )
          
          // Generate music with ElevenLabs if requested
          if (options.elevenlabs && llmOutput) {
            const musicResult = await generateMusic(options, llmOutput, finalPath)
            if (!musicResult.success) {
              l.warn(`Music generation failed: ${musicResult.error}`)
            }
          }
          
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
          err(`Error processing item ${item.title}: ${(error as Error).message}`)
          results.push({
            frontMatter: '',
            prompt: '',
            llmOutput: '',
            transcript: '',
          })
        }
      }
    } catch (error) {
      err(`Error processing RSS feed ${rssUrl}: ${(error as Error).message}`)
      throw error
    }
  }
  
  if (skippedFeeds.length > 0) {
    l.warn(`No items found for: ${skippedFeeds.join(', ')}`)
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