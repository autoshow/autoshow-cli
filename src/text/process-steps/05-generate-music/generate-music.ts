import { createCompositionPlan, generateMusicWithElevenLabs } from '@/music/music-services/elevenlabs-music'
import { generateMusicWithMinimax } from '@/music/music-services/minimax-music'
import { 
  convertFormatForService, 
  parseMinimaxFormat, 
  truncateLyricsForMinimax,
  normalizeSectionTagsForMinimax,
  getExtensionFromMinimaxFormat,
} from '@/music/music-utils'
import { l, err } from '@/logging'
import { env } from '@/node-utils'
import type { ProcessingOptions, ElevenLabsGenre } from '@/text/text-types'
import type { MusicOutputFormat } from '@/music/music-types'

// ElevenLabs genre to music style mapping for composition plan prompt
const ELEVENLABS_GENRE_STYLE_MAP: Record<ElevenLabsGenre, string> = {
  rap: 'hip-hop, rap, rhythmic beats, urban flow, confident delivery',
  rock: 'rock, electric guitar, powerful drums, energetic, anthemic',
  folk: 'folk, acoustic guitar, authentic storytelling, organic sound',
  jazz: 'jazz, sophisticated, piano, brass, swing rhythm, smooth',
  pop: 'pop, catchy hooks, radio-friendly, modern production, upbeat',
  country: 'country, acoustic, heartfelt, Americana, storytelling',
}

// MiniMax Music 2.5 optimized prompts (leverage its strengths in vocal/instrumentation)
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

/**
 * Generate music based on LLM-generated lyrics
 * 
 * @param options - Processing options containing music service (elevenlabs/minimax), genre, and format
 * @param llmOutput - The LLM output containing generated lyrics
 * @param finalPath - The base path for output files (without extension)
 * @returns Result object with success status and path or error
 */
