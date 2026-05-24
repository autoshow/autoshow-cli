import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathExists, runUvInherit, reverbUvEnvDir, setupUv } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/logger'
import { createHumanTable } from '~/utils/logger/human-table'
import { checkReverbModelExists, downloadDiarizationModel, downloadReverbModel } from './reverb-download'
import { getHuggingFaceToken } from './reverb-huggingface'
import { downloadGithubCommitArchive } from '~/cli/commands/setup-and-utilities/setup/setup-download/github-archives'
import { readDependencyRef } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import { withRetry } from '~/utils/retries'

const envExistsAndValid = async (): Promise<boolean> => {
  if (!await pathExists(reverbUvEnvDir)) {
    return false
  }

  if (!await pathExists(`${reverbUvEnvDir}/bin/python`)) {
    return false
  }

  const required = [
    `${reverbUvEnvDir}/lib/python3.11/site-packages/wenet`,
    `${reverbUvEnvDir}/lib/python3.11/site-packages/pyannote`,
    `${reverbUvEnvDir}/lib/python3.11/site-packages/torch`
  ]

  for (const path of required) {
    if (!await pathExists(path)) {
      return false
    }
  }

  return true
}

const logReverbTokenNextSteps = (): void => {
  l.warn('No HUGGINGFACE_TOKEN found')
  l.warn('Reverb model downloads require a Hugging Face account')
  l.write('warn', 'Reverb Setup Next Steps', {
    category: 'command',
    humanTable: createHumanTable([
      { step: 1, command: 'Get a token from https://huggingface.co/settings/tokens' },
      { step: 2, command: 'export HUGGINGFACE_TOKEN=...' },
      { step: 3, command: 'bun as setup --step reverb' }
    ], ['step', 'command'])
  })
}

const reverbPythonPath = (): string => `${reverbUvEnvDir}/bin/python`

const formatInstallError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const runReverbSetupPhase = async (
  phase: string,
  args: string[]
): Promise<void> => {
  try {
    await runUvInherit(args)
  } catch (error) {
    throw new Error(`Reverb setup failed during ${phase}: ${formatInstallError(error)}`)
  }
}

export const setupReverbEnvironment = async (): Promise<void> => {
  l.write('info', 'Setting up Reverb ASR environment')

  await setupUv()

  await runReverbSetupPhase('Python 3.11 install', ['python', 'install', '3.11'])

  await rm(reverbUvEnvDir, { recursive: true, force: true })

  await runReverbSetupPhase('virtual environment creation', ['venv', '--python', '3.11', reverbUvEnvDir])

  l.write('info', 'Installing Reverb ASR dependencies')
  const reverbDeps = [
    'numpy<2',
    'torch>=2.0.0',
    'torchaudio>=2.0.0',
    'omegaconf',
    'sentencepiece',
    'soundfile',
    'librosa',
    'scipy',
    'pypinyin',
    'matplotlib',
    'pyannote.audio<4',
    'huggingface_hub'
  ]

  await runReverbSetupPhase('Python dependency install', ['pip', 'install', '-p', reverbPythonPath(), ...reverbDeps])

  l.write('info', 'Installing Reverb package')
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-reverb-source-'))
  const reverbRef = await readDependencyRef('reverb') ?? '8cd4099828d68e464a9536ccb6a380ddad07c982'

  try {
    await withRetry(
      { retryClass: 'setup_download', operationName: 'reverb-source' },
      async () => {
        await downloadGithubCommitArchive({
          owner: 'revdotcom',
          repo: 'reverb',
          ref: reverbRef,
          destination: tempDir,
          stripComponents: 1,
          flowId: 'reverb-source'
        })
      }
    )

    await runReverbSetupPhase('Reverb package install', ['pip', 'install', '-p', reverbPythonPath(), tempDir])
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }

  l.write('success', 'Reverb ASR environment ready')
}

export const setupReverb = async (): Promise<void> => {
  l.write('info', 'Setting up Reverb ASR with diarization')

  const token = getHuggingFaceToken()
  if (token) l.write('success', 'Hugging Face token detected')

  if (await envExistsAndValid()) {
  } else {
    await setupReverbEnvironment()
  }

  if (!await checkReverbModelExists()) {
    if (!token) {
      if ((process.env['AUTOSHOW_COMPACT_SETUP'] || '0') === '1') {
        l.warn('No HUGGINGFACE_TOKEN found; set it and rerun setup to download Reverb model assets')
      } else {
        logReverbTokenNextSteps()
      }
      throw new Error('Missing Hugging Face token for Reverb model download')
    }

    try {
      await downloadReverbModel()
    } catch {
      l.error('Failed to download Reverb model')
      throw new Error('Failed to download Reverb model')
    }
  } else {
  }

  const diarizationOk = await downloadDiarizationModel()
  if (!diarizationOk) {
    l.warn('Failed to download diarization model v2')
  }

  if ((process.env['AUTOSHOW_COMPACT_SETUP'] || '0') === '1') {
    l.write('success', 'Reverb ASR setup complete with diarization')
  } else {
    l.write('success', 'Reverb ASR Setup', {
      category: 'command',
      humanTable: createHumanTable([
        { status: 'complete', command: 'bun as extract "URL" --reverb' },
        { status: 'complete', command: 'bun as extract "URL" --reverb --stt-reverb-verbatimicity 0.5' }
      ], ['status', 'command'])
    })
  }
}

export const ensureReverbRuntimeSetup = async (): Promise<void> => {
  if (!await envExistsAndValid()) {
    await setupReverbEnvironment()
  }

  if (!await checkReverbModelExists()) {
    try {
      await downloadReverbModel()
    } catch {
      const token = getHuggingFaceToken()
      if (!token) {
        l.error('Reverb model requires HuggingFace access')
        l.write('info', 'Please set the HUGGINGFACE_TOKEN environment variable')
      }
      throw new Error('Failed to ensure Reverb model setup')
    }
  }
}
