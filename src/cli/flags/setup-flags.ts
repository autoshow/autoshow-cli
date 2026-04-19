import type { ClercFlagsDefinition } from 'clerc'
import { transcriptionFlags } from './shared-flags'

export const setupFlags = {
  gcloud: {
    description: 'Check gcloud CLI authentication/configuration for Google Cloud Speech-to-Text and print next steps',
    type: Boolean,
    default: false,
    negatable: false
  },
  'gcloud-project': {
    description: 'With --gcloud, set the active Google Cloud project or create it when missing before rechecking Speech-to-Text readiness',
    type: String
  },
  'gcloud-billing-account': {
    description: 'With --gcloud --gcloud-project, link this Google Cloud billing account during project bootstrap',
    type: String
  },
  'gcloud-project-name': {
    description: 'With --gcloud --gcloud-project, use this display name when creating a missing Google Cloud project',
    type: String
  },
  'gcloud-organization': {
    description: 'With --gcloud --gcloud-project, create a missing Google Cloud project under this organization',
    type: String
  },
  'gcloud-folder': {
    description: 'With --gcloud --gcloud-project, create a missing Google Cloud project under this folder',
    type: String
  },
  aws: {
    description: 'Check AWS CLI authentication/configuration for Amazon Transcribe, auto-create/save a staging bucket when missing, and print next steps',
    type: Boolean,
    default: false,
    negatable: false
  },
  'aws-create-bucket': {
    description: 'With --aws, create and save an S3 staging bucket for Amazon Transcribe automatically',
    type: Boolean,
    default: false,
    negatable: false
  },
  'aws-region': transcriptionFlags['aws-region'],
  'aws-bucket': transcriptionFlags['aws-bucket'],
  doctor: {
    description: 'Check prerequisites, API keys, and configuration without installing anything',
    type: Boolean,
    default: false,
    negatable: false
  },
  step: {
    description: 'Run only a specific setup step: uv|yt-dlp|whisper-binary|whisper-model|llama-binary|reverb|calibre|all|transcription|write|tts|image|lyrics|sample (default: all). Assumes prerequisites are already installed for isolated steps.',
    type: String,
    default: 'all'
  },
  'force-redownload': {
    description: 'Remove existing artifacts before downloading',
    type: Boolean,
    default: false,
    negatable: false
  },
  repeat: {
    description: 'Repeat the setup step N times for benchmarking (default: 1)',
    type: String,
    default: '1'
  }
} as const satisfies ClercFlagsDefinition
