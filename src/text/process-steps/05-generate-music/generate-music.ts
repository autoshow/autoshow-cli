import { createCompositionPlan, generateMusicWithElevenLabs } from '@/music/music-services/elevenlabs-music'
import { generateMusicWithMinimax } from '@/music/music-services/minimax-music'
import { 
  convertFormatForService, 
  parseMinimaxFormat, 
  truncateLyricsForMinimax,
  normalizeSectionTagsForMinimax,
  getExtensionFromMinimaxFormat,
} from '@/music/music-utils'
import { l, err, success } from '@/logging'
import { env } from '@/node-utils'
import type { ProcessingOptions, ElevenLabsGenre } from '@/text/text-types'
import type { MusicOutputFormat } from '@/music/music-types'

const ELEVENLABS_GENRE_STYLE_MAP: Record<ElevenLabsGenre, string> = {
  rap: 'hip-hop, rap, rhythmic beats, urban flow, confident delivery',
  rock: 'rock, electric guitar, powerful drums, energetic, anthemic',
  folk: 'folk, acoustic guitar, authentic storytelling, organic sound',
  jazz: 'jazz, sophisticated, piano, brass, swing rhythm, smooth',
  pop: 'pop, catchy hooks, radio-friendly, modern production, upbeat',
  country: 'country, acoustic, heartfelt, Americana, storytelling',
}

const MINIMAX_GENRE_STYLE_MAP: Record<ElevenLabsGenre, string> = {
  rap: 'Contemporary R&B/Hip-Hop with Trap influences, confident and assertive energy. Features rhythmic vocal delivery with Auto-Tune character, 808 basslines, intricate hi-hat patterns, sharp claps, and atmospheric synth pads. Modern polished production with layered harmonies and ad-libs.',
  
  rock: 'Modern Rock with powerful electric guitars, driving drums, and anthemic energy. Features saturated distortion, dynamic builds, wide-frequency transients, and arena-ready production. Energetic and powerful with full spectral characteristics.',
  
  folk: 'Indie Folk with acoustic guitar, authentic storytelling, and organic warmth. Features intimate humanized vocals, natural instrumentation, introspective mood, and warm low-pass feel. Melancholic and genuine with transparent mixing.',
  
  jazz: 'Sophisticated Jazz with piano, brass, and swing rhythm. Features smooth expressive vocals, classic warm production, improvisational feel, and rich harmonic complexity. Elegant and timeless with expanded orchestral sound library.',
  
  pop: 'Contemporary Pop with catchy hooks, modern production, and radio-ready polish. Features bright clear vocals, layered harmonies, upbeat energy, and crisp transparent mix. Perfect for mainstream appeal with dynamic evolution.',
  
  country: 'Modern Country with acoustic instrumentation, heartfelt storytelling, and Americana warmth. Features authentic vocal delivery with humanized flow, pedal steel, and organic production. Genuine and emotionally resonant.',
}

export interface MusicGenerationResult {
  success: boolean
  path?: string
  error?: string
}

