import { l, err } from '@/logging'
import { ensureDir, path, spawnSync, readFileSync, existsSync } from '@/node-utils'
import { generateUniqueFilename } from '../music-utils'
import type { MusicGenerationOptions, MusicGenerationResult } from '../music-types'

const p = '[music/music-services/stable-audio]'

const getStableAudioConfig = () => {
  const configPath = path.join(process.cwd(), '.music-config.json')
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  const pythonPath = config.python || process.env['MUSIC_PYTHON_PATH'] || 
    (existsSync(path.join(process.cwd(), 'python_env/bin/python')) ? path.join(process.cwd(), 'python_env/bin/python') : 'python3')
  return { python: pythonPath, ...config.stable_audio }
}

const verifyStableAudioEnvironment = (pythonPath: string) => {
  const versionResult = spawnSync(pythonPath, ['--version'], { encoding: 'utf-8', stdio: 'pipe' })
  if (versionResult.error || versionResult.status !== 0) err(`${p} Python not accessible at ${pythonPath}. Run: npm run setup`)
  const checkResult = spawnSync(pythonPath, ['-c', 'import stable_audio_tools'], { encoding: 'utf-8', stdio: 'pipe' })
  if (checkResult.status !== 0) err(`${p} stable-audio-tools not installed. Run: npm run setup`)
}

const downloadModelIfNeeded = async (modelName: string, pythonPath: string): Promise<void> => {
  const cacheDir = getStableAudioConfig().cache_dir || 'models/stable-audio'
  const checkScript = `
import os
os.environ['HF_HOME'] = '${cacheDir}'
from stable_audio_tools import get_pretrained_model
try:
    model, config = get_pretrained_model('${modelName}')
    print('MODEL_EXISTS')
except Exception as e:
    print(f'MODEL_MISSING: {e}')
`
  
  const result = spawnSync(pythonPath, ['-c', checkScript], { encoding: 'utf-8', stdio: 'pipe' })
  
  if (result.stdout && !result.stdout.includes('MODEL_EXISTS')) {
    l.dim(`${p} Model ${modelName} not found, downloading...`)
    const downloadScript = `
import os
os.environ['HF_HOME'] = '${cacheDir}'
os.makedirs('${cacheDir}', exist_ok=True)
from stable_audio_tools import get_pretrained_model
print('Downloading ${modelName}...')
model, config = get_pretrained_model('${modelName}')
print('Download complete')
`
    const downloadResult = spawnSync(pythonPath, ['-c', downloadScript], { encoding: 'utf-8', stdio: 'inherit' })
    if (downloadResult.status !== 0) {
      err(`${p} Failed to download model ${modelName}`)
    }
  }
}

export async function generateMusicWithStableAudio(
  prompt: string,
  outputPath?: string,
  options: MusicGenerationOptions = {}
): Promise<MusicGenerationResult> {
  const config = getStableAudioConfig()
  verifyStableAudioEnvironment(config.python)
  
  const modelName = options.model || config.default_model || 'stabilityai/stable-audio-open-1.0'
  
  await downloadModelIfNeeded(modelName, config.python)
  
  const pythonScriptPath = path.join(path.dirname(import.meta.url.replace('file://', '')), 'stable-audio-python.py')
  const uniqueOutputPath = outputPath || generateUniqueFilename('music', 'wav')
  
  await ensureDir(path.dirname(uniqueOutputPath))
  
  const configData = {
    model: modelName,
    prompt,
    output: uniqueOutputPath,
    cache_dir: config.cache_dir || 'models/stable-audio',
    duration: options.duration || 8,
    steps: options.steps || 100,
    cfg_scale: options.cfgScale || 7.0,
    sigma_min: options.sigmaMin || 0.3,
    sigma_max: options.sigmaMax || 500,
    sampler_type: options.samplerType || 'dpmpp-3m-sde',
    seed: options.seed,
    batch_size: options.batchSize || 1
  }
  
  l.dim(`${p} Generating music with model: ${modelName}`)
  l.dim(`${p} Duration: ${configData.duration}s, Steps: ${configData.steps}, CFG: ${configData.cfg_scale}`)
  
  const result = spawnSync(config.python, [pythonScriptPath, JSON.stringify(configData)], { 
    stdio: ['pipe', 'pipe', 'pipe'], 
    encoding: 'utf-8',
    env: { ...process.env, PYTHONWARNINGS: 'ignore', WANDB_MODE: 'offline' },
    maxBuffer: 1024 * 1024 * 50
  })
  
  if (result.error) {
    const errorWithCode = result.error as NodeJS.ErrnoException
    err(`${p} ${errorWithCode.code === 'ENOENT' ? 'Python not found. Run: npm run setup' : `Python error: ${result.error.message}`}`)
  }
  
  if (result.status !== 0) {
    const stderr = result.stderr || ''
    err(`${p} ${stderr.includes('ModuleNotFoundError') ? 'stable-audio-tools not installed. Run: npm run setup' :
        stderr.includes('CUDA out of memory') ? 'Out of GPU memory. Try reducing duration or steps.' :
        `Music generation failed: ${stderr}`}`)
  }
  
  const wavPath = uniqueOutputPath.endsWith('.wav') ? uniqueOutputPath : uniqueOutputPath.replace(/\.[^.]+$/, '.wav')
  if (!existsSync(wavPath)) {
    if (existsSync(uniqueOutputPath)) {
      return { success: true, path: uniqueOutputPath }
    }
    err(`${p} Output file missing after generation`)
  }
  
  return { success: true, path: wavPath }
}

export async function listStableAudioModels(): Promise<string[]> {
  return ['stabilityai/stable-audio-open-1.0']
}