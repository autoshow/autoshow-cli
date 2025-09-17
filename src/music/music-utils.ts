import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { l } from '@/logging'
import { spawnSync } from '@/node-utils'

const p = '[music/music-utils]'

export function generateUniqueFilename(prefix: string, extension: string = 'wav'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const randomString = Math.random().toString(36).substring(2, 8)
  const makeFilename = (extra = '') => join('./output', `${prefix}-${timestamp}-${randomString}${extra}.${extension}`)
  const filepath = makeFilename()
  const finalPath = existsSync(filepath) ? makeFilename(`-${Math.random().toString(36).substring(2, 8)}`) : filepath
  l.dim(`${p} Generated unique filename: ${finalPath}`)
  return finalPath
}

export function validateMusicOptions(options: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (options.duration) {
    const duration = parseFloat(options.duration)
    if (isNaN(duration) || duration <= 0 || duration > 30) {
      errors.push('Duration must be between 0 and 30 seconds')
    }
  }
  
  if (options.temperature) {
    const temp = parseFloat(options.temperature)
    if (isNaN(temp) || temp <= 0 || temp > 2) {
      errors.push('Temperature must be between 0 and 2')
    }
  }
  
  if (options.topK) {
    const topK = parseInt(options.topK, 10)
    if (isNaN(topK) || topK < 0) {
      errors.push('Top-K must be a positive integer')
    }
  }
  
  if (options.topP) {
    const topP = parseFloat(options.topP)
    if (isNaN(topP) || topP < 0 || topP > 1) {
      errors.push('Top-P must be between 0 and 1')
    }
  }
  
  if (options.melody && !existsSync(options.melody)) {
    errors.push(`Melody file not found: ${options.melody}`)
  }
  
  if (options.continuation && !existsSync(options.continuation)) {
    errors.push(`Continuation file not found: ${options.continuation}`)
  }
  
  return { valid: errors.length === 0, errors }
}

export function getModelDescription(model: string): string {
  const descriptions: Record<string, string> = {
    'facebook/musicgen-small': 'Small model (300M parameters) - Fast, lower quality',
    'facebook/musicgen-medium': 'Medium model (1.5B parameters) - Balanced speed and quality',
    'facebook/musicgen-large': 'Large model (3.3B parameters) - Best quality, slower',
    'facebook/musicgen-melody': 'Medium model with melody conditioning support',
    'facebook/musicgen-melody-large': 'Large model with melody conditioning support',
    'facebook/musicgen-stereo-small': 'Small stereo model',
    'facebook/musicgen-stereo-medium': 'Medium stereo model',
    'facebook/musicgen-stereo-large': 'Large stereo model',
    'facebook/musicgen-stereo-melody': 'Medium stereo model with melody conditioning',
    'facebook/musicgen-stereo-melody-large': 'Large stereo model with melody conditioning'
  }
  
  return descriptions[model] || 'Unknown model'
}

export function checkMusicEnvironment(): boolean {
  const pythonPath = join(process.cwd(), 'build/pyenv/tts/bin/python')
  const configPath = join(process.cwd(), 'build/config', '.music-config.json')
  
  l.dim(`${p} Checking music environment at ${pythonPath}`)
  
  if (!existsSync(pythonPath)) {
    l.dim(`${p} Python environment not found`)
    return false
  }
  
  if (!existsSync(configPath)) {
    l.dim(`${p} Music config not found`)
    return false
  }
  
  const checkAudiocraft = spawnSync(pythonPath, ['-c', 'import audiocraft'], { encoding: 'utf-8', stdio: 'pipe' })
  const checkStableAudio = spawnSync(pythonPath, ['-c', 'import stable_audio_tools'], { encoding: 'utf-8', stdio: 'pipe' })
  
  const hasAudiocraft = checkAudiocraft.status === 0
  const hasStableAudio = checkStableAudio.status === 0
  
  l.dim(`${p} AudioCraft: ${hasAudiocraft ? 'installed' : 'missing'}, Stable Audio: ${hasStableAudio ? 'installed' : 'missing'}`)
  
  return hasAudiocraft || hasStableAudio
}

export function runMusicSetup(): boolean {
  l.wait(`${p} Music environment not found, running automatic setup...`)
  
  const ttsEnvScript = '.github/setup/tts/tts-env.sh'
  const audiocraftScript = '.github/setup/music/audiocraft.sh'
  const stableAudioScript = '.github/setup/music/stable-audio.sh'
  
  const setupScripts = [ttsEnvScript, audiocraftScript, stableAudioScript]
  
  const allScriptsExist = setupScripts.every(script => existsSync(join(process.cwd(), script)))
  
  if (!allScriptsExist) {
    l.warn(`${p} Setup scripts not found, please run 'npm run setup:music' manually`)
    return false
  }
  
  try {
    l.dim(`${p} Setting up shared TTS environment`)
    const ttsSetupResult = spawnSync('bash', [ttsEnvScript], { 
      encoding: 'utf-8', 
      stdio: 'inherit',
      cwd: process.cwd()
    })
    
    if (ttsSetupResult.status !== 0) {
      l.warn(`${p} TTS environment setup failed`)
      return false
    }
    
    l.dim(`${p} Setting up AudioCraft`)
    const audiocraftResult = spawnSync('bash', [audiocraftScript], {
      encoding: 'utf-8',
      stdio: 'inherit', 
      cwd: process.cwd()
    })
    
    if (audiocraftResult.status !== 0) {
      l.warn(`${p} AudioCraft setup failed but continuing`)
    }
    
    l.dim(`${p} Setting up Stable Audio`)
    const stableAudioResult = spawnSync('bash', [stableAudioScript], {
      encoding: 'utf-8',
      stdio: 'inherit',
      cwd: process.cwd()
    })
    
    if (stableAudioResult.status !== 0) {
      l.warn(`${p} Stable Audio setup failed but continuing`)
    }
    
    const isSetup = checkMusicEnvironment()
    
    if (isSetup) {
      l.success(`${p} Music environment setup completed successfully`)
      return true
    } else {
      l.warn(`${p} Music environment setup completed with issues, some features may not work`)
      return false
    }
  } catch (error) {
    l.warn(`${p} Error during music setup: ${error}`)
    return false
  }
}

export function ensureMusicEnvironment(): void {
  if (!checkMusicEnvironment()) {
    l.dim(`${p} Music environment not detected, attempting automatic setup`)
    const setupSuccess = runMusicSetup()
    
    if (!setupSuccess) {
      l.warn(`${p} Automatic setup failed or incomplete`)
      l.warn(`${p} Please run 'npm run setup:music' manually to install music generation dependencies`)
      l.warn(`${p} Continuing anyway, but music generation may fail`)
    }
  } else {
    l.dim(`${p} Music environment detected and ready`)
  }
}