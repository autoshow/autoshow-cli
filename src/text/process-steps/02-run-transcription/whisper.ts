import { l, err } from '@/logging'
import { readFile, unlink, spawn, existsSync, execPromise } from '@/node-utils'
import { ensureWhisperBinary, ensureWhisperModel, runSetupWithRetry } from '../../utils/setup-helpers'
import { TRANSCRIPTION_SERVICES_CONFIG } from './transcription-models'
import type { ProcessingOptions, WhisperTranscriptItem, WhisperJsonData, TranscriptChunk } from '@/text/text-types'
import type { Ora } from 'ora'

export function formatTimestamp(timestamp: string) {
  const [timeWithoutMs] = timestamp.split(',') as [string]
  return timeWithoutMs
}

export function formatWhisperTranscript(jsonData: WhisperJsonData): string {
  const transcripts = jsonData.transcription
  const chunks: TranscriptChunk[] = []

  for (let i = 0; i < transcripts.length; i += 35) {
    const chunk = transcripts.slice(i, i + 35)
    const firstChunk = chunk[0]!
    const combinedText = chunk.map((item: WhisperTranscriptItem) => item.text).join('')
    chunks.push({
      timestamp: formatTimestamp(firstChunk.timestamps.from),
      text: combinedText
    })
  }

  return chunks
    .map((chunk: TranscriptChunk) => `[${chunk.timestamp}] ${chunk.text}`)
    .join('\n')
}

export async function checkWhisperModel(whisperModel: string) {
  const p = '[text/process-steps/02-run-transcription/whisper]'
  if (whisperModel === 'turbo') whisperModel = 'large-v3-turbo'

  const whisperCliPath = './build/bin/whisper-cli'
  const modelPath = `./build/models/ggml-${whisperModel}.bin`

  l.dim(`${p} Checking for whisper-cli at: ${whisperCliPath}`)
  if (!existsSync(whisperCliPath)) {
    l.warn(`${p} whisper-cli binary not found, attempting automatic setup`)
    
    const setupSuccess = await runSetupWithRetry(() => ensureWhisperBinary())
    if (!setupSuccess || !existsSync(whisperCliPath)) {
      err(`${p} Failed to automatically setup whisper-cli. Please run: npm run setup:whisper`)
      throw new Error('whisper-cli binary not found after automatic setup attempt')
    }
    
    l.success(`${p} whisper-cli binary successfully installed`)
  }

  l.dim(`${p} Checking for model at: ${modelPath}`)
  if (!existsSync(modelPath)) {
    l.dim(`${p} Model not found, attempting automatic download: ${whisperModel}`)
    
    const modelSuccess = await runSetupWithRetry(() => ensureWhisperModel(whisperModel))
    if (!modelSuccess || !existsSync(modelPath)) {
      err(`${p} Failed to automatically download model ${whisperModel}`)
      throw new Error(`Model ${whisperModel} not found after automatic download attempt`)
    }
    
    l.success(`${p} Model ${whisperModel} successfully downloaded`)
  }
  
  l.dim(`${p} Model validated at: ${modelPath}`)
}

async function runWhisperWithProgress(command: string, args: string[], spinner: Ora): Promise<void> {
  const p = '[text/process-steps/02-run-transcription/whisper]'
  return new Promise((resolve, reject) => {
    l.dim(`${p} Starting whisper process: ${command} ${args.join(' ')}`)
    const whisperProcess = spawn(command, args)
    let lastProgress = -1
    
    const processOutput = (data: Buffer) => {
      const output = data.toString()
      const lines = output.split('\n')
      
      lines.forEach(line => {
        const progressMatch = line.match(/whisper_print_progress_callback:\s*progress\s*=\s*(\d+)%/)
        if (progressMatch) {
          const currentProgress = parseInt(progressMatch[1]!)
          if (currentProgress !== lastProgress) {
            lastProgress = currentProgress
            spinner.text = `Step 3 - Run Transcription (${currentProgress}%)`
          }
        }
      })
    }

    whisperProcess.stdout.on('data', processOutput)
    whisperProcess.stderr.on('data', processOutput)

    whisperProcess.on('close', (code) => {
      if (code === 0) {
        l.dim(`${p} Whisper process completed successfully`)
        resolve()
      } else {
        l.warn(`${p} Whisper process exited with code ${code}`)
        reject(new Error(`whisper-cli exited with code ${code}`))
      }
    })

    whisperProcess.on('error', (error) => {
      l.warn(`${p} Whisper process error: ${error.message}`)
      reject(error)
    })
  })
}

export async function callWhisper(
  options: ProcessingOptions,
  finalPath: string,
  spinner?: Ora
) {
  const p = '[text/process-steps/02-run-transcription/whisper]'

  try {
    const whisperModel = typeof options.whisper === 'string'
      ? options.whisper
      : options.whisper === true
        ? 'base'
        : (() => { throw new Error('Invalid whisper option') })()

    const whisperModels = TRANSCRIPTION_SERVICES_CONFIG.whisper.models
    const chosenModel = whisperModels.find(m => m.modelId === whisperModel)
      ?? (() => { throw new Error(`Unknown model type: ${whisperModel}`) })()

    const { modelId, costPerMinuteCents } = chosenModel

    l.dim(`${p} Using whisper model: ${modelId}`)
    await checkWhisperModel(modelId)
    
    const args = [
      '--no-gpu',
      '-m', `./build/models/ggml-${modelId}.bin`,
      '-f', `${finalPath}.wav`,
      '-of', finalPath,
      '-ml', '1',
      '--threads', '6',
      '--processors', '2',
      '--output-json',
      '--print-progress'
    ]
    
    l.dim(`${p} Whisper command args: ${args.join(' ')}`)
    
    try {
      if (spinner) {
        await runWhisperWithProgress('./build/bin/whisper-cli', args, spinner)
      } else {
        await execPromise(
          `./build/bin/whisper-cli ${args.join(' ')}`,
          { maxBuffer: 10000 * 1024 }
        )
      }
    } catch (whisperError) {
      err(`${p} Error running whisper-cli: ${(whisperError as Error).message}`)
      throw whisperError
    }

    const jsonPath = `${finalPath}.json`
    l.dim(`${p} Reading transcription result from: ${jsonPath}`)
    const jsonContent = await readFile(jsonPath, 'utf8')
    const parsedJson = JSON.parse(jsonContent)
    const txtContent = formatWhisperTranscript(parsedJson)
    await unlink(jsonPath)

    l.dim(`${p} Transcription completed successfully`)
    return {
      transcript: txtContent,
      modelId,
      costPerMinuteCents
    }
  } catch (error) {
    err(`${p} Error in callWhisper: ${(error as Error).message}`)
    process.exit(1)
  }
}