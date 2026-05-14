import { readdir } from 'node:fs/promises'
import * as l from '~/utils/logger'
import { exec } from '~/utils/cli-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { requireUvCommand, reverbDiarizationDir, reverbUvEnvDir } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'

const REVERB_SCRIPTS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  'scripts'
)

export const getHuggingFaceToken = (): string | null => {
  const token = readEnv('HUGGINGFACE_TOKEN')
  if (token && token.trim().length > 0) {
    return token.trim()
  }
  return null
}

const directoryHasFiles = async (root: string): Promise<boolean> => {
  try {
    const entries = await readdir(root, { withFileTypes: true })
    for (const entry of entries) {
      const path = `${root}/${entry.name}`
      if (entry.isFile()) return true
      if (entry.isDirectory() && await directoryHasFiles(path)) return true
    }
    return false
  } catch {
    return false
  }
}

export type ReverbDiarizationModel = {
  modelName: string
  hfToken: string | null
}

export const resolveDiarizationModel = async (): Promise<ReverbDiarizationModel | null> => {
  if (await directoryHasFiles(reverbDiarizationDir)) {
    return {
      modelName: reverbDiarizationDir,
      hfToken: null
    }
  }

  const hfToken = getHuggingFaceToken()
  if (!hfToken) {
    l.warn('Reverb diarization snapshot is missing. Set HUGGINGFACE_TOKEN and run `bun as setup --step reverb` to download it.')
    return null
  }

  return {
    modelName: 'Revai/reverb-diarization-v2',
    hfToken
  }
}

export const runDiarization = async (
  audioPath: string,
  diarizationModel: ReverbDiarizationModel,
  outputDir: string
): Promise<string | null> => {
  const uvEnvDir = reverbUvEnvDir
  const scriptPath = join(REVERB_SCRIPTS_DIR, 'reverb-diarization.py')
  const rttmPath = `${outputDir}/diarization.rttm`
  try {
    const uvCommand = await requireUvCommand()
    const result = await exec(uvCommand, [
      'run', '-p', `${uvEnvDir}/bin/python`,
      scriptPath,
      audioPath,
      diarizationModel.hfToken ?? '',
      diarizationModel.modelName
    ])
    if (result.stderr && result.exitCode !== 0) {
      const stderrLines = result.stderr.split('\n').filter((line: string) => line.trim())
      stderrLines.forEach((line: string) => {
        if (line.includes('[DIARIZATION ERROR]') || line.toLowerCase().includes('error') || line.toLowerCase().includes('traceback')) {
          l.error(line)
        }
      })
    }
    if (result.exitCode !== 0) {
      l.error(`Diarization script exited with code ${result.exitCode}`)
      return null
    }
    if (!result.stdout || result.stdout.trim().length === 0) {
      l.error(`Diarization produced no RTTM output`)
      return null
    }
    await Bun.write(rttmPath, result.stdout)
    return rttmPath
  } catch (error) {
    l.error(`Failed to run diarization`, error)
    return null
  }
}

export const mergeASRWithDiarization = async (ctmPath: string, rttmPath: string, outputPath: string): Promise<unknown> => {
  const uvEnvDir = reverbUvEnvDir
  const scriptPath = join(REVERB_SCRIPTS_DIR, 'assign-words-to-speakers.py')
  try {
    const uvCommand = await requireUvCommand()
    const result = await exec(uvCommand, [
      'run', '-p', `${uvEnvDir}/bin/python`,
      scriptPath,
      rttmPath,
      ctmPath,
      outputPath
    ])
    if (result.exitCode !== 0) {
      const stderrLines = result.stderr.split('\n').filter((line: string) => line.trim())
      stderrLines.forEach((line: string) => {
        if (line.toLowerCase().includes('error')) {
          l.error(line)
        }
      })
      l.error(`Failed to merge ASR with diarization (exit code ${result.exitCode})`)
      return null
    }
    const jsonContent = await Bun.file(outputPath).text()
    const data = JSON.parse(jsonContent)
    return data
  } catch (error) {
    l.error(`Failed to merge ASR with diarization`, error)
    return null
  }
}

export const findCTMFile = async (resultDir: string): Promise<string | null> => {
  try {
    const stack = [resultDir]
    while (stack.length > 0) {
      const dir = stack.pop()
      if (!dir) {
        continue
      }

      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const path = `${dir}/${entry.name}`
        if (entry.isDirectory()) {
          stack.push(path)
          continue
        }
        if (entry.isFile() && entry.name.endsWith('.ctm')) {
          return path
        }
      }
    }

    l.warn(`No CTM files found in ${resultDir}`)
    return null
  } catch (error) {
    l.error(`Failed to find CTM file`, error)
    return null
  }
}
