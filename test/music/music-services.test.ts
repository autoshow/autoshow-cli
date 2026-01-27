import test from 'node:test'
import { strictEqual, ok, deepStrictEqual } from 'node:assert/strict'
import { readdirSync, existsSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { exec } from 'node:child_process'
import type { ExecException } from 'node:child_process'
import {
  truncateLyricsForMinimax,
  normalizeSectionTagsForMinimax,
  parseMinimaxFormat,
  isMinimaxFormat,
  isElevenlabsFormat,
  convertFormatForService,
} from '../../src/music/music-utils'

// ElevenLabs CLI commands
const elevenlabsCommands = [
  { 'elevenlabs-basic': 'bun as -- music generate --service elevenlabs --prompt "An upbeat electronic dance track with driving synths"' },
  { 'elevenlabs-instrumental': 'bun as -- music generate --service elevenlabs --prompt "A peaceful acoustic guitar melody" --instrumental' },
  { 'elevenlabs-duration': 'bun as -- music generate --service elevenlabs --prompt "A dramatic orchestral piece" --duration 30s' },
  { 'elevenlabs-plan': 'bun as -- music plan --prompt "A pop song about summer" --duration 1m' },
]

// MiniMax CLI commands (require lyrics)
const minimaxCommands = [
  { 'minimax-basic': 'bun as -- music generate --service minimax --prompt "Contemporary pop with catchy hooks" --lyrics "[Verse]\\nHello world, this is a test\\nJust a simple song at best\\n[Chorus]\\nLa la la, sing along\\nThis is our test song"' },
  { 'minimax-format': 'bun as -- music generate --service minimax --prompt "Upbeat dance track" --lyrics "[Verse]\\nDancing through the night\\nEverything feels right\\n[Chorus]\\nMove your feet, feel the beat" --format mp3_44100_128000' },
]

// ============================================================================
// Unit tests for MiniMax utilities
// ============================================================================

test('truncateLyricsForMinimax - under limit', () => {
  const lyrics = '[Verse]\nShort lyrics here'
  const result = truncateLyricsForMinimax(lyrics)
  strictEqual(result, lyrics)
})

test('truncateLyricsForMinimax - over limit truncates', () => {
  // Create lyrics that exceed 3500 chars
  const verse = '[Verse]\n' + 'A'.repeat(1500) + '\n'
  const chorus = '[Chorus]\n' + 'B'.repeat(1500) + '\n'
  const bridge = '[Bridge]\n' + 'C'.repeat(1000)
  const lyrics = verse + chorus + bridge
  
  ok(lyrics.length > 3500, 'Test lyrics should exceed limit')
  
  const result = truncateLyricsForMinimax(lyrics)
  ok(result.length <= 3500, 'Result should be within limit')
})

test('normalizeSectionTagsForMinimax - maps common variants', () => {
  const lyrics = '[verse 1]\nLine one\n[pre-chorus]\nBuilding up\n[CHORUS]\nHook line'
  const result = normalizeSectionTagsForMinimax(lyrics)
  
  ok(result.includes('[Verse]'), 'Should normalize verse 1 to Verse')
  ok(result.includes('[Pre Chorus]'), 'Should normalize pre-chorus to Pre Chorus')
  ok(result.includes('[Chorus]'), 'Should normalize CHORUS to Chorus')
})

test('normalizeSectionTagsForMinimax - preserves valid tags', () => {
  const lyrics = '[Intro]\nStart here\n[Bridge]\nMiddle part\n[Outro]\nEnd'
  const result = normalizeSectionTagsForMinimax(lyrics)
  
  ok(result.includes('[Intro]'), 'Should preserve Intro')
  ok(result.includes('[Bridge]'), 'Should preserve Bridge')
  ok(result.includes('[Outro]'), 'Should preserve Outro')
})

test('parseMinimaxFormat - parses mp3 format correctly', () => {
  const result = parseMinimaxFormat('mp3_44100_256000')
  deepStrictEqual(result, {
    format: 'mp3',
    sample_rate: 44100,
    bitrate: 256000,
  })
})

test('parseMinimaxFormat - parses wav format correctly', () => {
  const result = parseMinimaxFormat('wav_44100')
  deepStrictEqual(result, {
    format: 'wav',
    sample_rate: 44100,
    bitrate: undefined,
  })
})

test('isMinimaxFormat - validates correctly', () => {
  ok(isMinimaxFormat('mp3_44100_256000'), 'Should accept valid MiniMax mp3 format')
  ok(isMinimaxFormat('wav_44100'), 'Should accept valid MiniMax wav format')
  ok(isMinimaxFormat('pcm_32000'), 'Should accept valid MiniMax pcm format')
  ok(!isMinimaxFormat('mp3_44100_128'), 'Should reject ElevenLabs format')
  ok(!isMinimaxFormat('opus_48000_128'), 'Should reject opus format')
})

test('isElevenlabsFormat - validates correctly', () => {
  ok(isElevenlabsFormat('mp3_44100_128'), 'Should accept valid ElevenLabs format')
  ok(isElevenlabsFormat('opus_48000_128'), 'Should accept opus format')
  ok(!isElevenlabsFormat('mp3_44100_256000'), 'Should reject MiniMax format')
})

test('convertFormatForService - converts for MiniMax', () => {
  const result = convertFormatForService('mp3_44100_128', 'minimax')
  ok(isMinimaxFormat(result), 'Should return valid MiniMax format')
})

test('convertFormatForService - converts for ElevenLabs', () => {
  const result = convertFormatForService('mp3_44100_256000', 'elevenlabs')
  ok(isElevenlabsFormat(result), 'Should return valid ElevenLabs format')
})

test('convertFormatForService - passes through matching formats', () => {
  strictEqual(
    convertFormatForService('mp3_44100_256000', 'minimax'),
    'mp3_44100_256000',
    'Should pass through valid MiniMax format'
  )
  strictEqual(
    convertFormatForService('mp3_44100_128', 'elevenlabs'),
    'mp3_44100_128',
    'Should pass through valid ElevenLabs format'
  )
})

// ============================================================================
// CLI integration tests for ElevenLabs
// ============================================================================

test('CLI ElevenLabs music services tests', { concurrency: 1 }, async (t) => {
  if (!process.env['ELEVENLABS_API_KEY']) {
    t.skip('ELEVENLABS_API_KEY not set')
    return
  }
  const outputDirectory = resolve(process.cwd(), 'output')
  let fileCounter = 1
  
  for (const commandObj of elevenlabsCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [testName, command] = entry
    
    await t.test(`ElevenLabs: ${testName}`, { concurrency: 1 }, async () => {
      const beforeRun = readdirSync(outputDirectory)
      
      let errorOccurred = false
      try {
        await new Promise<string>((resolve, reject) => {
          exec(command, { shell: '/bin/zsh' }, (
            error: ExecException | null, stdout: string, _stderr: string
          ) => {
            if (error) {
              reject(error)
            } else {
              resolve(stdout)
            }
          })
        })
      } catch {
        errorOccurred = true
      }
      
      strictEqual(errorOccurred, false)
      const afterRun = readdirSync(outputDirectory)
      
      let filesToRename: string[] = []
      
      const newFiles = afterRun.filter(f => !beforeRun.includes(f))
      if (newFiles.length > 0) {
        filesToRename = newFiles
      } else {
        const possibleFile = afterRun.find(f => 
          !f.endsWith('.part') && 
          !f.match(/^\d{2}-/) && 
          (f.endsWith('.mp3') || f.endsWith('.opus') || f.endsWith('.pcm'))
        )
        if (possibleFile) {
          filesToRename = [possibleFile]
        }
      }
      
      // For 'plan' command, no file is created
      if (!testName.includes('plan')) {
        ok(filesToRename.length > 0, 'Expected at least one new music file')
      }
      
      for (const file of filesToRename) {
        if (file.endsWith('.part')) continue
        if (/^\d{2}-/.test(file)) continue
        
        const oldPath = join(outputDirectory, file)
        if (!existsSync(oldPath)) continue
        
        const fileExtension = file.substring(file.lastIndexOf('.'))
        const baseName = file.substring(0, file.lastIndexOf('.'))
        
        const newName = `${String(fileCounter).padStart(2, '0')}-${baseName}-${testName}${fileExtension}`
        const newPath = join(outputDirectory, newName)
        
        renameSync(oldPath, newPath)
        fileCounter++
      }
    })
  }
})

// ============================================================================
// CLI integration tests for MiniMax
// ============================================================================

test('CLI MiniMax music services tests', { concurrency: 1 }, async (t) => {
  if (!process.env['MINIMAX_API_KEY']) {
    t.skip('MINIMAX_API_KEY not set')
    return
  }
  const outputDirectory = resolve(process.cwd(), 'output')
  let fileCounter = 1
  
  for (const commandObj of minimaxCommands) {
    const entry = Object.entries(commandObj)[0]
    if (!entry) continue
    const [testName, command] = entry
    
    await t.test(`MiniMax: ${testName}`, { concurrency: 1 }, async () => {
      const beforeRun = readdirSync(outputDirectory)
      
      let errorOccurred = false
      try {
        await new Promise<string>((resolve, reject) => {
          exec(command, { shell: '/bin/zsh' }, (
            error: ExecException | null, stdout: string, _stderr: string
          ) => {
            if (error) {
              reject(error)
            } else {
              resolve(stdout)
            }
          })
        })
      } catch {
        errorOccurred = true
      }
      
      strictEqual(errorOccurred, false)
      const afterRun = readdirSync(outputDirectory)
      
      let filesToRename: string[] = []
      
      const newFiles = afterRun.filter(f => !beforeRun.includes(f))
      if (newFiles.length > 0) {
        filesToRename = newFiles
      } else {
        const possibleFile = afterRun.find(f => 
          !f.endsWith('.part') && 
          !f.match(/^\d{2}-/) && 
          (f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.pcm'))
        )
        if (possibleFile) {
          filesToRename = [possibleFile]
        }
      }
      
      ok(filesToRename.length > 0, 'Expected at least one new music file')
      
      for (const file of filesToRename) {
        if (file.endsWith('.part')) continue
        if (/^\d{2}-/.test(file)) continue
        
        const oldPath = join(outputDirectory, file)
        if (!existsSync(oldPath)) continue
        
        const fileExtension = file.substring(file.lastIndexOf('.'))
        const baseName = file.substring(0, file.lastIndexOf('.'))
        
        const newName = `${String(fileCounter).padStart(2, '0')}-${baseName}-${testName}${fileExtension}`
        const newPath = join(outputDirectory, newName)
        
        renameSync(oldPath, newPath)
        fileCounter++
      }
    })
  }
})
