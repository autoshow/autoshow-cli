import { loadConfig, resolveConfigPath } from '~/cli/commands/setup-and-utilities/config/config-loader'
import {
  GCLOUD_DOCAI_DEFAULT_PROCESSOR_DISPLAY_NAME,
  GCLOUD_DOCAI_LAYOUT_PROCESSOR_DISPLAY_NAME,
  GCLOUD_DOCAI_LAYOUT_PROCESSOR_TYPE,
  GCLOUD_DOCAI_OCR_PROCESSOR_TYPE
} from './gcloud-constants'
import {
  normalizeString,
  readCommandText,
  runGcloud
} from './gcloud-cli'

export const readSavedGcloudDocaiDefaults = async (
  configPathOverride?: string
): Promise<{
  configPath: string
  location?: string | undefined
  ocrProcessorId?: string | undefined
  layoutProcessorId?: string | undefined
  bucket?: string | undefined
}> => {
  const configPath = await resolveConfigPath(configPathOverride)
  const current = await loadConfig(configPath)
  const ocr = current.defaults?.extract?.ocr
  return {
    configPath,
    location: normalizeString(ocr?.gcloudDocaiLocation),
    ocrProcessorId: normalizeString(ocr?.gcloudDocaiOcrProcessorId),
    layoutProcessorId: normalizeString(ocr?.gcloudDocaiLayoutProcessorId),
    bucket: normalizeString(ocr?.gcloudDocaiBucket)
  }
}

const readGcloudDocaiProcessorId = (processorName: string): string | undefined =>
  processorName.split('/').pop()

const documentAiBaseUrl = (projectId: string, location: string): string =>
  `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors`

const listDocumentAiProcessors = async (
  projectId: string,
  location: string,
  accessToken: string
): Promise<Array<{ name?: string, displayName?: string, type?: string }>> => {
  const response = await fetch(documentAiBaseUrl(projectId, location), {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })
  if (!response.ok) {
    throw new Error(`Failed to list Document AI processors (${response.status}): ${await response.text()}`)
  }
  const payload = await response.json() as { processors?: Array<{ name?: string, displayName?: string, type?: string }> }
  return Array.isArray(payload.processors) ? payload.processors : []
}

const createDocumentAiOcrProcessor = async (
  projectId: string,
  location: string,
  accessToken: string
): Promise<string> => {
  const response = await fetch(documentAiBaseUrl(projectId, location), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      displayName: GCLOUD_DOCAI_DEFAULT_PROCESSOR_DISPLAY_NAME,
      type: GCLOUD_DOCAI_OCR_PROCESSOR_TYPE
    })
  })
  if (!response.ok) {
    throw new Error(
      `Failed to create Document AI OCR processor (${response.status}): ${await response.text()}. ` +
      `Create one manually in project ${projectId}, location ${location}, type ${GCLOUD_DOCAI_OCR_PROCESSOR_TYPE}.`
    )
  }
  const payload = await response.json() as { name?: string }
  const processorId = payload.name ? readGcloudDocaiProcessorId(payload.name) : undefined
  if (!processorId) {
    throw new Error('Document AI OCR processor creation response did not include a processor ID.')
  }
  return processorId
}

export const ensureDocumentAiOcrProcessor = async (
  projectId: string,
  location: string,
  accessToken: string,
  savedProcessorId?: string | undefined
): Promise<{ processorId?: string | undefined, created: boolean, detail: string }> => {
  if (savedProcessorId) {
    return { processorId: savedProcessorId, created: false, detail: `saved ${savedProcessorId}` }
  }

  const processors = await listDocumentAiProcessors(projectId, location, accessToken)
  const reusable = processors.find((processor) =>
    processor.type === GCLOUD_DOCAI_OCR_PROCESSOR_TYPE
    && processor.displayName === GCLOUD_DOCAI_DEFAULT_PROCESSOR_DISPLAY_NAME
    && processor.name
  )
  const reusableId = reusable?.name ? readGcloudDocaiProcessorId(reusable.name) : undefined
  if (reusableId) {
    return { processorId: reusableId, created: false, detail: `found ${reusableId}` }
  }

  const processorId = await createDocumentAiOcrProcessor(projectId, location, accessToken)
  return { processorId, created: true, detail: `created ${processorId}` }
}

