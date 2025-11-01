import { l, err } from '@/logging'
import { readFile, unlink, existsSync, execPromise, spawn } from '@/node-utils'
import { formatWhisperTranscript } from './whisper.ts'
import { callWhisper } from './whisper.ts'
import { ensureCoreMLEnvironment, ensureWhisperModel, runSetupWithRetry, ensureCoreMLEncoder as ensureCoreMLEncoderHelper } from '../../utils/setup-helpers'
import type { ProcessingOptions } from '@/text/text-types'
import type { Ora } from 'ora'

async function runWithProgress(command: string, args: string[], spinner?: Ora): Promise<void> {
  const p = '[text/process-steps/02-run-transcription/whisper-coreml]'
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args)
    let last = -1
    const onData = (data: Buffer) => {
      const out = data.toString()
      out.split('\n').forEach(line => {
        const m = line.match(/whisper_print_progress_callback:\s*progress\s*=\s*(\d+)%/)
        if (m) {
          const progress = parseInt(m[1]!)
          if (progress !== last) {
            last = progress
            if (spinner) spinner.text = `Step 3 - Run Transcription (${progress}%)`
          }
        }
      })
    }
    proc.stdout.on('data', onData)
    proc.stderr.on('data', onData)
    proc.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        l.warn(`${p} CoreML whisper process exited with code ${code}`)
        reject(new Error(`whisper-cli-coreml exited with code ${code}`))
      }
    })
    proc.on('error', e => {
      l.warn(`${p} CoreML whisper process error: ${e.message}`)
      reject(e)
    })
  })
}

async function checkCoreMLAvailability(): Promise<boolean> {
  const configPath = './build/config/.coreml-config.json'
  
  try {
    if (existsSync(configPath)) {
      const config = JSON.parse(await readFile(configPath, 'utf8'))
      if (config.available === false) {
        return false
      }
    }
    
    const py = './build/pyenv/coreml/bin/python'
    if (!existsSync(py)) {
      return false
    }
    
    await execPromise(`${py} -c "import torch,coremltools,numpy,transformers,sentencepiece,huggingface_hub,ane_transformers,safetensors,whisper"`, { maxBuffer: 10000 * 1024 })
    return true
  } catch (e: any) {
    return false
  }
}

async function ensureCoreMLEnv(): Promise<void> {
  const p = '[text/process-steps/02-run-transcription/whisper-coreml]'
  const py = './build/pyenv/coreml/bin/python'
  const binary = './build/bin/whisper-cli-coreml'
  
  if (!existsSync(py) || !existsSync(binary)) {
    l.warn('CoreML environment not found, attempting automatic setup')
    
    const setupSuccess = await runSetupWithRetry(() => ensureCoreMLEnvironment(), 1)
    if (!setupSuccess) {
      l.warn('Could not automatically setup CoreML environment')
      throw new Error('CoreML environment setup failed. Run npm run setup:whisper-coreml')
    }
    
    l.success('CoreML environment successfully installed')
  }
  
  try {
    await execPromise(`${py} -c "import torch,coremltools,numpy,transformers,sentencepiece,huggingface_hub,ane_transformers,safetensors,whisper"`, { maxBuffer: 10000 * 1024 })
  } catch (e: any) {
    err(`${p} CoreML conversion dependencies missing: ${e.message}`)
    throw new Error('CoreML conversion dependencies not installed properly')
  }
}

async function findCoreMLEncoder(modelId: string): Promise<string | null> {
  const mlmodelcPath = `./build/models/ggml-${modelId}-encoder.mlmodelc`
  if (existsSync(mlmodelcPath)) {
    return mlmodelcPath
  }
  
  const mlpackagePath = `./build/models/ggml-${modelId}-encoder.mlpackage`
  if (existsSync(mlpackagePath)) {
    return mlpackagePath
  }
  
  const altPackagePath = `./build/models/coreml-encoder-${modelId}.mlpackage`
  if (existsSync(altPackagePath)) {
    return altPackagePath
  }
  
  return null
}

