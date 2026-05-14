import type { CliFlagsDefinition } from '~/cli/native'
import { transcriptionFlags } from './shared-flags'
import { sampleFlags } from './sample-flags'

const setupSampleFlags = {
  out: {
    ...sampleFlags.out,
    description: 'With --sample, output directory for fixture files (default: input/samples)'
  },
  refresh: {
    ...sampleFlags.refresh,
    description: 'With --sample, regenerate all fixtures even if the manifest is already valid'
  },
  'verify-only': {
    ...sampleFlags['verify-only'],
    description: 'With --sample, validate the fixture set without regenerating'
  },
  'valid-only': {
    ...sampleFlags['valid-only'],
    description: 'With --sample, skip invalid fixture generation'
  }
} as const satisfies CliFlagsDefinition

export const setupFlags = {
  gcloud: {
    description: 'Check gcloud CLI authentication/configuration for Google Cloud Speech-to-Text, Text-to-Speech, and Document AI OCR and print next steps',
    type: Boolean,
    default: false,
    negatable: false
  },
  'gcloud-project': {
    description: 'With --gcloud, set the active Google Cloud project or create it when missing before rechecking Speech-to-Text, Text-to-Speech, and Document AI OCR readiness',
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
    description: 'Check AWS CLI authentication/configuration for Amazon Transcribe/Textract staging and print next steps',
    type: Boolean,
    default: false,
    negatable: false
  },
  'aws-create-bucket': {
    description: 'With --aws, create an S3 staging bucket shared by Amazon Transcribe and Textract',
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
  sample: {
    description: 'Generate or validate deterministic fixture files for all supported formats',
    type: Boolean,
    default: false,
    negatable: false
  },
  models: {
    description: 'Download one or more local Whisper or llama.cpp models without running inference (repeatable)',
    type: [String] as [StringConstructor]
  },
  ...setupSampleFlags,
  step: {
    description: 'Run only a specific setup step: uv|yt-dlp|defuddle|whisper-binary|whisper-model|llama-binary|reverb|calibre|all|transcription|write|tts|image|video|music|sample (default: all). Assumes prerequisites are already installed for isolated steps.',
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
} as const satisfies CliFlagsDefinition
