import { err, l } from '@/logging'
import { env, existsSync, join, fileURLToPath, spawnSync, readFileSync } from '@/node-utils'
import { TRANSCRIPTION_SERVICES_CONFIG } from '../transcription-models'
import type { ProcessingOptions } from '@/text/text-types'
import { resolve } from 'path'

type ReverbResult = {
  transcript: string
  modelId: string
  costPerMinuteCents: number
}

type StrategyConfig = {
  activeStrategy: string
  type: 'venv' | 'docker'
  pythonPath: string | null
  modelPaths: {
    asr: string
    diarization: string
  }
  dockerImage: string | null
}

/**
 * Detect which Reverb setup strategy is active
 */
const detectActiveStrategy = (): StrategyConfig => {
  const strategyJsonPath = join(process.cwd(), 'build/config/.reverb-strategy.json')
  const strategyTxtPath = join(process.cwd(), 'build/config/.reverb-strategy.txt')
  const dockerImagePath = join(process.cwd(), 'build/config/.reverb-docker-image')
  const defaultVenvPath = join(process.cwd(), 'build/pyenv/reverb/bin/python')

  // Try JSON config first (most detailed)
  if (existsSync(strategyJsonPath)) {
    try {
      const config = JSON.parse(readFileSync(strategyJsonPath, 'utf-8')) as StrategyConfig
      l('Reverb strategy detected', { strategy: config.activeStrategy, type: config.type })
      return config
    } catch (e) {
      l('Failed to parse reverb strategy JSON, falling back', { error: (e as Error).message })
    }
  }

  // Try plain text marker
  if (existsSync(strategyTxtPath)) {
    const strategy = readFileSync(strategyTxtPath, 'utf-8').trim()
    const isDocker = strategy.includes('docker')
    
    let dockerImage: string | null = null
    if (isDocker && existsSync(dockerImagePath)) {
      const content = readFileSync(dockerImagePath, 'utf-8').trim()
      dockerImage = content.replace('docker:', '')
    }

    return {
      activeStrategy: strategy,
      type: isDocker ? 'docker' : 'venv',
      pythonPath: isDocker ? null : defaultVenvPath,
      modelPaths: {
        asr: 'build/models/reverb-asr',
        diarization: 'build/models/reverb-diarization-v2'
      },
      dockerImage
    }
  }

  // Fallback: check if venv exists
  if (existsSync(defaultVenvPath)) {
    return {
      activeStrategy: 'strategy-1-pip-venv',
      type: 'venv',
      pythonPath: defaultVenvPath,
      modelPaths: {
        asr: 'build/models/reverb-asr',
        diarization: 'build/models/reverb-diarization-v2'
      },
      dockerImage: null
    }
  }

  // Fallback: check for Docker image
  if (existsSync(dockerImagePath)) {
    const content = readFileSync(dockerImagePath, 'utf-8').trim()
    const dockerImage = content.replace('docker:', '')
    return {
      activeStrategy: 'docker',
      type: 'docker',
      pythonPath: null,
      modelPaths: {
        asr: '/app/models/reverb-asr',
        diarization: '/app/models/reverb-diarization-v2'
      },
      dockerImage
    }
  }

  throw new Error('Reverb not configured. Run: bun setup:reverb')
}

/**
 * Auto-setup Reverb if not found
 */
