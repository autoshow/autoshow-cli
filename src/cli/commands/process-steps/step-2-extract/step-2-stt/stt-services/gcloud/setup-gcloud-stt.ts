import * as l from '~/utils/logger'
import { createHumanTable } from '~/utils/logger/human-table'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { writeConfig } from '~/cli/commands/setup-and-utilities/config/config-writer'
import type { AutoshowConfig, GcloudSttReadiness } from '~/types'
import {
  GCLOUD_DOCAI_DEFAULT_LOCATION,
  GCLOUD_DOCAI_DEFAULT_MODEL,
  GCLOUD_REQUIRED_APIS,
  GCLOUD_STT_DEFAULT_MODEL
} from './gcloud-constants'
import {
  createProject,
  enableServiceApi,
  linkBillingAccount,
  listOpenBillingAccounts,
  normalizeBillingAccountId,
  normalizeString,
  readAccessToken,
  readProjectMetadata,
  setProjectId,
  verifyServiceApiEnabled
} from './gcloud-cli'
import {
  ensureDocumentAiLayoutProcessor,
  ensureDocumentAiOcrProcessor,
  ensureGcloudDocaiBucket,
  readSavedGcloudDocaiDefaults
} from './gcloud-docai-setup'
import { readGcloudSttReadiness } from './gcloud-readiness'

const GCLOUD_TTS_DEFAULT_MODEL = 'standard'

const buildSetupGcloudCommand = (
  options: {
    projectId?: string | undefined
    billingAccountId?: string | undefined
    configPathOverride?: string | undefined
  } = {}
): string => {
  const args = ['bun as setup', '--gcloud']
  if (options.projectId) {
    args.push('--gcloud-project', options.projectId)
  }
  if (options.billingAccountId) {
    args.push('--gcloud-billing-account', options.billingAccountId)
  }
  if (options.configPathOverride) {
    args.push('--config-path', options.configPathOverride)
  }
  return args.join(' ')
}

const buildSetupCommands = (
  state: GcloudSttReadiness,
  options: {
    explicitProject?: string | undefined
    explicitBillingAccount?: string | undefined
    configPathOverride?: string | undefined
  } = {}
): string[] => {
  const commands: string[] = []

  if (!state.hasCli) {
    commands.push('Install the Google Cloud CLI: https://cloud.google.com/sdk/docs/install')
    return commands
  }

  if (!state.authConfigured) {
    commands.push('gcloud init')
    commands.push('gcloud auth login')
  }
  if (!state.projectId) {
    if (options.explicitProject) {
      commands.push(buildSetupGcloudCommand({
        projectId: options.explicitProject,
        ...(options.configPathOverride ? { configPathOverride: options.configPathOverride } : {})
      }))
    } else {
      commands.push('gcloud projects list')
      commands.push('gcloud projects create PROJECT_ID --set-as-default')
      commands.push(buildSetupGcloudCommand({
        projectId: 'PROJECT_ID',
        ...(options.configPathOverride ? { configPathOverride: options.configPathOverride } : {})
      }))
    }
  }
  if (state.authConfigured && state.projectId && state.billingEnabled !== true) {
    commands.push('gcloud billing accounts list --filter=open=true')
    commands.push(options.explicitProject
      ? buildSetupGcloudCommand({
          projectId: state.projectId,
          billingAccountId: options.explicitBillingAccount ?? 'ACCOUNT_ID',
          ...(options.configPathOverride ? { configPathOverride: options.configPathOverride } : {})
        })
      : `gcloud billing projects link ${state.projectId} --billing-account ACCOUNT_ID`)
  }
  if (state.authConfigured && state.projectId && state.billingEnabled === true && state.speechApiEnabled !== true) {
    commands.push(`gcloud services enable speech.googleapis.com --project ${state.projectId}`)
  }
  if (state.authConfigured && state.projectId && state.billingEnabled === true && state.textToSpeechApiEnabled !== true) {
    commands.push(`gcloud services enable texttospeech.googleapis.com --project ${state.projectId}`)
  }
  if (state.authConfigured && state.projectId && state.billingEnabled === true && state.documentAiApiEnabled !== true) {
    commands.push(`gcloud services enable documentai.googleapis.com --project ${state.projectId}`)
  }
  if (state.authConfigured && state.projectId && state.billingEnabled === true && state.storageApiEnabled !== true) {
    commands.push(`gcloud services enable storage.googleapis.com --project ${state.projectId}`)
  }

  return commands
}

