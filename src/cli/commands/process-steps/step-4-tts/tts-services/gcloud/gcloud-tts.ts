import * as l from '~/utils/logger'
import { readGcloudSttReadiness, ensureGcloudTtsSetup as ensureSharedGcloudTtsSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gcloud/gcloud'

export const setupGcloudTts = async (): Promise<void> => {
  const state = await readGcloudSttReadiness()
  if (
    state.hasCli
    && state.authConfigured
    && state.projectId
    && state.billingEnabled === true
    && state.textToSpeechApiEnabled === true
  ) {
    l.write('success', 'Google Cloud Text-to-Speech ready')
    return
  }

  l.warn('Google Cloud Text-to-Speech is not ready')
  l.write('info', 'Run `bun as setup --gcloud` to configure gcloud auth, project billing, and texttospeech.googleapis.com')
}

export const ensureGcloudTtsSetup = async (): Promise<{ accessToken: string, projectId: string }> =>
  await ensureSharedGcloudTtsSetup()
