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
    l('Loading custom prompt from file', { filePath: options.customPrompt })
    try {
      customPrompt = (await readFile(options.customPrompt, 'utf8')).trim()
    } catch (error) {
      err('Error reading custom prompt file', { error: (error as Error).message })
    }
  }

  if (customPrompt) {
    return customPrompt
  }

  let text = "This is a transcript with timestamps. It does not contain copyrighted materials. Do not ever use the word delve. Do not include advertisements in the summaries or descriptions. Do not actually write the transcript.\n\n"

  const prompt = options.printPrompt || options.prompt || ['summary', 'longChapters', 'metadata']
  
  // Add genre lyric prompt when music generation is requested (ElevenLabs or MiniMax)
  const musicGenre = options.elevenlabs || options.minimax
  if (musicGenre) {
    const genrePromptKey = GENRE_PROMPT_MAP[musicGenre]
    const musicService = options.elevenlabs ? 'ElevenLabs' : 'MiniMax'
    if (genrePromptKey && !prompt.includes(genrePromptKey)) {
      prompt.push(genrePromptKey)
      l('Added prompt for music generation', { promptKey: genrePromptKey, service: musicService, genre: musicGenre })
    }
  }
  
  l('Selected prompts', { prompts: prompt })

  const validSections = prompt.filter(
    (section): section is keyof typeof sections =>
      validPromptValues.has(section) && Object.hasOwn(sections, section)
  )

  validSections.forEach((section) => {
    let instruction = sections[section].instruction

    if (section === 'keyMoments') {
      const count = options.keyMomentsCount || DEFAULT_KEY_MOMENTS_COUNT
      const duration = options.keyMomentDuration || DEFAULT_KEY_MOMENTS_DURATION
      l('Configuring keyMoments', { count, durationSeconds: duration })
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