const createDocumentAiLayoutProcessor = async (
  projectId: string,
  location: string,
  accessToken: string
): Promise<string> => {
  const response = await fetch(documentAiBaseUrl(projectId, location), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      displayName: GCLOUD_DOCAI_LAYOUT_PROCESSOR_DISPLAY_NAME,
      type: GCLOUD_DOCAI_LAYOUT_PROCESSOR_TYPE
    })
  })
  if (!response.ok) {
    throw new Error(
      `Failed to create Document AI Layout Parser processor (${response.status}): ${await response.text()}. ` +
      `Create one manually in project ${projectId}, location ${location}, type ${GCLOUD_DOCAI_LAYOUT_PROCESSOR_TYPE}.`
    )
  }
  const payload = await response.json() as { name?: string }
  const processorId = payload.name ? readGcloudDocaiProcessorId(payload.name) : undefined
  if (!processorId) {
    throw new Error('Document AI Layout Parser processor creation response did not include a processor ID.')
  }
  return processorId
}

export const ensureDocumentAiLayoutProcessor = async (
  projectId: string,
  location: string,
  accessToken: string,
  savedProcessorId?: string | undefined
): Promise<{ processorId?: string | undefined, created: boolean, detail: string }> => {
  if (savedProcessorId) {
    return { processorId: savedProcessorId, created: false, detail: `saved ${savedProcessorId}` }
  }

  const processors = await listDocumentAiProcessors(projectId, location, accessToken)
  const reusable = processors.find((processor) =>
    processor.type === GCLOUD_DOCAI_LAYOUT_PROCESSOR_TYPE
    && processor.displayName === GCLOUD_DOCAI_LAYOUT_PROCESSOR_DISPLAY_NAME
    && processor.name
  )
  const reusableId = reusable?.name ? readGcloudDocaiProcessorId(reusable.name) : undefined
  if (reusableId) {
    return { processorId: reusableId, created: false, detail: `found ${reusableId}` }
  }

  const processorId = await createDocumentAiLayoutProcessor(projectId, location, accessToken)
  return { processorId, created: true, detail: `created ${processorId}` }
}

const sanitizeBucketPart = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'project'

const generateGcloudDocaiBucketName = (projectId: string): string =>
  `autoshow-docai-${sanitizeBucketPart(projectId)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`

const verifyGcsBucketAccess = async (bucket: string): Promise<{ ok: boolean, detail: string }> => {
  const result = await runGcloud(['storage', 'ls', `gs://${bucket}`, '--quiet'])
  if (result.exitCode !== 0) {
    return {
      ok: false,
      detail: readCommandText(result.stdout, result.stderr)
    }
  }
  return { ok: true, detail: 'accessible' }
}

const createGcsBucket = async (
  projectId: string,
  bucket: string,
  location: string
): Promise<void> => {
  const result = await runGcloud([
    'storage',
    'buckets',
    'create',
    `gs://${bucket}`,
    '--project',
    projectId,
    '--location',
    location,
    '--uniform-bucket-level-access',
    '--public-access-prevention',
    '--quiet'
  ])
  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to create GCS bucket "${bucket}": ${readCommandText(result.stdout, result.stderr)}. ` +
      `Run: gcloud storage buckets create gs://${bucket} --project ${projectId} --location ${location} --uniform-bucket-level-access --public-access-prevention`
    )
  }
}

export const ensureGcloudDocaiBucket = async (
  projectId: string,
  location: string,
  savedBucket?: string | undefined
): Promise<{ bucket?: string | undefined, created: boolean, ok: boolean, detail: string }> => {
  if (savedBucket) {
    const access = await verifyGcsBucketAccess(savedBucket)
    if (!access.ok) {
      return { bucket: savedBucket, created: false, ok: false, detail: access.detail }
    }
    return { bucket: savedBucket, created: false, ok: true, detail: 'saved and accessible' }
  }

  const bucket = generateGcloudDocaiBucketName(projectId)
  await createGcsBucket(projectId, bucket, location)
  const access = await verifyGcsBucketAccess(bucket)
  if (!access.ok) {
    throw new Error(`Created GCS bucket "${bucket}" but could not verify access: ${access.detail}`)
  }
  return { bucket, created: true, ok: true, detail: 'created and accessible' }
}
