import type { GcloudSttRuntimeConfig } from '~/types'
import { GCLOUD_STT_DEFAULT_LOCATION } from './gcloud-constants'
import { readAccessToken } from './gcloud-cli'
import { readGcloudSttReadiness } from './gcloud-readiness'

export const ensureGcloudSttSetup = async (): Promise<GcloudSttRuntimeConfig> => {
  const state = await readGcloudSttReadiness()
  if (!state.hasCli) {
    throw new Error('Google Cloud CLI is required for Google transcription. Install gcloud and rerun `bun as setup --gcloud`.')
  }

  if (!state.authConfigured) {
    throw new Error('Google Cloud CLI auth is required for Google transcription. Run `gcloud auth login` or rerun `bun as setup --gcloud`.')
  }

  if (!state.projectId) {
    throw new Error('Google Cloud project is required for Google transcription. Run `bun as setup --gcloud --gcloud-project PROJECT_ID` to create or select the project, or run `gcloud config set project PROJECT_ID` if it already exists.')
  }

  if (state.billingEnabled !== true) {
    throw new Error(`Google Cloud billing must be linked for project ${state.projectId}. Run \`gcloud billing projects link ${state.projectId} --billing-account ACCOUNT_ID\` or rerun \`bun as setup --gcloud --gcloud-project ${state.projectId}\`.`)
  }

  if (state.speechApiEnabled !== true) {
    throw new Error(`Google Cloud Speech-to-Text API must be enabled for project ${state.projectId}. Run \`gcloud services enable speech.googleapis.com --project ${state.projectId}\` or rerun \`bun as setup --gcloud\`.`)
  }

  const tokenState = await readAccessToken()
  const accessToken = tokenState.accessToken
  if (!tokenState.ok || !accessToken) {
    throw new Error('Google Cloud CLI auth is required for Google transcription. Run `gcloud auth login` or rerun `bun as setup --gcloud`.')
  }

  return {
    accessToken,
    projectId: state.projectId,
    location: GCLOUD_STT_DEFAULT_LOCATION
  }
}

export const resolveGcloudSpeechContext = async (): Promise<GcloudSttRuntimeConfig> =>
  await ensureGcloudSttSetup()

export const ensureGcloudTtsSetup = async (): Promise<{ accessToken: string, projectId: string }> => {
  const state = await readGcloudSttReadiness()
  if (!state.hasCli) {
    throw new Error('Google Cloud CLI is required for Google Cloud TTS. Install gcloud and rerun `bun as setup --gcloud`.')
  }

  if (!state.authConfigured) {
    throw new Error('Google Cloud CLI auth is required for Google Cloud TTS. Run `gcloud auth login` or rerun `bun as setup --gcloud`.')
  }

  if (!state.projectId) {
    throw new Error('Google Cloud project is required for Google Cloud TTS. Run `bun as setup --gcloud --gcloud-project PROJECT_ID` to create or select the project, or run `gcloud config set project PROJECT_ID` if it already exists.')
  }

  if (state.billingEnabled !== true) {
    throw new Error(`Google Cloud billing must be linked for project ${state.projectId}. Run \`gcloud billing projects link ${state.projectId} --billing-account ACCOUNT_ID\` or rerun \`bun as setup --gcloud --gcloud-project ${state.projectId}\`.`)
  }

  if (state.textToSpeechApiEnabled !== true) {
    throw new Error(`Google Cloud Text-to-Speech API must be enabled for project ${state.projectId}. Run \`gcloud services enable texttospeech.googleapis.com --project ${state.projectId}\` or rerun \`bun as setup --gcloud\`.`)
  }

  const tokenState = await readAccessToken()
  const accessToken = tokenState.accessToken
  if (!tokenState.ok || !accessToken) {
    throw new Error('Google Cloud CLI auth is required for Google Cloud TTS. Run `gcloud auth login` or rerun `bun as setup --gcloud`.')
  }

  return {
    accessToken,
    projectId: state.projectId
  }
}