export async function generateMusic(
  options: ProcessingOptions,
  llmOutput: string,
  finalPath: string
): Promise<MusicGenerationResult> {
  const useElevenlabs = !!options.elevenlabs
  const useMinimax = !!options.minimax
  
  if (!useElevenlabs && !useMinimax) {
    return { success: true } // No music generation requested
  }

  const genre = (options.elevenlabs || options.minimax) as ElevenLabsGenre
  const service = useMinimax ? 'minimax' : 'elevenlabs'
  const apiKeyVar = useMinimax ? 'MINIMAX_API_KEY' : 'ELEVENLABS_API_KEY'

  // Check for API key
  if (!env[apiKeyVar]) {
    return {
      success: false,
      error: `${apiKeyVar} environment variable is missing`
    }
  }

  try {
    l.opts(`Generating ${genre} music with ${service}`)

    // Extract lyrics from LLM output
    const lyrics = extractLyrics(llmOutput)
    if (!lyrics) {
      return {
        success: false,
        error: 'Could not extract lyrics from LLM output. Ensure the LLM generated a ## Song section.'
      }
    }

    l.dim(`Extracted ${lyrics.split('\n').length} lines of lyrics`)

    if (useMinimax) {
      return await generateWithMinimax(genre, lyrics, finalPath, options)
    } else {
      return await generateWithElevenlabs(genre, lyrics, finalPath, options)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    err(`Music generation failed: ${errorMessage}`)
    return {
      success: false,
      error: `Music generation failed: ${errorMessage}`
    }
  }
}

/**
 * Generate music using MiniMax Music 2.5
 */
async function generateWithMinimax(
  genre: ElevenLabsGenre,
  lyrics: string,
  finalPath: string,
  options: ProcessingOptions
): Promise<MusicGenerationResult> {
  // Build style prompt (genre base + optional custom hints)
  let stylePrompt = MINIMAX_GENRE_STYLE_MAP[genre]
  if (options.musicStyle) {
    stylePrompt = `${stylePrompt} ${options.musicStyle}`
  }
  
  // Normalize section tags and truncate lyrics for MiniMax limits
  let processedLyrics = normalizeSectionTagsForMinimax(lyrics)
  processedLyrics = truncateLyricsForMinimax(processedLyrics)
  
  // Handle format conversion
  let format = options.musicFormat || 'mp3_44100_256000'
  format = convertFormatForService(format, 'minimax')
  const audioSetting = parseMinimaxFormat(format)
  const ext = getExtensionFromMinimaxFormat(format)
  
  const outputPath = `${finalPath}-minimax-${genre}.${ext}`
  
  l.dim('Generating music with MiniMax Music 2.5...')
  
  const result = await generateMusicWithMinimax({
    prompt: stylePrompt,
    lyrics: processedLyrics,
    outputPath,
    audioSetting,
  })
  
  if (result.success) {
    l.success(`Music generated: ${result.path}`)
    return { success: true, path: result.path }
  } else {
    return { success: false, error: result.error }
  }
}

/**
 * Generate music using ElevenLabs
 */
async function generateWithElevenlabs(
  genre: ElevenLabsGenre,
  lyrics: string,
  finalPath: string,
  options: ProcessingOptions
): Promise<MusicGenerationResult> {
  // Build style prompt (genre base + optional custom hints)
  let musicStyle = ELEVENLABS_GENRE_STYLE_MAP[genre]
  if (options.musicStyle) {
    musicStyle = `${musicStyle}, ${options.musicStyle}`
  }
  
  const planPrompt = `${musicStyle}\n\nLyrics:\n${lyrics}`

  // Create composition plan
  l.dim('Creating composition plan with ElevenLabs...')
  const planResult = await createCompositionPlan(planPrompt)

  if (!planResult.success || !planResult.plan) {
    return {
      success: false,
      error: `Failed to create composition plan: ${planResult.error}`
    }
  }

  l.dim(`Composition plan created with ${planResult.plan.sections?.length || 0} sections`)

  // Generate music with the composition plan
  l.dim('Generating music from composition plan...')
  
  // Handle format conversion
  let format = options.musicFormat || 'mp3_44100_128'
  format = convertFormatForService(format, 'elevenlabs')
  
  const outputPath = `${finalPath}-elevenlabs-${genre}.mp3`

  const musicResult = await generateMusicWithElevenLabs('', {
    compositionPlan: planResult.plan,
    outputPath,
    outputFormat: format as MusicOutputFormat,
  })

  if (musicResult.success) {
    l.success(`Music generated: ${musicResult.path}`)
    return { success: true, path: musicResult.path }
  } else {
    return { success: false, error: musicResult.error }
  }
}

/**
 * Extract lyrics from LLM output
 * 
 * Looks for lyrics in several formats:
 * 1. ## Song section (from the song prompt templates)
 * 2. Lyrics: section
 * 3. Verse/Chorus structure patterns
 * 
 * @param llmOutput - The full LLM output text
 * @returns Extracted lyrics or null if not found
 */
function extractLyrics(llmOutput: string): string | null {
  // Look for ## Song section in the LLM output (matches song prompt template format)
  const songMatch = llmOutput.match(/## Song\s*\n([\s\S]*?)(?=\n## |$)/)
  if (songMatch && songMatch[1]) {
    const lyrics = songMatch[1].trim()
    if (lyrics.length > 0) {
      return lyrics
    }
  }

  // Fallback: look for "Lyrics:" section
  const lyricsMatch = llmOutput.match(/Lyrics:\s*\n([\s\S]*?)(?=\n## |$)/)
  if (lyricsMatch && lyricsMatch[1]) {
    const lyrics = lyricsMatch[1].trim()
    if (lyrics.length > 0) {
      return lyrics
    }
  }

  // Fallback: look for verse/chorus structure anywhere in the output
  // This handles cases where the LLM doesn't follow exact format
  const verseChorusMatch = llmOutput.match(/(\[Verse[\s\S]*?\[Chorus[\s\S]*?)(?=\n## |$)/i)
  if (verseChorusMatch && verseChorusMatch[1]) {
    return verseChorusMatch[1].trim()
  }

  // Last resort: look for content between common song section markers
  const sectionMarkers = /\[(Verse|Chorus|Bridge|Hook|Intro|Outro)[^\]]*\]/gi
  if (sectionMarkers.test(llmOutput)) {
    // Find the first occurrence of a section marker and extract from there
    const firstMarkerIndex = llmOutput.search(/\[(Verse|Chorus|Bridge|Hook|Intro|Outro)[^\]]*\]/i)
    if (firstMarkerIndex !== -1) {
      // Extract until we hit a ## heading or end of content
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
