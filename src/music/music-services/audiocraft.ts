import { l, err } from '@/logging'
import { ensureDir, path, spawnSync, readFileSync, existsSync } from '@/node-utils'
import { generateUniqueFilename, ensureMusicEnvironment } from '../music-utils'
import type { MusicGenerationOptions, MusicGenerationResult } from '../music-types'

const p = '[music/music-services/audiocraft]'

const getAudioCraftConfig = () => {
  const configPath = path.join(process.cwd(), 'build/config', '.music-config.json')
  l.dim(`${p} Loading config from: ${configPath}`)
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
  const pythonPath = config.python || process.env['MUSIC_PYTHON_PATH'] || 
    (existsSync(path.join(process.cwd(), 'build/pyenv/tts/bin/python')) ? path.join(process.cwd(), 'build/pyenv/tts/bin/python') : 'python3')
  l.dim(`${p} Using Python path: ${pythonPath}`)
  return { python: pythonPath, ...config.audiocraft }
}

const verifyAudioCraftEnvironment = (pythonPath: string) => {
  const versionResult = spawnSync(pythonPath, ['--version'], { encoding: 'utf-8', stdio: 'pipe' })
  if (versionResult.error || versionResult.status !== 0) {
    l.dim(`${p} Python not accessible, attempting setup`)
    ensureMusicEnvironment()
    const retryResult = spawnSync(pythonPath, ['--version'], { encoding: 'utf-8', stdio: 'pipe' })
    if (retryResult.error || retryResult.status !== 0) {
      err(`${p} Python not accessible at ${pythonPath} even after setup attempt`)
    }
  }
  
  const checkResult = spawnSync(pythonPath, ['-c', 'import audiocraft'], { encoding: 'utf-8', stdio: 'pipe' })
  if (checkResult.status !== 0) {
    l.dim(`${p} AudioCraft not installed, attempting setup`)
    ensureMusicEnvironment()
    const retryCheckResult = spawnSync(pythonPath, ['-c', 'import audiocraft'], { encoding: 'utf-8', stdio: 'pipe' })
    if (retryCheckResult.status !== 0) {
      err(`${p} AudioCraft not installed even after setup attempt. Please run: npm run setup:music`)
    }
  }
}

const downloadModelIfNeeded = async (modelName: string, pythonPath: string): Promise<void> => {
  const cacheDir = getAudioCraftConfig().cache_dir || 'build/models/audiocraft'
  l.dim(`${p} Using cache directory: ${cacheDir}`)
  const checkScript = `
import os
os.environ['AUDIOCRAFT_CACHE_DIR'] = '${cacheDir}'
from audiocraft.models import MusicGen
try:
    MusicGen.get_pretrained('${modelName}')
    print('MODEL_EXISTS')
except Exception as e:
    print(f'MODEL_MISSING: {e}')
`
  
  const result = spawnSync(pythonPath, ['-c', checkScript], { encoding: 'utf-8', stdio: 'pipe' })
  
  if (result.stdout && !result.stdout.includes('MODEL_EXISTS')) {
    l.dim(`${p} Model ${modelName} not found, downloading...`)
    const downloadScript = `
import os
os.environ['AUDIOCRAFT_CACHE_DIR'] = '${cacheDir}'
os.makedirs('${cacheDir}', exist_ok=True)
from audiocraft.models import MusicGen
print('Downloading ${modelName}...')
MusicGen.get_pretrained('${modelName}')
print('Download complete')
`
    const downloadResult = spawnSync(pythonPath, ['-c', downloadScript], { encoding: 'utf-8', stdio: 'inherit' })
    if (downloadResult.status !== 0) {
      err(`${p} Failed to download model ${modelName}`)
    }
  }
}

export async function generateMusicWithAudioCraft(
  prompt: string,
  outputPath?: string,
  options: MusicGenerationOptions = {}
): Promise<MusicGenerationResult> {
  ensureMusicEnvironment()
  
  const config = getAudioCraftConfig()
  verifyAudioCraftEnvironment(config.python)
  
  const modelName = options.model || config.default_model || 'facebook/musicgen-small'
  l.dim(`${p} Using model: ${modelName}`)
  
  await downloadModelIfNeeded(modelName, config.python)
  
  const pythonScriptPath = path.join(path.dirname(import.meta.url.replace('file://', '')), 'audiocraft-python.py')
  const uniqueOutputPath = outputPath || generateUniqueFilename('music', 'wav')
  
  await ensureDir(path.dirname(uniqueOutputPath))
  
  const configData = {
    model: modelName,
    prompt,
    output: uniqueOutputPath,
    cache_dir: config.cache_dir || 'build/models/audiocraft',
    duration: options.duration || 8,
    temperature: options.temperature || 1.0,
    top_k: options.topK || 250,
    top_p: options.topP || 0.0,
    cfg_coef: options.cfgCoef || 3.0,
    use_sampling: options.useSampling !== false,
    two_step_cfg: options.twoStepCfg || false,
    extend_stride: options.extendStride || 18,
    melody_path: options.melodyPath,
    continuation_path: options.continuationPath
  }
  
  l.dim(`${p} Generating music with model: ${modelName}`)
  l.dim(`${p} Duration: ${configData.duration}s, Temperature: ${configData.temperature}`)
  
  const result = spawnSync(config.python, [pythonScriptPath, JSON.stringify(configData)], { 
    stdio: ['pipe', 'pipe', 'pipe'], 
    encoding: 'utf-8',
    env: { ...process.env, PYTHONWARNINGS: 'ignore' },
    maxBuffer: 1024 * 1024 * 50
  })
  
  if (result.error) {
    const errorWithCode = result.error as NodeJS.ErrnoException
    err(`${p} ${errorWithCode.code === 'ENOENT' ? 'Python not found. Run: npm run setup:music' : `Python error: ${result.error.message}`}`)
  }
  
  if (result.status !== 0) {
    const stderr = result.stderr || ''
    err(`${p} ${stderr.includes('ModuleNotFoundError') ? 'AudioCraft not installed. Run: npm run setup:music' :
        stderr.includes('CUDA out of memory') ? 'Out of GPU memory. Try a smaller model or shorter duration.' :
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

export async function listAvailableModels(): Promise<string[]> {
  ensureMusicEnvironment()
  
  const config = getAudioCraftConfig()
  const pythonPath = config.python || 'python3'
  l.dim(`${p} Listing models using Python: ${pythonPath}`)
  
  const listScript = `
models = [
    'facebook/musicgen-small',
    'facebook/musicgen-medium', 
    'facebook/musicgen-large',
    'facebook/musicgen-melody',
    'facebook/musicgen-melody-large',
    'facebook/musicgen-stereo-small',
    'facebook/musicgen-stereo-medium',
    'facebook/musicgen-stereo-large',
    'facebook/musicgen-stereo-melody',
    'facebook/musicgen-stereo-melody-large'
]
for model in models:
    print(model)
`
  
  const result = spawnSync(pythonPath, ['-c', listScript], { encoding: 'utf-8', stdio: 'pipe' })
  
  if (result.status === 0 && result.stdout) {
    return result.stdout.trim().split('\n').filter(line => line.trim())
  }
  
  return ['facebook/musicgen-small', 'facebook/musicgen-medium', 'facebook/musicgen-large']
}