const resolvePreferredBillingAccount = async (
  state: GcloudSttReadiness,
  explicitBillingAccount: string | undefined
): Promise<string | undefined> => {
  if (explicitBillingAccount) {
    return explicitBillingAccount
  }
  if (state.billingAccountId) {
    return state.billingAccountId
  }

  const billingAccounts = await listOpenBillingAccounts()
  if (!billingAccounts.ok || billingAccounts.accountIds.length !== 1) {
    return undefined
  }
  return billingAccounts.accountIds[0]
}

const nonEmptyArray = (value: string[] | undefined): boolean =>
  Array.isArray(value) && value.length > 0

const persistGcloudSetupDefaults = async (
  options: {
    configPath: string
    location: string
    ocrProcessorId: string
    layoutProcessorId: string
    bucket: string
  }
): Promise<string> => {
  const current = await loadConfig(options.configPath)
  const currentStt = current.defaults?.extract?.stt
  const currentOcr = current.defaults?.extract?.ocr
  const currentTts = current.defaults?.post?.tts
  const next: AutoshowConfig = {
    ...current,
    defaults: {
      ...current.defaults,
      extract: {
        ...current.defaults?.extract,
        stt: {
          ...currentStt,
          gcloudStt: nonEmptyArray(currentStt?.gcloudStt)
            ? currentStt?.gcloudStt
            : [GCLOUD_STT_DEFAULT_MODEL]
        },
        ocr: {
          ...currentOcr,
          gcloudDocai: nonEmptyArray(currentOcr?.gcloudDocai)
            ? currentOcr?.gcloudDocai
            : [GCLOUD_DOCAI_DEFAULT_MODEL],
          gcloudDocaiLocation: options.location,
          gcloudDocaiOcrProcessorId: options.ocrProcessorId,
          gcloudDocaiLayoutProcessorId: options.layoutProcessorId,
          gcloudDocaiBucket: options.bucket
        }
      },
      post: {
        ...current.defaults?.post,
        tts: {
          ...currentTts,
          gcloudTts: nonEmptyArray(currentTts?.gcloudTts)
            ? currentTts?.gcloudTts
            : [GCLOUD_TTS_DEFAULT_MODEL]
        }
      }
    }
  }
  await writeConfig(options.configPath, next as unknown as Record<string, unknown>)
  return options.configPath
}

