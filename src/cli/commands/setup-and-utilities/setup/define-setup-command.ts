import { defineCommand } from 'clerc'
import { setupFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { runCompleteSetup, runSetupStep } from './run-complete-setup'
import { runDoctor } from './run-doctor'
import { readAwsSttConfigDefaults, setupAwsStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/aws/aws'
import { setupGcloudStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gcloud/gcloud'
import { runSampleFixtures } from '~/cli/commands/setup-and-utilities/sample/run-sample-fixtures'
import { runModelDownloads } from '~/cli/commands/setup-and-utilities/models/run-model-downloads'
import * as l from '~/utils/logger'
import { runWithLogContext } from '~/utils/logger'
import type { SetupStepId } from '~/types'

const VALID_SETUP_STEPS: SetupStepId[] = ['uv', 'yt-dlp', 'whisper-binary', 'whisper-model', 'llama-binary', 'reverb', 'calibre', 'all', 'transcription', 'write', 'tts', 'image', 'video', 'music', 'sample']
const SAMPLE_ONLY_FLAGS = ['--out', '--refresh', '--verify-only', '--valid-only'] as const
const FOCUSED_SETUP_CONFLICT_FLAGS = [
  '--sample',
  '--models',
  '--gcloud',
  '--gcloud-project',
  '--gcloud-billing-account',
  '--gcloud-project-name',
  '--gcloud-organization',
  '--gcloud-folder',
  '--aws',
  '--aws-create-bucket',
  '--aws-region',
  '--aws-bucket',
  '--doctor',
  '--step',
  '--force-redownload',
  '--repeat'
] as const

const hasLongFlag = (argv: string[], flag: string): boolean =>
  argv.some((token) => token === flag || token.startsWith(`${flag}=`))

const getUsedLongFlags = (argv: string[], flags: readonly string[]): string[] =>
  flags.filter((flag) => hasLongFlag(argv, flag))

const normalizeStringArrayFlag = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? [trimmed] : []
  }
  return []
}

export const setupCommand = defineCommand({
  name: 'setup',
  description: 'Install local dependencies and required tools',
  flags: setupFlags,
  help: {
    examples: [
      ['bun as setup', 'Install all dependencies'],
      ['bun as setup --gcloud', 'Check gcloud CLI auth/config for Google Cloud Speech-to-Text, Text-to-Speech, and Document AI OCR'],
      ['bun as setup --gcloud --gcloud-project my-project', 'Set or create the Google Cloud project, link billing when possible, enable Speech-to-Text, Text-to-Speech, Document AI, and Storage, then print runtime values'],
      ['bun as setup --gcloud --gcloud-project my-project --gcloud-billing-account 000000-000000-000000', 'Bootstrap a Google Cloud project with an explicit billing account'],
      ['bun as setup --aws', 'Check AWS CLI auth/config for Amazon Transcribe and Textract staging'],
      ['bun as setup --aws --aws-create-bucket', 'Create a shared S3 staging bucket for Amazon Transcribe and Textract'],
      ['bun as setup --gcloud --aws', 'Check and save both Google Cloud and AWS setup values'],
      ['bun as setup --sample --verify-only', 'Validate deterministic sample fixtures without regenerating'],
      ['bun as setup --models base --models ggml-org/gemma-3-270m-it-GGUF', 'Download Whisper and llama.cpp models without running inference'],
      ['bun as setup --doctor', 'Check prerequisites without installing'],
      ['bun as setup --step whisper-binary --force-redownload', 'Reinstall whisper binary']
    ]
  }
}, async (ctx) => {
  const rawArgv = Bun.argv.slice(2)
  const gcloudProject = typeof ctx.flags['gcloud-project'] === 'string' ? ctx.flags['gcloud-project'] : undefined
  const gcloudBillingAccount = typeof ctx.flags['gcloud-billing-account'] === 'string' ? ctx.flags['gcloud-billing-account'] : undefined
  const gcloudProjectName = typeof ctx.flags['gcloud-project-name'] === 'string' ? ctx.flags['gcloud-project-name'] : undefined
  const gcloudOrganization = typeof ctx.flags['gcloud-organization'] === 'string' ? ctx.flags['gcloud-organization'] : undefined
  const gcloudFolder = typeof ctx.flags['gcloud-folder'] === 'string' ? ctx.flags['gcloud-folder'] : undefined
  const sampleMode = ctx.flags.sample === true
  const usedModelsFlag = hasLongFlag(rawArgv, '--models')
  const modelTargets = normalizeStringArrayFlag(ctx.flags.models)
  const usedSampleOnlyFlags = getUsedLongFlags(rawArgv, SAMPLE_ONLY_FLAGS)
  const configPathOverride = typeof ctx.flags['config-path'] === 'string' ? ctx.flags['config-path'] : undefined

  const gcloudSpecificFlags: string[] = []
  if (gcloudProject) {
    gcloudSpecificFlags.push('--gcloud-project')
  }
  if (gcloudBillingAccount) {
    gcloudSpecificFlags.push('--gcloud-billing-account')
  }
  if (gcloudProjectName) {
    gcloudSpecificFlags.push('--gcloud-project-name')
  }
  if (gcloudOrganization) {
    gcloudSpecificFlags.push('--gcloud-organization')
  }
  if (gcloudFolder) {
    gcloudSpecificFlags.push('--gcloud-folder')
  }
  if (!ctx.flags.gcloud && gcloudSpecificFlags.length > 0) {
    throw CLIUsageError(`${gcloudSpecificFlags.join(', ')} require --gcloud`)
  }
  const gcloudProjectScopedFlags: string[] = []
  if (gcloudBillingAccount) {
    gcloudProjectScopedFlags.push('--gcloud-billing-account')
  }
  if (gcloudProjectName) {
    gcloudProjectScopedFlags.push('--gcloud-project-name')
  }
  if (gcloudOrganization) {
    gcloudProjectScopedFlags.push('--gcloud-organization')
  }
  if (gcloudFolder) {
    gcloudProjectScopedFlags.push('--gcloud-folder')
  }
  if (!gcloudProject && gcloudProjectScopedFlags.length > 0) {
    throw CLIUsageError(`${gcloudProjectScopedFlags.join(', ')} require --gcloud-project`)
  }
  if (gcloudOrganization && gcloudFolder) {
    throw CLIUsageError('--gcloud-organization cannot be combined with --gcloud-folder')
  }

  const awsSpecificFlags: string[] = []
  if (ctx.flags['aws-create-bucket']) {
    awsSpecificFlags.push('--aws-create-bucket')
  }
  if (typeof ctx.flags['aws-region'] === 'string') {
    awsSpecificFlags.push('--aws-region')
  }
  if (typeof ctx.flags['aws-bucket'] === 'string') {
    awsSpecificFlags.push('--aws-bucket')
  }
  if (!ctx.flags.aws && awsSpecificFlags.length > 0) {
    throw CLIUsageError(`${awsSpecificFlags.join(', ')} require --aws`)
  }
  if (!sampleMode && usedSampleOnlyFlags.length > 0) {
    throw CLIUsageError(`${usedSampleOnlyFlags.join(', ')} require --sample`)
  }
  if (usedModelsFlag && modelTargets.length === 0) {
    throw CLIUsageError('--models requires at least one value')
  }
  if (sampleMode || usedModelsFlag) {
    const modeFlag = sampleMode ? '--sample' : '--models'
    const conflicts = getUsedLongFlags(
      rawArgv,
      FOCUSED_SETUP_CONFLICT_FLAGS.filter((flag) => flag !== modeFlag)
    )
    if (conflicts.length > 0) {
      throw CLIUsageError(`${modeFlag} cannot be combined with ${conflicts.join(', ')}`)
    }
  }

  if (ctx.flags.gcloud || ctx.flags.aws) {
    const conflicts: string[] = []
    if (ctx.flags.doctor) {
      conflicts.push('--doctor')
    }
    if ((ctx.flags.step as string) !== 'all') {
      conflicts.push('--step')
    }
    if (ctx.flags['force-redownload']) {
      conflicts.push('--force-redownload')
    }
    if ((ctx.flags.repeat as string) !== '1') {
      conflicts.push('--repeat')
    }
    if (conflicts.length > 0) {
      throw CLIUsageError(`focused setup cannot be combined with ${conflicts.join(', ')}`)
    }

    await runWithLogContext({ step: 'setup' }, async () => {
      if (ctx.flags.gcloud) {
        await setupGcloudStt({
          focused: true,
          preferredProject: gcloudProject,
          preferredBillingAccount: gcloudBillingAccount,
          projectName: gcloudProjectName,
          organizationId: gcloudOrganization,
          folderId: gcloudFolder,
          configPathOverride
        })
      }

      if (ctx.flags.aws) {
        const awsDefaults = await readAwsSttConfigDefaults(configPathOverride)
        const preferredRegion = typeof ctx.flags['aws-region'] === 'string'
          ? ctx.flags['aws-region']
          : awsDefaults.preferredRegion
        const preferredBucket = typeof ctx.flags['aws-bucket'] === 'string'
          ? ctx.flags['aws-bucket']
          : awsDefaults.preferredBucket
        await setupAwsStt({
          preferredRegion,
          preferredBucket,
          autoCreateBucket: ctx.flags['aws-create-bucket'] === true,
          focused: true,
          verifyTranscribe: true,
          configPathOverride
        })
      }
    })
    return
  }

  if (sampleMode) {
    await runWithLogContext({ step: 'setup' }, async () => {
      await runSampleFixtures({
        out: ctx.flags.out as string,
        refresh: ctx.flags.refresh as boolean,
        verifyOnly: ctx.flags['verify-only'] as boolean,
        validOnly: ctx.flags['valid-only'] as boolean
      })
    })
    return
  }

  if (usedModelsFlag) {
    await runWithLogContext({ step: 'setup' }, async () => {
      await runModelDownloads(modelTargets)
    })
    return
  }

  if (ctx.flags.doctor) {
    await runDoctor()
    return
  }

  const step = ctx.flags.step as string
  if (!VALID_SETUP_STEPS.includes(step as SetupStepId)) {
    throw CLIUsageError(`Invalid --step value: ${step}. Valid values: ${VALID_SETUP_STEPS.join(', ')}`)
  }

  const repeatRaw = parseInt(ctx.flags.repeat as string, 10)
  if (!Number.isFinite(repeatRaw) || repeatRaw < 1) {
    throw CLIUsageError(`Invalid --repeat value: ${ctx.flags.repeat}. Must be an integer >= 1`)
  }

  await runWithLogContext({ step: 'setup' }, async () => {
    if (step === 'all' && !ctx.flags['force-redownload'] && repeatRaw === 1) {
      await runCompleteSetup()
    } else {
      await runSetupStep(step as SetupStepId, {
        ...(ctx.flags['force-redownload'] ? { forceRedownload: true } : {}),
        ...(repeatRaw > 1 ? { repeat: repeatRaw } : {})
      })
    }
  })

  l.write('success', 'Setup complete')
})
