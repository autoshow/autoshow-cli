import { defineCommand } from 'clerc'
import { setupFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { runCompleteSetup, runSetupStep, type SetupStepId } from './setup-orchestrator/run-complete-setup'
import { runDoctor } from './run-doctor'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'

const VALID_SETUP_STEPS: SetupStepId[] = ['uv', 'yt-dlp', 'whisper-binary', 'whisper-model', 'llama-binary', 'reverb', 'calibre', 'all', 'transcription', 'write', 'tts', 'image', 'sample']

export const setupCommand = defineCommand({
  name: 'setup',
  description: 'Install local dependencies and required tools',
  flags: setupFlags,
  help: {
    examples: [
      ['bun as setup', 'Install all dependencies'],
      ['bun as setup --doctor', 'Check prerequisites without installing'],
      ['bun as setup --step whisper-binary --force-redownload', 'Reinstall whisper binary']
    ]
  }
}, async (ctx) => {
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
