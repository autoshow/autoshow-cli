import { err } from '@/logging'
import { readFile, unlink, existsSync, spawn } from '@/node-utils'
import { isWhisperCoreMLConfigured, autoSetupWhisperCoreML, ensureCoreMLModelExists } from '@/text/utils/setup-helpers'
import { formatWhisperTranscript } from './whisper'
import type { ProcessingOptions } from '@/text/text-types'
import type { Ora } from 'ora'
import { registerProcess } from '@/utils'

async function runWithProgress(command: string, args: string[], spinner?: Ora): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args)
    
    const unregister = registerProcess(proc)
    
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
      unregister()
      if (code === 0) {
        resolve()
      } else {
        err('CoreML whisper process exited with code', { code })
        reject(new Error(`whisper-cli-coreml exited with code ${code}`))
      }
    })
    proc.on('error', e => {
      unregister()
      err('CoreML whisper process error', { error: e.message })
      reject(e)
    })
  })
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

export async function callWhisperCoreml(
  options: ProcessingOptions,
  finalPath: string,
  spinner?: Ora
) {
  if (!isWhisperCoreMLConfigured()) {
    await autoSetupWhisperCoreML()
  }

  const whisperModel = typeof options['whisperCoreml'] === 'string'
    ? options['whisperCoreml']
    : options['whisperCoreml'] === true
      ? 'base'
      : (() => { throw new Error('Invalid whisperCoreml option') })()
  
  const binaryPath = './build/bin/whisper-cli-coreml'
  if (!existsSync(binaryPath)) {
    throw new Error(`whisper-cli-coreml not found at ${binaryPath}. Run: bun setup:transcription`)
  }

  const modelPath = `./build/models/ggml-${whisperModel}.bin`
  if (!existsSync(modelPath)) {
    await ensureCoreMLModelExists(whisperModel)
  }

  const encoderPath = await findCoreMLEncoder(whisperModel)
  if (!encoderPath) {
    await ensureCoreMLModelExists(whisperModel)
    const retryEncoderPath = await findCoreMLEncoder(whisperModel)
    if (!retryEncoderPath) {
      throw new Error(`CoreML encoder not found for ${whisperModel} even after generation attempt`)
    }
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
  
  if (spinner) {
    await runWithProgress('./build/bin/whisper-cli-coreml', args, spinner)
  } else {
    await runWithProgress('./build/bin/whisper-cli-coreml', args, undefined)
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
}