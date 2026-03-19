import { resolve } from 'node:path'
import type { Step4Metadata } from '~/types'
import { TtsScriptOutputSchema } from '~/types'
import * as l from '~/logger'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { exec } from '~/utils/cli-utils'
import { validateData } from '~/utils/validate/validation'
import { kittenTtsUvEnvDir } from '~/cli/commands/process-steps/step-0-setup/setup-orchestrator/run-complete-setup'
import {
  type KittenTtsModel,
  resolveKittenTtsModelId
} from '~/cli/commands/models/model-options'

const SCRIPT_PATH = resolve(import.meta.dir, 'scripts/run-kitten-tts.py')

export const runKittenTts = async (
  text: string,
  outputDir: string,
  options: { model: KittenTtsModel, speaker: string }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const hfModelId = resolveKittenTtsModelId(options.model)
  const audioPath = `${outputDir}/speech.wav`
  const textPath = `${outputDir}/tts-input.txt`
  const pythonPath = `${kittenTtsUvEnvDir}/bin/python`

  logTtsConfig('Kitten', [
    { label: 'model', value: hfModelId },
    { label: 'voice', value: options.speaker }
  ])

  await Bun.write(textPath, text)

  const startTime = Date.now()

  l.info(`Invoking Kitten TTS inference script`)
  const result = await exec(pythonPath, [
    SCRIPT_PATH,
    '--model', hfModelId,
    '--input', textPath,
    '--output', audioPath,
    '--voice', options.speaker
  ])

  if (result.stderr) {
    const stderrLines = result.stderr.split('\n').filter((line: string) => line.trim())
    for (const line of stderrLines) {
      if (
        line.includes('ERROR') ||
        line.includes('Traceback') ||
        line.includes('File "') ||
        line.includes('Error:')
      ) {
        l.error(`TTS stderr: ${line}`)
      } else if (line.startsWith('[kitten-tts]')) {
        l.info(line)
      }
    }
  }

  if (result.stdout && result.stdout.includes('Traceback')) {
    l.error(`Python error in TTS stdout`)
    result.stdout.split('\n').forEach((line: string) => {
      if (line.trim()) l.error(line)
    })
    throw new Error('Kitten TTS failed with a Python error')
  }

  if (result.exitCode !== 0) {
    const stderr = result.stderr.trim()
    if (stderr.includes('ModuleNotFoundError') || stderr.includes('No module named')) {
      throw new Error(
        `Kitten TTS not installed. Run: bun as setup\n${stderr}`
      )
    }
    throw new Error(`Kitten TTS exited with code ${result.exitCode}: ${stderr}`)
  }

  const lastLine = result.stdout.trim().split('\n').pop() ?? ''
  let chunkCount = 1
  if (lastLine.startsWith('{')) {
    try {
      const scriptOutput = validateData(TtsScriptOutputSchema, JSON.parse(lastLine), 'TTS script output')
      chunkCount = scriptOutput.chunkCount
      l.info(`Generated ${scriptOutput.durationSeconds}s of audio in ${scriptOutput.chunkCount} chunk(s)`)
    } catch {
      l.warn('Could not parse Kitten TTS script metadata from stdout')
    }
  }

  const processingTime = Date.now() - startTime

  const audioFile = Bun.file(audioPath)
  const audioFileSize = audioFile.size

  l.success(`Speech saved to ${audioPath}`)

  const metadata: Step4Metadata = {
    ttsService: 'kitten',
    ttsModel: options.model,
    speaker: options.speaker,
    processingTime,
    audioFileName: 'speech.wav',
    audioFileSize,
    chunkCount
  }

  return { audioPath, metadata }
}