async function ensureCoreMLEncoder(modelId: string): Promise<void> {
  const p = '[text/process-steps/02-run-transcription/whisper-coreml]'
  
  const existingEncoder = await findCoreMLEncoder(modelId)
  if (existingEncoder) {
    return
  }
  
  const encoderSuccess = await runSetupWithRetry(() => ensureCoreMLEncoderHelper(modelId), 1)
  if (!encoderSuccess) {
    throw new Error(`Failed to generate CoreML encoder for model: ${modelId}`)
  }
   
  const newEncoder = await findCoreMLEncoder(modelId)
  if (!newEncoder) {
    l.warn(`${p} CoreML encoder generation failed for ${modelId}`)
    throw new Error(`CoreML encoder not found after generation for model: ${modelId}`)
  }
}

export async function callWhisperCoreml(
  options: ProcessingOptions,
  finalPath: string,
  spinner?: Ora
) {
  const p = '[text/process-steps/02-run-transcription/whisper-coreml]'
  
  const whisperModel = typeof options['whisperCoreml'] === 'string'
    ? options['whisperCoreml']
    : options['whisperCoreml'] === true
      ? 'base'
      : (() => { throw new Error('Invalid whisperCoreml option') })()
  
  const coremlAvailable = await checkCoreMLAvailability()
  if (!coremlAvailable) {
    const setupSuccess = await runSetupWithRetry(() => ensureCoreMLEnvironment(), 1)
    if (!setupSuccess) {
      l.warn('CoreML environment setup failed, falling back to regular whisper')
      if (spinner) {
        spinner.text = 'Step 2 - Run Transcription (fallback to whisper)'
      }
      return await callWhisper(options, finalPath, spinner)
    }
  }
  
  try {
    const modelPath = `./build/models/ggml-${whisperModel}.bin`
    if (!existsSync(modelPath)) {
      const modelSuccess = await runSetupWithRetry(() => ensureWhisperModel(whisperModel))
      if (!modelSuccess) {
        throw new Error(`Failed to download base model ${whisperModel}`)
      }
    }
    
    await ensureCoreMLEnv()
    await ensureCoreMLEncoder(whisperModel)

    const encoderPath = await findCoreMLEncoder(whisperModel)
    if (!encoderPath) {
      throw new Error(`CoreML encoder not found for ${whisperModel}`)
    }

    const args = [
      '-m', `./build/models/ggml-${whisperModel}.bin`,
      '-f', `${finalPath}.wav`,
      '-of', finalPath,
      '-ml', '1',
      '--threads', '6',
      '--processors', '2',
      '--output-json',
      '--print-progress'
    ]
    
    try {
      if (spinner) {
        await runWithProgress('./build/bin/whisper-cli-coreml', args, spinner)
      } else {
        await execPromise(`./build/bin/whisper-cli-coreml ${args.join(' ')}`, { maxBuffer: 10000 * 1024 })
      }
    } catch (cliErr) {
      err(`${p} Error running whisper-cli-coreml: ${(cliErr as Error).message}`)
      throw cliErr
    }

    const jsonPath = `${finalPath}.json`
    const jsonContent = await readFile(jsonPath, 'utf8')
    const parsedJson = JSON.parse(jsonContent)
    const txtContent = formatWhisperTranscript(parsedJson)
    await unlink(jsonPath)
    
    return {
      transcript: txtContent,
      modelId: whisperModel,
      costPerMinuteCents: 0
    }
  } catch (error) {
    err(`${p} CoreML transcription failed: ${(error as Error).message}`)
    l.warn('Falling back to regular whisper due to CoreML error')
    if (spinner) {
      spinner.text = 'Step 2 - Run Transcription (fallback to whisper)'
    }
    return await callWhisper(options, finalPath, spinner)
  }
}