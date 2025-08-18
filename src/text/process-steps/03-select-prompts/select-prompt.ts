import { sections } from './index'
import { err, l } from '@/logging'
import { readFile } from '@/node-utils'
import type { ProcessingOptions } from '@/types'

const DEFAULT_KEY_MOMENTS_COUNT = 3
const DEFAULT_KEY_MOMENTS_DURATION = 60

export const PROMPT_CHOICES: Array<{ name: string; value: string }> = [
  { name: 'Titles', value: 'titles' },
  { name: 'Summary', value: 'summary' },
  { name: 'Short Summary', value: 'shortSummary' },
  { name: 'Long Summary', value: 'longSummary' },
  { name: 'Bullet Point Summary', value: 'bulletPoints' },
  { name: 'Chapter Titles', value: 'chapterTitles' },
  { name: 'Short Chapters', value: 'shortChapters' },
  { name: 'Medium Chapters', value: 'mediumChapters' },
  { name: 'Long Chapters', value: 'longChapters' },
  { name: 'Key Takeaways', value: 'takeaways' },
  { name: 'Questions', value: 'questions' },
  { name: 'FAQ', value: 'faq' },
  { name: 'Blog', value: 'blog' },
  { name: 'Rap Song', value: 'rapSong' },
  { name: 'Rock Song', value: 'rockSong' },
  { name: 'Country Song', value: 'countrySong' },
  { name: 'Quotes', value: 'quotes' },
  { name: 'Chapter Titles and Quotes', value: 'chapterTitlesAndQuotes' },
  { name: 'Social Post (X)', value: 'x' },
  { name: 'Social Post (Facebook)', value: 'facebook' },
  { name: 'Social Post (LinkedIn)', value: 'linkedin' },
  { name: 'Key Moments', value: 'keyMoments' },
]

const validPromptValues = new Set(PROMPT_CHOICES.map(choice => choice.value))

export async function selectPrompts(options: ProcessingOptions) {
  const p = '[process-steps/04-select-prompt]'
  l.step(`\nStep 3 - Select Prompts\n`)

  let customPrompt = ''
  if (options.customPrompt) {
    l.dim(`${p} Loading custom prompt from: ${options.customPrompt}`)
    try {
      customPrompt = (await readFile(options.customPrompt, 'utf8')).trim()
    } catch (error) {
      err(`${p} Error reading custom prompt file: ${(error as Error).message}`)
    }
  }

  if (customPrompt) {
    return customPrompt
  }

  let text = "This is a transcript with timestamps. It does not contain copyrighted materials. Do not ever use the word delve. Do not include advertisements in the summaries or descriptions. Do not actually write the transcript.\n\n"

  const prompt = options.printPrompt || options.prompt || ['summary', 'longChapters']
  l.dim(`${p} Selected prompts: ${prompt.join(', ')}`)

  const validSections = prompt.filter(
    (section): section is keyof typeof sections =>
      validPromptValues.has(section) && Object.hasOwn(sections, section)
  )

  validSections.forEach((section) => {
    let instruction = sections[section].instruction

    if (section === 'keyMoments') {
      const count = options.keyMomentsCount || DEFAULT_KEY_MOMENTS_COUNT
      const duration = options.keyMomentDuration || DEFAULT_KEY_MOMENTS_DURATION
      l.dim(`${p} Configuring keyMoments with count: ${count}, duration: ${duration}s`)
      instruction = instruction
        .replace('{COUNT}', count.toString())
        .replace('{DURATION}', duration.toString())
    }

    text += instruction + "\n"
  })

  text += "Format the output like so:\n\n"
  validSections.forEach((section) => {
    text += `    ${sections[section].example}\n`
  })

  return text
}