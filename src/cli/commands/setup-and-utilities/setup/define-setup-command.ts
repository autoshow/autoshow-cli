import { defineCommand } from 'clerc'
import { setupFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { runCompleteSetup, runSetupStep, type SetupStepId } from './setup-orchestrator/run-complete-setup'
import { runDoctor } from './run-doctor'
import { readAwsSttConfigDefaults, setupAwsStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/aws/aws'
import { setupGcloudStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/gcloud/gcloud'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'

const VALID_SETUP_STEPS: SetupStepId[] = ['uv', 'yt-dlp', 'whisper-binary', 'whisper-model', 'llama-binary', 'reverb', 'calibre', 'all', 'transcription', 'write', 'tts', 'image', 'lyrics', 'sample']

export const setupCommand = defineCommand({
  name: 'setup',
  description: 'Install local dependencies and required tools',
  flags: setupFlags,
  help: {
    examples: [
      ['bun as setup', 'Install all dependencies'],
      ['bun as setup --gcloud', 'Check gcloud CLI auth/config for Google Cloud Speech-to-Text'],
      ['bun as setup --gcloud --gcloud-project my-project', 'Set or create the Google Cloud project, link billing when possible, enable Speech-to-Text, and save the default Google STT model'],
      ['bun as setup --gcloud --gcloud-project my-project --gcloud-billing-account 000000-000000-000000', 'Bootstrap a Google Cloud project with an explicit billing account'],
      ['bun as setup --aws', 'Check AWS CLI auth/config for Amazon Transcribe and auto-create/save a staging bucket when missing'],
      ['bun as setup --aws --aws-create-bucket', 'Create and save an S3 staging bucket for Amazon Transcribe'],
      ['bun as setup --doctor', 'Check prerequisites without installing'],
      ['bun as setup --step whisper-binary --force-redownload', 'Reinstall whisper binary']
    ]
  }
}, async (ctx) => {
  const gcloudProject = typeof ctx.flags['gcloud-project'] === 'string' ? ctx.flags['gcloud-project'] : undefined
  const gcloudBillingAccount = typeof ctx.flags['gcloud-billing-account'] === 'string' ? ctx.flags['gcloud-billing-account'] : undefined
  const gcloudProjectName = typeof ctx.flags['gcloud-project-name'] === 'string' ? ctx.flags['gcloud-project-name'] : undefined
  const gcloudOrganization = typeof ctx.flags['gcloud-organization'] === 'string' ? ctx.flags['gcloud-organization'] : undefined
  const gcloudFolder = typeof ctx.flags['gcloud-folder'] === 'string' ? ctx.flags['gcloud-folder'] : undefined
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

  if (ctx.flags.gcloud) {
    const conflicts: string[] = []
    if (ctx.flags.aws) {
      conflicts.push('--aws')
    }
    if (ctx.flags['aws-create-bucket']) {
      conflicts.push('--aws-create-bucket')
    }
    if (typeof ctx.flags['aws-region'] === 'string') {
      conflicts.push('--aws-region')
    }
    if (typeof ctx.flags['aws-bucket'] === 'string') {
      conflicts.push('--aws-bucket')
    }
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
      throw CLIUsageError(`--gcloud cannot be combined with ${conflicts.join(', ')}`)
    }

    await runWithLogContext({ step: 'setup' }, async () => {
      await setupGcloudStt({
        focused: true,
        preferredProject: gcloudProject,
        preferredBillingAccount: gcloudBillingAccount,
        projectName: gcloudProjectName,
        organizationId: gcloudOrganization,
        folderId: gcloudFolder,
        configPathOverride: typeof ctx.flags['config-path'] === 'string' ? ctx.flags['config-path'] : undefined
      })
    })
    return
  }

  if (ctx.flags.aws) {
    const conflicts: string[] = []
    if (ctx.flags.gcloud) {
      conflicts.push('--gcloud')
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
      throw CLIUsageError(`--aws cannot be combined with ${conflicts.join(', ')}`)
    }

    const awsDefaults = await readAwsSttConfigDefaults()
    const preferredRegion = typeof ctx.flags['aws-region'] === 'string'
      ? ctx.flags['aws-region']
      : awsDefaults.preferredRegion
    const preferredBucket = typeof ctx.flags['aws-bucket'] === 'string'
      ? ctx.flags['aws-bucket']
      : awsDefaults.preferredBucket
    await runWithLogContext({ step: 'setup' }, async () => {
      await setupAwsStt({
        preferredRegion,
        preferredBucket,
        autoCreateMissingBucket: true,
        autoCreateBucket: ctx.flags['aws-create-bucket'] === true,
        focused: true,
        verifyTranscribe: true
      })
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

  l.success('Setup complete')
})