export const setupGcloudStt = async (
  options: {
    focused?: boolean | undefined
    preferredProject?: string | undefined
    preferredBillingAccount?: string | undefined
    projectName?: string | undefined
    organizationId?: string | undefined
    folderId?: string | undefined
    configPathOverride?: string | undefined
  } = {}
): Promise<void> => {
  const explicitProject = normalizeString(options.preferredProject)
  const explicitBillingAccount = normalizeBillingAccountId(options.preferredBillingAccount)
  const projectName = normalizeString(options.projectName)
  const organizationId = normalizeString(options.organizationId)
  const folderId = normalizeString(options.folderId)
  let docaiProcessorDetail: string | undefined
  let docaiOcrProcessorId: string | undefined
  let docaiLayoutProcessorDetail: string | undefined
  let docaiLayoutProcessorId: string | undefined
  let gcsBucketDetail: string | undefined
  let gcsBucketName: string | undefined
  let gcsBucketOk = false
  let savedConfigPath: string | undefined
  let docaiLocation = GCLOUD_DOCAI_DEFAULT_LOCATION
  let state = await readGcloudSttReadiness()

  if (explicitProject && state.hasCli) {
    if (state.authConfigured) {
      const projectLookup = await readProjectMetadata(explicitProject)
      if (!projectLookup.exists) {
        if (projectLookup.permissionDenied) {
          throw new Error(`Failed to access gcloud project "${explicitProject}": ${projectLookup.detail}`)
        }
        if (!projectLookup.missing) {
          throw new Error(`Failed to inspect gcloud project "${explicitProject}": ${projectLookup.detail}`)
        }
        await createProject({
          projectId: explicitProject,
          projectName: projectName ?? explicitProject,
          organizationId,
          folderId
        })
      }
    }

    if (state.projectId !== explicitProject) {
      await setProjectId(explicitProject)
    }
    state = await readGcloudSttReadiness()

    if (state.authConfigured && state.projectId) {
      const preferredBillingAccount = await resolvePreferredBillingAccount(state, explicitBillingAccount)
      if (preferredBillingAccount && (state.billingEnabled !== true || state.billingAccountId !== preferredBillingAccount)) {
        await linkBillingAccount(state.projectId, preferredBillingAccount)
        state = await readGcloudSttReadiness()
      }
      const readyProjectId = state.projectId
      if (readyProjectId && state.billingEnabled === true) {
        for (const serviceName of GCLOUD_REQUIRED_APIS) {
          const enabled = serviceName === 'speech.googleapis.com'
            ? state.speechApiEnabled
            : serviceName === 'texttospeech.googleapis.com'
              ? state.textToSpeechApiEnabled
            : serviceName === 'documentai.googleapis.com'
              ? state.documentAiApiEnabled
              : state.storageApiEnabled
          if (enabled !== true) {
            await enableServiceApi(readyProjectId, serviceName)
            for (let attempt = 0; attempt < 5; attempt++) {
              const check = await verifyServiceApiEnabled(readyProjectId, serviceName)
              if (check.ok) break
              if (attempt < 4) {
                l.write('info', `Waiting for ${serviceName} to propagate...`)
                await Bun.sleep(3000)
              }
            }
            state = await readGcloudSttReadiness()
          }
        }
      }
    }
  }

  if (
    state.authConfigured
    && state.projectId
    && state.billingEnabled === true
    && state.documentAiApiEnabled === true
    && state.storageApiEnabled === true
  ) {
    const savedDocai = await readSavedGcloudDocaiDefaults(options.configPathOverride)
    docaiLocation = savedDocai.location ?? GCLOUD_DOCAI_DEFAULT_LOCATION
    const tokenState = await readAccessToken()
    if (!tokenState.ok || !tokenState.accessToken) {
      throw new Error(`gcloud auth failed while configuring Document AI: ${tokenState.detail}`)
    }
    const processor = await ensureDocumentAiOcrProcessor(
      state.projectId,
      docaiLocation,
      tokenState.accessToken,
      savedDocai.ocrProcessorId
    )
    docaiProcessorDetail = processor.detail
    docaiOcrProcessorId = processor.processorId
    const layoutProcessor = await ensureDocumentAiLayoutProcessor(
      state.projectId,
      docaiLocation,
      tokenState.accessToken,
      savedDocai.layoutProcessorId
    )
    docaiLayoutProcessorDetail = layoutProcessor.detail
    docaiLayoutProcessorId = layoutProcessor.processorId
    const bucket = await ensureGcloudDocaiBucket(
      state.projectId,
      docaiLocation,
      savedDocai.bucket
    )
    gcsBucketDetail = bucket.bucket ? `${bucket.bucket} (${bucket.detail})` : bucket.detail
    gcsBucketName = bucket.bucket
    gcsBucketOk = bucket.ok

    if (docaiOcrProcessorId && docaiLayoutProcessorId && gcsBucketName && gcsBucketOk) {
      savedConfigPath = await persistGcloudSetupDefaults({
        configPath: savedDocai.configPath,
        location: docaiLocation,
        ocrProcessorId: docaiOcrProcessorId,
        layoutProcessorId: docaiLayoutProcessorId,
        bucket: gcsBucketName
      })
    }
  }

  if (options.focused) {
    l.write('info', 'Google Cloud STT + Document AI OCR + TTS setup')
  }

  const checkRows = [
    { status: state.hasCli ? 'OK' : 'MISSING', check: 'gcloud', detail: state.details.cli },
    { status: state.authConfigured ? 'OK' : 'MISSING', check: 'gcloud auth', detail: state.details.auth },
    { status: state.projectId !== undefined ? 'OK' : 'MISSING', check: 'gcloud project', detail: state.details.project },
    ...(state.authConfigured && state.projectId
      ? [
          { status: state.billingEnabled === true ? 'OK' : 'MISSING', check: 'gcloud billing', detail: state.details.billing },
          { status: state.speechApiEnabled === true ? 'OK' : 'MISSING', check: 'speech.googleapis.com', detail: state.details.speechApi },
          { status: state.textToSpeechApiEnabled === true ? 'OK' : 'MISSING', check: 'texttospeech.googleapis.com', detail: state.details.textToSpeechApi },
          { status: state.documentAiApiEnabled === true ? 'OK' : 'MISSING', check: 'documentai.googleapis.com', detail: state.details.documentAiApi },
          { status: state.storageApiEnabled === true ? 'OK' : 'MISSING', check: 'storage.googleapis.com', detail: state.details.storageApi },
          ...(docaiProcessorDetail ? [{ status: 'OK', check: 'Document AI OCR processor', detail: docaiProcessorDetail }] : []),
          ...(docaiLayoutProcessorDetail ? [{ status: 'OK', check: 'Document AI Layout Parser processor', detail: docaiLayoutProcessorDetail }] : []),
          ...(gcsBucketDetail ? [{ status: gcsBucketOk ? 'OK' : 'MISSING', check: 'GCS Document AI bucket', detail: gcsBucketDetail }] : [])
        ]
      : [])
  ]

  l.write(checkRows.some((row) => row.status === 'MISSING') ? 'warn' : 'success', 'Google Cloud STT + Document AI OCR + TTS checks', {
    category: 'command',
    humanTable: createHumanTable(checkRows, ['status', 'check', 'detail'])
  })

  if (options.focused) {
    l.write('info', 'Google Cloud STT + Document AI OCR Runtime Values', {
      category: 'command',
      humanTable: createHumanTable([
        { setting: 'project', value: state.projectId ?? 'not configured' },
        { setting: 'stt model', value: GCLOUD_STT_DEFAULT_MODEL },
        { setting: 'stt location', value: 'us' },
        { setting: 'tts transport', value: 'direct REST SynthesizeSpeech requests via texttospeech.googleapis.com' },
        { setting: 'ocr model', value: GCLOUD_DOCAI_DEFAULT_MODEL },
        { setting: 'ocr location', value: docaiLocation },
        { setting: 'ocr processor', value: docaiOcrProcessorId ?? 'not configured' },
        { setting: 'layout parser', value: docaiLayoutProcessorId ?? 'not configured' },
        { setting: 'gcs bucket', value: gcsBucketName ?? 'not configured' },
        { setting: 'stt transport', value: 'direct REST Recognize requests via us-speech.googleapis.com' },
        { setting: 'ocr transport', value: 'Document AI sync and batch APIs with GCS staging for multi-page or large files' },
        { setting: 'config', value: savedConfigPath ? `saved ${savedConfigPath}` : 'not saved' }
      ], ['setting', 'value'])
    })

    const envCommands = [
      ...(state.projectId ? [`export AUTOSHOW_GCLOUD_PROJECT=${state.projectId}`] : []),
      `export AUTOSHOW_GCLOUD_DOCAI_LOCATION=${docaiLocation}`,
      ...(docaiOcrProcessorId ? [`export AUTOSHOW_GCLOUD_DOCAI_OCR_PROCESSOR_ID=${docaiOcrProcessorId}`] : []),
      ...(docaiLayoutProcessorId ? [`export AUTOSHOW_GCLOUD_DOCAI_LAYOUT_PROCESSOR_ID=${docaiLayoutProcessorId}`] : []),
      ...(gcsBucketName ? [`export AUTOSHOW_GCLOUD_BUCKET=${gcsBucketName}`] : [])
    ]
    if (envCommands.length > 0) {
      l.write('info', 'Google Cloud STT + Document AI OCR Environment Values', {
        category: 'command',
        humanTable: createHumanTable(
          envCommands.map((command, index) => ({ step: index + 1, command })),
          ['step', 'command']
        )
      })
    }

    const commands = buildSetupCommands(state, {
      explicitProject,
      explicitBillingAccount,
      configPathOverride: explicitProject ? options.configPathOverride : undefined
    })
    if (commands.length > 0) {
      l.write('info', 'Google Cloud STT + Document AI OCR Next Steps', {
        category: 'command',
        humanTable: createHumanTable(
          commands.map((command, index) => ({ step: index + 1, command })),
          ['step', 'command']
        )
      })
    }
  }
}
