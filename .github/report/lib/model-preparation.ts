/**
 * Model preparation checks used by setup reports to capture download/readiness timing.
 */

import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import type { ModelPreparationResult } from '../types.ts'
import { fileExists } from './utils.ts'

const TTS_PYTHON = 'build/pyenv/tts/bin/python'

const DEFAULT_MODELS: Record<string, string> = {
  'setup:tts:qwen3': 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice',
  'setup:tts:chatterbox': 'turbo',
  'setup:tts:fish': 's1-mini',
  'setup:tts:cosyvoice': 'CosyVoice-300M-Instruct',
}

function nowIso(): string {
  return new Date().toISOString()
}

async function runPythonSnippet(code: string): Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number }> {
  if (!(await fileExists(TTS_PYTHON))) {
    return {
      success: false,
      stdout: '',
      stderr: `Python not found at ${TTS_PYTHON}`,
      exitCode: 1,
    }
  }

  const proc = Bun.spawn([TTS_PYTHON, '-c', code], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      PYTHONWARNINGS: 'ignore',
    },
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return {
    success: exitCode === 0,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    exitCode,
  }
}

async function hasAnyFiles(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir)
    return entries.length > 0
  } catch {
    return false
  }
}

async function checkDockerDaemon(): Promise<{ ready: boolean; error?: string }> {
  try {
    const proc = Bun.spawn(['docker', 'info'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])

    if (exitCode === 0) {
      return { ready: true }
    }

    const message = (stderr || stdout).trim() || 'Docker daemon is not available.'
    return { ready: false, error: message }
  } catch (error) {
    return {
      ready: false,
      error: `Failed to execute docker info: ${String(error)}`,
    }
  }
}

async function isCosyVoiceDockerReady(): Promise<boolean> {
  try {
    const timeoutMs = 3000
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch('http://localhost:50000/health', {
      method: 'GET',
      signal: controller.signal,
    })
    clearTimeout(timer)
    return response.status === 200
  } catch {
    return false
  }
}

function modelPreparationBase(setupCommand: string, model?: string): Omit<ModelPreparationResult, 'startTime' | 'endTime' | 'durationMs' | 'success'> {
  return {
    model: model || DEFAULT_MODELS[setupCommand] || 'default',
    method: 'asset-check',
  }
}

export async function prepareTtsModel(setupCommand: string, model?: string): Promise<ModelPreparationResult> {
  const startNanos = Bun.nanoseconds()
  const startTime = nowIso()
  const base = modelPreparationBase(setupCommand, model)
  const modelName = base.model

  const finish = (success: boolean, extra: Partial<ModelPreparationResult> = {}): ModelPreparationResult => ({
    ...base,
    ...extra,
    startTime,
    endTime: nowIso(),
    durationMs: (Bun.nanoseconds() - startNanos) / 1_000_000,
    success,
  })

  if (setupCommand === 'setup:tts:qwen3') {
    const snippet = `
import torch
from qwen_tts import Qwen3TTSModel
model_name = ${JSON.stringify(modelName)}
device = "cuda:0" if torch.cuda.is_available() else "cpu"
dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
kwargs = {"device_map": device, "torch_dtype": dtype}
if device != "cpu":
    kwargs["attn_implementation"] = "flash_attention_2"
Qwen3TTSModel.from_pretrained(model_name, **kwargs)
print("ready")
`
    const result = await runPythonSnippet(snippet)
    return finish(result.success, {
      method: 'python-prefetch',
      details: result.success ? `Prefetched ${modelName}` : undefined,
      error: result.success ? undefined : result.stderr || result.stdout || 'Unknown qwen3 prefetch failure',
    })
  }

  if (setupCommand === 'setup:tts:chatterbox') {
    const snippet = `
model_type = ${JSON.stringify(modelName)}
if model_type == "standard":
    from chatterbox.tts import ChatterboxTTS
    ChatterboxTTS.from_pretrained(device="cpu")
else:
    from chatterbox.tts_turbo import ChatterboxTurboTTS
    ChatterboxTurboTTS.from_pretrained(device="cpu")
print("ready")
`
    const result = await runPythonSnippet(snippet)
    return finish(result.success, {
      method: 'python-prefetch',
      details: result.success ? `Prefetched chatterbox model ${modelName}` : undefined,
      error: result.success ? undefined : result.stderr || result.stdout || 'Unknown chatterbox prefetch failure',
    })
  }

  if (setupCommand === 'setup:tts:fish') {
    const checkpointDir = modelName === 's1'
      ? join(process.cwd(), 'build/checkpoints/openaudio-s1')
      : join(process.cwd(), 'build/checkpoints/openaudio-s1-mini')
    const configPath = join(checkpointDir, 'config.json')
    const assetsReady = (await fileExists(configPath)) || (await hasAnyFiles(checkpointDir))
    const dockerReady = await checkDockerDaemon()

    return finish(assetsReady, {
      method: 'asset-check',
      details: assetsReady
        ? dockerReady.ready
          ? `FishAudio assets found at ${checkpointDir}; Docker daemon available`
          : `FishAudio assets found at ${checkpointDir}; Docker daemon unavailable right now (runtime check will enforce Docker readiness).`
        : undefined,
      error: assetsReady ? undefined : `FishAudio model assets missing at ${checkpointDir}`,
    })
  }

  if (setupCommand === 'setup:tts:cosyvoice') {
    if (await isCosyVoiceDockerReady()) {
      return finish(true, {
        method: 'docker-health-check',
        details: 'CosyVoice Docker API is healthy at http://localhost:50000/health',
      })
    }

    const modelDir = join(process.cwd(), 'build/cosyvoice/pretrained_models', modelName)
    const configCandidates = ['cosyvoice.yaml', 'cosyvoice2.yaml', 'cosyvoice3.yaml']
    let hasConfig = false
    for (const file of configCandidates) {
      if (await fileExists(join(modelDir, file))) {
        hasConfig = true
        break
      }
    }
    return finish(hasConfig, {
      method: 'asset-check',
      details: hasConfig ? `CosyVoice assets found at ${modelDir}` : undefined,
      error: hasConfig ? undefined : `CosyVoice model assets missing at ${modelDir} and Docker API is unavailable`,
    })
  }

  return finish(false, {
    method: 'asset-check',
    error: `Model preparation is only supported for TTS setup commands. Received: ${setupCommand}`,
  })
}

export async function isFishRuntimeReady(model?: string): Promise<{ ready: boolean; error?: string }> {
  const modelName = model || DEFAULT_MODELS['setup:tts:fish'] || 's1-mini'
  const checkpointDir = modelName === 's1'
    ? join(process.cwd(), 'build/checkpoints/openaudio-s1')
    : join(process.cwd(), 'build/checkpoints/openaudio-s1-mini')
  const configPath = join(checkpointDir, 'config.json')

  const assetsReady = (await fileExists(configPath)) || (await hasAnyFiles(checkpointDir))
  if (!assetsReady) {
    return { ready: false, error: `FishAudio model assets missing at ${checkpointDir}. Run: bun .github/report/cli.ts setup setup:tts:fish --fresh` }
  }

  const dockerReady = await checkDockerDaemon()
  if (!dockerReady.ready) {
    return {
      ready: false,
      error: `Docker daemon is unavailable for FishAudio runtime. Start Docker Desktop/daemon, then retry runtime report.`,
    }
  }

  return { ready: true }
}
