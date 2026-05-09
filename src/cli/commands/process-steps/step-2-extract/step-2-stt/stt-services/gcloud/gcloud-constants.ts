export const GCLOUD_COMMAND_ENV = {
  CLOUDSDK_CORE_DISABLE_PROMPTS: '1'
} as const

export const GCLOUD_STT_DEFAULT_MODEL = 'chirp_3'
export const GCLOUD_STT_DEFAULT_LOCATION = 'us'

export const GCLOUD_DOCAI_DEFAULT_MODEL = 'ocr'
export const GCLOUD_DOCAI_DEFAULT_LOCATION = 'us'
export const GCLOUD_DOCAI_DEFAULT_PROCESSOR_DISPLAY_NAME = 'autoshow-ocr'
export const GCLOUD_DOCAI_LAYOUT_PROCESSOR_DISPLAY_NAME = 'autoshow-layout-parser'
export const GCLOUD_DOCAI_OCR_PROCESSOR_TYPE = 'OCR_PROCESSOR'
export const GCLOUD_DOCAI_LAYOUT_PROCESSOR_TYPE = 'LAYOUT_PARSER_PROCESSOR'

export const GCLOUD_REQUIRED_APIS = [
  'speech.googleapis.com',
  'texttospeech.googleapis.com',
  'documentai.googleapis.com',
  'storage.googleapis.com'
] as const

export type GcloudRequiredApi = typeof GCLOUD_REQUIRED_APIS[number]
