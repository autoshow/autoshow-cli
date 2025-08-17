import { l, err } from '@/logging'
import { readFile, unlink, spawn, existsSync, execPromise } from '@/node-utils'
import { TRANSCRIPTION_SERVICES_CONFIG } from './transcription-models'
import type { ProcessingOptions } from '@/types'
import type { Ora } from 'ora'

export function formatTimestamp(timestamp: string) {
  const [timeWithoutMs] = timestamp.split(',') as [string]
  return timeWithoutMs
}

interface WhisperTranscriptItem {
  text: string
  timestamps: {
    from: string
    to: string
  }
}

interface WhisperJsonData {
  transcription: WhisperTranscriptItem[]
}

interface TranscriptChunk {
  timestamp: string
  text: string
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
  const p = '[text/transcription/whisper]'
  if (whisperModel === 'turbo') whisperModel = 'large-v3-turbo'

  const whisperCliPath = './bin/whisper-cli'
  const modelPath = `./models/ggml-${whisperModel}.bin`

  if (!existsSync(whisperCliPath)) {
    err('whisper-cli binary not found. Please run setup script: npm run setup')
    throw new Error('whisper-cli binary not found')
  }

  if (!existsSync(modelPath)) {
    l.dim(`${p} Model not found locally, attempting download...`)
    l.dim(`${p}   - ${whisperModel}`)
    try {
      await execPromise(
        `bash ./models/download-ggml-model.sh ${whisperModel}`,
        { maxBuffer: 10000 * 1024 }
      )
      l.dim(`${p} Model download completed.`)
    } catch (error) {
      err(`${p} Error downloading model: ${(error as Error).message}`)
      throw error
    }
  } else {
    l.dim(`${p} Model "${whisperModel}" is already available at:`)
    l.dim(`${p}   - ${modelPath}`)
  }
}

async function runWhisperWithProgress(command: string, args: string[], spinner: Ora): Promise<void> {
  return new Promise((resolve, reject) => {
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
        resolve()
      } else {
        reject(new Error(`whisper-cli exited with code ${code}`))
      }
    })

    whisperProcess.on('error', (error) => {
      reject(error)
    })
  })
}

export async function callWhisper(
  options: ProcessingOptions,
  finalPath: string,
  spinner?: Ora
) {
  const p = '[text/transcription/whisper]'
  l.opts(`${p} callWhisper called with arguments:`)
  l.opts(`${p}   - finalPath: ${finalPath}`)

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

    await checkWhisperModel(modelId)

    l.dim(`${p} Invoking whisper-cli on file:`)
    l.dim(`${p}   - ${finalPath}.wav`)
    
    const args = [
      '--no-gpu',
      '-m', `./models/ggml-${modelId}.bin`,
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
        await runWhisperWithProgress('./bin/whisper-cli', args, spinner)
      } else {
        await execPromise(
          `./bin/whisper-cli ${args.join(' ')}`,
          { maxBuffer: 10000 * 1024 }
        )
      }
    } catch (whisperError) {
      err(`${p} Error running whisper-cli: ${(whisperError as Error).message}`)
      throw whisperError
    }

    l.dim(`${p} Transcript JSON file successfully created, reading file for txt conversion:`)
    l.dim(`${p}   - ${finalPath}.json`)
    const jsonContent = await readFile(`${finalPath}.json`, 'utf8')
    const parsedJson = JSON.parse(jsonContent)
    const txtContent = formatWhisperTranscript(parsedJson)
    await unlink(`${finalPath}.json`)

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