const ensureReverbSetup = (): StrategyConfig => {
  try {
    return detectActiveStrategy()
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (!message.includes('not configured')) {
      throw error
    }
    l('Reverb setup', { action: 'Running bun setup:reverb' })
    const result = spawnSync('bun', ['setup:reverb'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
    if (result.error || result.status !== 0) {
      const errorMessage = result.error?.message || result.stderr || 'Unknown error'
      throw new Error(`Reverb setup failed: ${errorMessage}`)
    }
    return detectActiveStrategy()
  }
}

const resolveDiarizationModel = (input?: string): string => {
  if (!input) return 'reverb-diarization-v2'
  const normalized = input.toLowerCase().trim()
  if (normalized === 'v1' || normalized === 'reverb-diarization-v1') return 'reverb-diarization-v1'
  if (normalized === 'v2' || normalized === 'reverb-diarization-v2') return 'reverb-diarization-v2'
  return input
}

/**
 * Execute Reverb pipeline via Docker
 */
const callReverbDocker = (
  dockerImage: string,
  audioPath: string,
  asrModel: string,
  diarizationModel: string,
  hfToken: string
): { transcript: string; wordCount: number } => {
  const audioDir = resolve(join(audioPath, '..'))
  const audioFileName = audioPath.split('/').pop()

  const payload = JSON.stringify({
    audioPath: `/data/audio/${audioFileName}`,
    asrModel,
    diarizationModel,
    hfToken
  })

  l('Running Reverb via Docker', { image: dockerImage, audio: audioFileName })

  const result = spawnSync('docker', [
    'run', '--rm',
    '-v', `${audioDir}:/data/audio:ro`,
    '-e', `HF_TOKEN=${hfToken}`,
    dockerImage,
    'python', '/app/reverb_pipeline.py', payload
  ], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe']
  })

  if (result.error || result.status !== 0) {
    const errorMessage = result.error?.message || result.stderr || 'Unknown error'
    throw new Error(`Docker Reverb execution failed: ${errorMessage}`)
  }

  const stdout = (result.stdout || '').trim()
  if (!stdout) {
    throw new Error('Docker Reverb produced no output')
  }

  return JSON.parse(stdout)
}

/**
 * Execute Reverb pipeline via venv Python
 */
const callReverbVenv = (
  pythonPath: string,
  audioPath: string,
  asrModel: string,
  diarizationModel: string,
  hfToken: string
): { transcript: string; wordCount: number } => {
  const scriptUrl = new URL('./reverb/reverb_pipeline.py', import.meta.url)
  const scriptPath = fileURLToPath(scriptUrl)

  const payload = JSON.stringify({
    audioPath,
    asrModel,
    diarizationModel,
    hfToken
  })

  l('Running Reverb via venv', { python: pythonPath })

  const result = spawnSync(pythonPath, [scriptPath, payload], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe']
  })

  if (result.error || result.status !== 0) {
    const errorMessage = result.error?.message || result.stderr || 'Unknown error'
    throw new Error(`Reverb transcription failed: ${errorMessage}`)
  }

  const stdout = (result.stdout || '').trim()
  if (!stdout) {
    throw new Error('Reverb transcription produced no output')
  }

  return JSON.parse(stdout)
}

export async function callReverb(
  options: ProcessingOptions,
  finalPath: string
): Promise<ReverbResult> {
  const hfToken = env['HF_TOKEN']
  if (!hfToken) {
    throw new Error('HF_TOKEN environment variable is required for Reverb diarization models.')
  }

  try {
    const strategyConfig = ensureReverbSetup()
    
    const modelInfo = TRANSCRIPTION_SERVICES_CONFIG.reverb.models[0]
    const defaultAsrModel = modelInfo?.modelId || 'reverb_asr_v1'
    const asrModel = typeof options.reverb === 'string' ? options.reverb : defaultAsrModel
    const diarizationModel = resolveDiarizationModel(options.reverbDiarization)
    
    if (!diarizationModel) {
      throw new Error('Reverb diarization model is required (v1 or v2).')
    }

    const audioPath = `${finalPath}.wav`
    let result: { transcript: string; wordCount: number }

    if (strategyConfig.type === 'docker' && strategyConfig.dockerImage) {
      // Use Docker execution
      result = callReverbDocker(
        strategyConfig.dockerImage,
        audioPath,
        asrModel,
        diarizationModel,
        hfToken
      )
    } else if (strategyConfig.pythonPath) {
      // Use venv execution
      result = callReverbVenv(
        strategyConfig.pythonPath,
        audioPath,
        asrModel,
        diarizationModel,
        hfToken
      )
    } else {
      throw new Error('No valid Reverb execution method available')
    }

    if (!result?.transcript) {
      throw new Error('Reverb transcription output was missing transcript data')
    }

    return {
      transcript: result.transcript,
      modelId: `${asrModel}+${diarizationModel}`,
      costPerMinuteCents: 0
    }
  } catch (error) {
    err('Error processing Reverb transcription', error as Error)
    l('Reverb setup hint', { hint: 'Run: bun setup:reverb and ensure HF_TOKEN is set' })
    throw error
  }
}
