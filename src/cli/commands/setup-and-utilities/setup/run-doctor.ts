import { inspectYtDlpAuthState } from '~/cli/commands/process-steps/step-1-download/audio/yt-dlp-options'
import { commandExists } from '~/utils/cli-utils'
import { loadEnvFile } from '~/utils/cli-utils'
import { resolveConfigPath, loadConfig } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { readAwsSttConfigDefaults, readAwsSttReadiness } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/aws/aws'
import { readGcloudSttReadiness } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gcloud/gcloud'
import * as l from '~/utils/logger'
import { createHumanTable } from '~/utils/logger/human-table'
import type { CheckResult } from '~/types'

const checkCommand = (label: string, command: string): CheckResult => {
  const found = commandExists(command)
  return {
    label,
    ok: found,
    detail: found ? Bun.which(command) as string : 'not found'
  }
}

const checkEnvVar = (label: string, envVar: string): CheckResult => {
  const value = process.env[envVar]
  const ok = typeof value === 'string' && value.length > 0
  return {
    label,
    ok,
    detail: ok ? 'set' : 'not set'
  }
}

export const runDoctor = async (): Promise<void> => {
  await loadEnvFile()

  const checks: CheckResult[] = []

  checks.push(checkCommand('yt-dlp', 'yt-dlp'))
  checks.push(checkCommand('ffmpeg', 'ffmpeg'))
  checks.push(checkCommand('ffprobe', 'ffprobe'))
  checks.push(checkCommand('tesseract', 'tesseract'))

  checks.push(checkEnvVar('OPENAI_API_KEY', 'OPENAI_API_KEY'))
  checks.push(checkEnvVar('XAI_API_KEY (Grok STT/TTS/image/video)', 'XAI_API_KEY'))
  checks.push(checkEnvVar('GEMINI_API_KEY', 'GEMINI_API_KEY'))
  checks.push(checkEnvVar('GLM_API_KEY (GLM write/STT/OCR/image/video)', 'GLM_API_KEY'))
  checks.push(checkEnvVar('RUNWAYML_API_SECRET', 'RUNWAYML_API_SECRET'))
  checks.push(checkEnvVar('BFL_API_KEY', 'BFL_API_KEY'))
  checks.push(checkEnvVar('ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY'))
  checks.push(checkEnvVar('GROQ_API_KEY', 'GROQ_API_KEY'))
  checks.push(checkEnvVar('DEEPINFRA_API_KEY', 'DEEPINFRA_API_KEY'))
  checks.push(checkEnvVar('DEAPI_API_KEY', 'DEAPI_API_KEY'))
  checks.push(checkEnvVar('MINIMAX_API_KEY', 'MINIMAX_API_KEY'))
  checks.push(checkEnvVar('ELEVENLABS_API_KEY', 'ELEVENLABS_API_KEY'))
  checks.push(checkEnvVar('ASSEMBLYAI_API_KEY', 'ASSEMBLYAI_API_KEY'))
  checks.push(checkEnvVar('GLADIA_API_KEY', 'GLADIA_API_KEY'))
  checks.push(checkEnvVar('DEEPGRAM_API_KEY', 'DEEPGRAM_API_KEY'))
  checks.push(checkEnvVar('SONIOX_API_KEY', 'SONIOX_API_KEY'))
  checks.push(checkEnvVar('SPEECHMATICS_API_KEY', 'SPEECHMATICS_API_KEY'))
  checks.push(checkEnvVar('REVAI_ACCESS_TOKEN', 'REVAI_ACCESS_TOKEN'))

  const configPath = await resolveConfigPath()
  const configFile = Bun.file(configPath)
  const configExists = await configFile.exists()
  checks.push({
    label: 'config file',
    ok: configExists,
    detail: configExists ? configPath : `${configPath} (not found)`
  })

  if (configExists) {
    try {
      await loadConfig(configPath)
      checks.push({ label: 'config valid', ok: true, detail: 'parseable JSON' })
    } catch {
      checks.push({ label: 'config valid', ok: false, detail: 'invalid JSON' })
    }
  }

  const bunVersion = Bun.version
  checks.push({ label: 'bun', ok: true, detail: `v${bunVersion}` })

  const awsDefaults = await readAwsSttConfigDefaults()
  const awsState = await readAwsSttReadiness({
    preferredRegion: awsDefaults.preferredRegion,
    preferredBucket: awsDefaults.preferredBucket,
    verifyTranscribe: true
  })
  checks.push({ label: 'aws', ok: awsState.hasCli, detail: awsState.details.cli })
  checks.push({ label: 'aws auth', ok: awsState.authConfigured, detail: awsState.details.auth })
  checks.push({ label: 'aws region', ok: awsState.region !== undefined, detail: awsState.region ?? awsState.details.region })
  checks.push({
    label: 'aws bucket',
    ok: awsState.bucketAccessible === true,
    detail: awsState.bucket ? `${awsState.bucket} (${awsState.details.bucket})` : awsState.details.bucket
  })
  checks.push({ label: 'aws transcribe', ok: awsState.transcribeAccessible === true, detail: awsState.details.transcribe })

  const gcloudState = await readGcloudSttReadiness()
  checks.push({ label: 'gcloud', ok: gcloudState.hasCli, detail: gcloudState.details.cli })
  checks.push({ label: 'gcloud auth', ok: gcloudState.authConfigured, detail: gcloudState.details.auth })
  checks.push({ label: 'gcloud project', ok: gcloudState.projectId !== undefined, detail: gcloudState.projectId ?? gcloudState.details.project })
  checks.push({ label: 'gcloud billing', ok: gcloudState.billingEnabled === true, detail: gcloudState.details.billing })
  checks.push({ label: 'speech.googleapis.com', ok: gcloudState.speechApiEnabled === true, detail: gcloudState.details.speechApi })
  checks.push({ label: 'documentai.googleapis.com', ok: gcloudState.documentAiApiEnabled === true, detail: gcloudState.details.documentAiApi })
  checks.push({ label: 'storage.googleapis.com', ok: gcloudState.storageApiEnabled === true, detail: gcloudState.details.storageApi })

  let hasFailure = false
  for (const check of checks) {
    if (!check.ok) {
      hasFailure = true
    }
  }
  l.write(hasFailure ? 'warn' : 'success', 'Environment checks', {
    category: 'command',
    humanTable: createHumanTable(
      checks.map((check) => ({
        status: check.ok ? 'OK' : 'MISSING',
        check: check.label,
        detail: check.detail
      })),
      ['status', 'check', 'detail']
    )
  })

  const youtubeStatus = await inspectYtDlpAuthState()
  const youtubeRows: Array<{ status: string, check: string, detail: string }> = [{
    status: 'INFO',
    check: 'mode',
    detail: youtubeStatus.configuredMode
  }]

  if (youtubeStatus.configuredMode === 'cookies-file') {
    const cookieDetail = youtubeStatus.resolvedCookiesPath ?? youtubeStatus.cookiesPath ?? 'not configured'
    if (youtubeStatus.cookiesReadable === true) {
      youtubeRows.push({
        status: 'OK',
        check: 'cookies file',
        detail: cookieDetail
      })
    } else {
      youtubeRows.push({
        status: 'MISSING',
        check: 'cookies file',
        detail: cookieDetail
      })
      hasFailure = true
    }
  } else if (youtubeStatus.configuredMode === 'cookies-from-browser') {
    youtubeRows.push({
      status: 'OK',
      check: 'cookies source',
      detail: 'browser import via YTDLP_COOKIES_FROM_BROWSER'
    })
  } else {
    youtubeRows.push({
      status: 'INFO',
      check: 'cookies source',
      detail: 'not configured'
    })
  }

  l.write(hasFailure ? 'warn' : 'info', 'YouTube cookies', {
    category: 'command',
    humanTable: createHumanTable(youtubeRows, ['status', 'check', 'detail'])
  })

  if (youtubeStatus.warning) {
    l.warn(youtubeStatus.warning)
    hasFailure = true
  }

  if (hasFailure) {
    l.write('info', 'Setup Next Steps', {
      category: 'command',
      humanTable: createHumanTable([
        { action: 'Install missing tools', command: 'bun as setup' },
        { action: 'Verify Google Cloud STT + Document AI OCR', command: 'bun as setup --gcloud' },
        { action: 'Configure YouTube cookies', command: 'docs/cookies.md' }
      ], ['action', 'command'])
    })
  }
}