export async function generateMusic(
  options: ProcessingOptions,
  llmOutput: string,
  finalPath: string
): Promise<MusicGenerationResult> {
  const useElevenlabs = !!options.elevenlabs
  const useMinimax = !!options.minimax
  
  if (!useElevenlabs && !useMinimax) {
    return { success: true } 
  }

  const genre = (options.elevenlabs || options.minimax) as ElevenLabsGenre
  const service = useMinimax ? 'minimax' : 'elevenlabs'
  const apiKeyVar = useMinimax ? 'MINIMAX_API_KEY' : 'ELEVENLABS_API_KEY'

  if (!env[apiKeyVar]) {
    return {
      success: false,
      error: `${apiKeyVar} environment variable is missing`
    }
  }

  try {
    l('Generating music', { genre, service })

    const lyrics = extractLyrics(llmOutput)
    if (!lyrics) {
      return {
        success: false,
        error: 'Could not extract lyrics from LLM output. Ensure the LLM generated a ## Song section.'
      }
    }

    l('Extracted lines of lyrics', { lineCount: lyrics.split('\n').length })

    if (useMinimax) {
      return await generateWithMinimax(genre, lyrics, finalPath, options)
    } else {
      return await generateWithElevenlabs(genre, lyrics, finalPath, options)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    err('Music generation failed', { error: errorMessage })
    return {
      success: false,
      error: `Music generation failed: ${errorMessage}`
    }
  }
}

async function generateWithMinimax(
  genre: ElevenLabsGenre,
  lyrics: string,
  finalPath: string,
  options: ProcessingOptions
): Promise<MusicGenerationResult> {
  let stylePrompt = MINIMAX_GENRE_STYLE_MAP[genre]
  if (options.musicStyle) {
    stylePrompt = `${stylePrompt} ${options.musicStyle}`
  }
  
  let processedLyrics = normalizeSectionTagsForMinimax(lyrics)
  processedLyrics = truncateLyricsForMinimax(processedLyrics)
  
  let format = options.musicFormat || 'mp3_44100_256000'
  format = convertFormatForService(format, 'minimax')
  const audioSetting = parseMinimaxFormat(format)
  const ext = getExtensionFromMinimaxFormat(format)
  
  const outputPath = `${finalPath}-minimax-${genre}.${ext}`
  
  l('Generating music with MiniMax Music 2.5...')
  
  const result = await generateMusicWithMinimax({
    prompt: stylePrompt,
    lyrics: processedLyrics,
    outputPath,
    audioSetting,
  })
  
  if (result.success) {
    success('Music generated', { path: result.path })
    return { success: true, path: result.path }
  } else {
    return { success: false, error: result.error }
  }
}

async function generateWithElevenlabs(
  genre: ElevenLabsGenre,
  lyrics: string,
  finalPath: string,
  options: ProcessingOptions
): Promise<MusicGenerationResult> {
  let musicStyle = ELEVENLABS_GENRE_STYLE_MAP[genre]
  if (options.musicStyle) {
    musicStyle = `${musicStyle}, ${options.musicStyle}`
  }
  
  const planPrompt = `${musicStyle}\n\nLyrics:\n${lyrics}`

  l('Creating composition plan with ElevenLabs...')
  const planResult = await createCompositionPlan(planPrompt)

  if (!planResult.success || !planResult.plan) {
    return {
      success: false,
      error: `Failed to create composition plan: ${planResult.error}`
    }
  }

  l('Composition plan created', { sectionCount: planResult.plan.sections?.length || 0 })

  l('Generating music from composition plan...')
  
  let format = options.musicFormat || 'mp3_44100_128'
  format = convertFormatForService(format, 'elevenlabs')
  
  const outputPath = `${finalPath}-elevenlabs-${genre}.mp3`

  const musicResult = await generateMusicWithElevenLabs('', {
    compositionPlan: planResult.plan,
    outputPath,
    outputFormat: format as MusicOutputFormat,
  })

  if (musicResult.success) {
    success('Music generated', { path: musicResult.path })
    return { success: true, path: musicResult.path }
  } else {
    return { success: false, error: musicResult.error }
  }
}

function extractLyrics(llmOutput: string): string | null {
  const songMatch = llmOutput.match(/## Song\s*\n([\s\S]*?)(?=\n## |$)/)
  if (songMatch && songMatch[1]) {
    const lyrics = songMatch[1].trim()
    if (lyrics.length > 0) {
      return lyrics
    }
  }

  const lyricsMatch = llmOutput.match(/Lyrics:\s*\n([\s\S]*?)(?=\n## |$)/)
  if (lyricsMatch && lyricsMatch[1]) {
    const lyrics = lyricsMatch[1].trim()
    if (lyrics.length > 0) {
      return lyrics
    }
  }

  const verseChorusMatch = llmOutput.match(/(\[Verse[\s\S]*?\[Chorus[\s\S]*?)(?=\n## |$)/i)
  if (verseChorusMatch && verseChorusMatch[1]) {
    return verseChorusMatch[1].trim()
  }

  const sectionMarkers = /\[(Verse|Chorus|Bridge|Hook|Intro|Outro)[^\]]*\]/gi
  if (sectionMarkers.test(llmOutput)) {
    const firstMarkerIndex = llmOutput.search(/\[(Verse|Chorus|Bridge|Hook|Intro|Outro)[^\]]*\]/i)
    if (firstMarkerIndex !== -1) {
      const lyricsSection = llmOutput.substring(firstMarkerIndex)
      const endMatch = lyricsSection.match(/\n## /)
      const lyrics = endMatch
        ? lyricsSection.substring(0, lyricsSection.indexOf('\n## '))
        : lyricsSection
      return lyrics.trim()
    }
  }

  return null
}
