import { mkdir, rm } from 'node:fs/promises'
import { commandExists, pathExists, runCapture, runInherit, reverbConfigPath, reverbModelPath, reverbUvEnvDir, setupUv } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/logger'
import { createHumanTable } from '~/utils/logger/human-table'
import { downloadDiarizationModel, downloadReverbModel } from './reverb-download'
import { getHuggingFaceToken } from './reverb-huggingface'

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

const checkReverbModelExists = async (): Promise<boolean> => {
  return await pathExists(reverbModelPath) && await pathExists(reverbConfigPath)
}

export const detectGpuSupport = async (): Promise<boolean> => {
  const check = await runCapture('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader'], { allowFailure: true })
  if (check.exitCode !== 0) {
    return false
  }

  const gpuName = check.stdout.trim()
  if (gpuName) {
    l.write('info', `GPU detected: ${gpuName}`)
  }

  return true
}

export const setupReverbEnvironment = async (): Promise<void> => {
  l.write('info', 'Setting up Reverb ASR environment')

  if (!commandExists('uv')) {
    await setupUv()
  }

  await runCapture('uv', ['python', 'install', '3.11'], { allowFailure: true })

  await rm(reverbUvEnvDir, { recursive: true, force: true })

  const venv = await runInherit('uv', ['venv', '--python', '3.11', reverbUvEnvDir], { allowFailure: true })
  if (venv !== 0) {
    l.error('Failed to create venv')
    throw new Error('Failed to create Reverb virtual environment')
  }

  l.write('info', 'Installing Reverb ASR dependencies')
  const baseDeps = [
    'torch>=2.0.0',
    'torchaudio>=2.0.0',
    'numpy<2',
    'omegaconf',
    'sentencepiece',
    'soundfile',
    'librosa',
    'scipy',
    'pypinyin',
    'matplotlib'
  ]

  await runInherit('uv', ['pip', 'install', '-p', `${reverbUvEnvDir}/bin/python`, ...baseDeps], { allowFailure: true })

  l.write('info', 'Installing pyannote.audio for diarization')
  const pyannoteDeps = [
    'pyannote.audio>=3.1.0',
    'pyannote.core>=5.0.0',
    'pyannote.database>=5.0.0',
    'pyannote.metrics>=3.2.0',
    'pyannote.pipeline>=3.0.0',
    'speechbrain>=0.5.14',
    'asteroid-filterbanks>=0.4.0',
    'pytorch-lightning>=1.5.0',
    'rich>=10.0.0',
    'huggingface_hub'
  ]

  const pyannoteInstall = await runInherit('uv', ['pip', 'install', '-p', `${reverbUvEnvDir}/bin/python`, ...pyannoteDeps], { allowFailure: true })
  if (pyannoteInstall !== 0) {
    l.warn('Pyannote installation had issues, trying alternate approach')
    await runInherit('uv', ['pip', 'install', '-p', `${reverbUvEnvDir}/bin/python`, '--no-deps', 'pyannote.audio>=3.1.0'])
    await runInherit('uv', ['pip', 'install', '-p', `${reverbUvEnvDir}/bin/python`, 'pyannote.core>=5.0.0', 'pyannote.pipeline>=3.0.0'])
  }

  l.write('info', 'Installing Reverb package')
  const tempDir = `/tmp/reverb-install-${Date.now()}`

  await mkdir(tempDir, { recursive: true })

  const cloneCode = await runInherit('git', ['clone', 'https://github.com/revdotcom/reverb.git', tempDir], { allowFailure: true })
  if (cloneCode !== 0) {
    l.error('Failed to clone Reverb repository')
    await rm(tempDir, { recursive: true, force: true })
    throw new Error('Failed to clone Reverb repository')
  }

  const installCode = await runInherit('uv', ['pip', 'install', '-p', `${reverbUvEnvDir}/bin/python`, tempDir], { allowFailure: true })
  await rm(tempDir, { recursive: true, force: true })

  if (installCode !== 0) {
    l.error('Failed to install Reverb package')
    throw new Error('Failed to install Reverb package')
  }

  l.write('success', 'Reverb ASR environment ready')
}

export const setupReverb = async (): Promise<void> => {
  l.write('info', 'Setting up Reverb ASR with diarization')

  const token = getHuggingFaceToken()
  if (!token) {
    if ((process.env['AUTOSHOW_COMPACT_SETUP'] || '0') === '1') {
      l.warn('No HuggingFace token found; set HUGGINGFACE_TOKEN and rerun setup')
    } else {
      l.warn('No HuggingFace token found')
      l.warn('Reverb ASR requires a HuggingFace account')
      l.write('warn', 'Reverb Setup Next Steps', {
        category: 'command',
        humanTable: createHumanTable([
          { step: 1, command: 'Get a token from https://huggingface.co/settings/tokens' },
          { step: 2, command: 'hf auth login' },
          { step: 3, command: 'bun setup' }
        ], ['step', 'command'])
      })
    }

    throw new Error('Missing Hugging Face token for Reverb setup')
  }

  l.write('success', 'Hugging Face token detected')

  if (await envExistsAndValid()) {
  } else {
    await setupReverbEnvironment()
  }

  if (!await checkReverbModelExists()) {
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
        { status: 'complete', command: 'bun as "URL" --reverb' },
        { status: 'complete', command: 'bun as "URL" --reverb --reverb-verbatimicity 0.5' }
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
