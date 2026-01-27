import { createCompositionPlan, generateMusicWithElevenLabs } from '@/music/music-services/elevenlabs-music'
import { l, err } from '@/logging'
import { env } from '@/node-utils'
import type { ProcessingOptions, ElevenLabsGenre } from '@/text/text-types'
import type { MusicOutputFormat } from '@/music/music-types'

// Genre to music style mapping for composition plan prompt
const GENRE_STYLE_MAP: Record<ElevenLabsGenre, string> = {
  rap: 'hip-hop, rap, rhythmic beats, urban flow, confident delivery',
  rock: 'rock, electric guitar, powerful drums, energetic, anthemic',
  folk: 'folk, acoustic guitar, authentic storytelling, organic sound',
  jazz: 'jazz, sophisticated, piano, brass, swing rhythm, smooth',
  pop: 'pop, catchy hooks, radio-friendly, modern production, upbeat',
  country: 'country, acoustic, heartfelt, Americana, storytelling',
}

export interface MusicGenerationResult {
  success: boolean
  path?: string
  error?: string
}

/**
 * Generate music with ElevenLabs based on LLM-generated lyrics
 * 
 * @param options - Processing options containing elevenlabs genre and musicFormat
 * @param llmOutput - The LLM output containing generated lyrics
 * @param finalPath - The base path for output files (without extension)
 * @returns Result object with success status and path or error
 */
export async function generateMusic(
  options: ProcessingOptions,
  llmOutput: string,
  finalPath: string
): Promise<MusicGenerationResult> {
  if (!options.elevenlabs) {
    return { success: true } // No music generation requested
  }

  const genre = options.elevenlabs

  // Check for API key
  if (!env['ELEVENLABS_API_KEY']) {
    return {
      success: false,
      error: 'ELEVENLABS_API_KEY environment variable is missing'
    }
  }

  try {
    l.opts(`Generating ${genre} music with ElevenLabs`)

    // Extract lyrics from LLM output
    const lyrics = extractLyrics(llmOutput)
    if (!lyrics) {
      return {
        success: false,
        error: 'Could not extract lyrics from LLM output. Ensure the LLM generated a ## Song section.'
      }
    }

    l.dim(`Extracted ${lyrics.split('\n').length} lines of lyrics`)

    // Build music style prompt for composition plan
    const musicStyle = GENRE_STYLE_MAP[genre]
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
    const outputPath = `${finalPath}-elevenlabs-${genre}.mp3`
    const outputFormat = (options.musicFormat || 'mp3_44100_128') as MusicOutputFormat

    const musicResult = await generateMusicWithElevenLabs('', {
      compositionPlan: planResult.plan,
      outputPath,
      outputFormat,
    })

    if (musicResult.success) {
      l.success(`Music generated: ${musicResult.path}`)
      return { success: true, path: musicResult.path }
    } else {
      return { success: false, error: musicResult.error }
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
