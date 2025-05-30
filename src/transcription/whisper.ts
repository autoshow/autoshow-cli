// src/transcription/whisper.ts

import { l, err } from '../utils/logging.ts'
import { readFile, unlink, execPromise, existsSync } from '../utils/node-utils.ts'
import { TRANSCRIPTION_SERVICES_CONFIG } from '../process-steps/03-run-transcription.ts'
import type { ProcessingOptions } from '../utils/types.ts'

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

export async function checkWhisperDirAndModel(
  whisperModel: string,
  modelGGMLName: string
) {
  if (whisperModel === 'turbo') whisperModel = 'large-v3-turbo'

  const whisperDir = './whisper.cpp'
  const whisperCliPath = `${whisperDir}/build/bin/whisper-cli`
  const modelPath = `${whisperDir}/models/${modelGGMLName}`

  if (!existsSync(whisperDir)) {
    l.dim(`\n  No whisper.cpp repo found, cloning and compiling...\n`)
    try {
      await execPromise(
        `git clone https://github.com/ggerganov/whisper.cpp.git && ` +
        `cmake -B ${whisperDir}/build -S ${whisperDir} && ` +
        `cmake --build ${whisperDir}/build --config Release`
      )
      l.dim(`\n    - whisper.cpp clone and compilation complete.\n`)
    } catch (error) {
      err(`Error cloning/building whisper.cpp: ${(error as Error).message}`)
      throw error
    }
  } else {
    l.dim(`\n  Whisper.cpp repo is already available at:\n    - ${whisperDir}\n`)
    if (!existsSync(whisperCliPath)) {
      l.dim(`\n  No whisper-cli binary found, rebuilding...\n`)
      try {
        await execPromise(
          `cmake -B ${whisperDir}/build -S ${whisperDir} && ` +
          `cmake --build ${whisperDir}/build --config Release`
        )
        l.dim(`\n    - whisper.cpp build completed.\n`)
      } catch (error) {
        err(`Error rebuilding whisper.cpp: ${(error as Error).message}`)
        throw error
      }
    } else {
      l.dim(`  Found whisper-cli at:\n    - ${whisperCliPath}\n`)
    }
  }

  if (!existsSync(modelPath)) {
    l.dim(`\n  Model not found locally, attempting download...\n    - ${whisperModel}\n`)
    try {
      await execPromise(
        `bash ${whisperDir}/models/download-ggml-model.sh ${whisperModel}`,
        { maxBuffer: 10000 * 1024 }
      )
      l.dim('    - Model download completed.\n')
    } catch (error) {
      err(`Error downloading model: ${(error as Error).message}`)
      throw error
    }
  } else {
    l.dim(`  Model "${whisperModel}" is already available at:\n    - ${modelPath}\n`)
  }
}

export async function callWhisper(
  options: ProcessingOptions,
  finalPath: string
) {
  l.opts('\n  callWhisper called with arguments:')
  l.opts(`    - finalPath: ${finalPath}`)

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

    const modelGGMLName = `ggml-${modelId}.bin`

    await checkWhisperDirAndModel(modelId, modelGGMLName)

    l.dim(`  Invoking whisper.cpp on file:\n    - ${finalPath}.wav`)
    try {
      await execPromise(
        `./whisper.cpp/build/bin/whisper-cli --no-gpu ` +
        `-m "whisper.cpp/models/${modelGGMLName}" ` +
        `-f "${finalPath}.wav" ` +
        `-of "${finalPath}" ` +
        `-ml 1 ` +
        `--threads 6 ` +
        `--processors 2 ` +
        `--output-json`,
        { maxBuffer: 10000 * 1024 }
      )
    } catch (whisperError) {
      err(`Error running whisper.cpp: ${(whisperError as Error).message}`)
      throw whisperError
    }

    l.dim(`\n  Transcript JSON file successfully created, reading file for txt conversion:\n    - ${finalPath}.json\n`)
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
    err('Error in callWhisper:', (error as Error).message)
    process.exit(1)
  }
}