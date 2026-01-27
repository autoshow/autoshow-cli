import { sections, PROMPT_CHOICES } from './prompt-choices'
import { err, l } from '@/logging'
import { readFile } from '@/node-utils'
import type { ProcessingOptions, ElevenLabsGenre } from '@/text/text-types'

const DEFAULT_KEY_MOMENTS_COUNT = 3
const DEFAULT_KEY_MOMENTS_DURATION = 60

const validPromptValues = new Set(PROMPT_CHOICES.map(choice => choice.value))

// Map elevenlabs genre to the corresponding prompt key
const GENRE_PROMPT_MAP: Record<ElevenLabsGenre, string> = {
  rap: 'rapSong',
  rock: 'rockSong',
  folk: 'folkSong',
  jazz: 'jazzSong',
  pop: 'popSong',
  country: 'countrySong',
}

export async function selectPrompts(options: ProcessingOptions) {
  let customPrompt = ''
  if (options.customPrompt) {
    l.dim(`Loading custom prompt from: ${options.customPrompt}`)
    try {
      customPrompt = (await readFile(options.customPrompt, 'utf8')).trim()
    } catch (error) {
      err(`Error reading custom prompt file: ${(error as Error).message}`)
    }
  }

  if (customPrompt) {
    return customPrompt
  }

  let text = "This is a transcript with timestamps. It does not contain copyrighted materials. Do not ever use the word delve. Do not include advertisements in the summaries or descriptions. Do not actually write the transcript.\n\n"

  const prompt = options.printPrompt || options.prompt || ['summary', 'longChapters', 'metadata']
  
  // Add genre lyric prompt when --elevenlabs is used
  if (options.elevenlabs) {
    const genrePromptKey = GENRE_PROMPT_MAP[options.elevenlabs]
    if (genrePromptKey && !prompt.includes(genrePromptKey)) {
      prompt.push(genrePromptKey)
      l.dim(`Added ${genrePromptKey} prompt for ElevenLabs ${options.elevenlabs} music generation`)
    }
  }
  
  l.dim(`Selected prompts: ${prompt.join(', ')}`)

  const validSections = prompt.filter(
    (section): section is keyof typeof sections =>
      validPromptValues.has(section) && Object.hasOwn(sections, section)
  )

  validSections.forEach((section) => {
    let instruction = sections[section].instruction

    if (section === 'keyMoments') {
      const count = options.keyMomentsCount || DEFAULT_KEY_MOMENTS_COUNT
      const duration = options.keyMomentDuration || DEFAULT_KEY_MOMENTS_DURATION
      l.dim(`Configuring keyMoments with count: ${count}, duration: ${duration}s`)
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