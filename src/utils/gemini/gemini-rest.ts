import { basename } from 'node:path'
import { AppError } from '~/utils/error-handler'

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com'
const GEMINI_API_VERSION = 'v1beta'
const GEMINI_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024

export type GeminiPart = {
  text?: string | undefined
  thought?: boolean | undefined
  inlineData?: {
    data?: string | undefined
    mimeType?: string | undefined
  } | undefined
  fileData?: {
    fileUri?: string | undefined
    mimeType?: string | undefined
  } | undefined
  [key: string]: unknown
}

export type GeminiContent = {
  role?: string | undefined
  parts: GeminiPart[]
}

export type GeminiGenerateContentUsageMetadata = {
  promptTokenCount?: number | undefined
  candidatesTokenCount?: number | undefined
  totalTokenCount?: number | undefined
  cachedContentTokenCount?: number | undefined
  thoughtsTokenCount?: number | undefined
  toolUsePromptTokenCount?: number | undefined
  promptTokensDetails?: Array<{
    modality?: string | undefined
    tokenCount?: number | undefined
    [key: string]: unknown
  }> | undefined
  candidatesTokensDetails?: Array<{
    modality?: string | undefined
    tokenCount?: number | undefined
    [key: string]: unknown
  }> | undefined
  [key: string]: unknown
}

export type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[] | undefined
      [key: string]: unknown
    } | undefined
    groundingMetadata?: unknown
    [key: string]: unknown
  }> | undefined
  usageMetadata?: GeminiGenerateContentUsageMetadata | undefined
  promptFeedback?: {
    blockReason?: string | undefined
    [key: string]: unknown
  } | undefined
  modelVersion?: string | undefined
  responseId?: string | undefined
  text?: string | undefined
  sdkHttpResponse?: {
    headers: Headers
    status: number
  } | undefined
  [key: string]: unknown
}

export type GeminiFile = {
  name?: string | undefined
  uri?: string | undefined
  mimeType?: string | undefined
  state?: string | { name?: string | undefined } | undefined
  [key: string]: unknown
}

export type GeminiGeneratedImage = {
  image?: {
    imageBytes?: string | undefined
    mimeType?: string | undefined
  } | undefined
  raiFilteredReason?: unknown
  safetyAttributes?: unknown
}

export type GeminiGenerateImagesResponse = {
  generatedImages?: GeminiGeneratedImage[] | undefined
  positivePromptSafetyAttributes?: unknown
  sdkHttpResponse?: {
    headers: Headers
    status: number
  } | undefined
}

export type GeminiVideo = {
  uri?: string | undefined
  videoBytes?: string | undefined
  mimeType?: string | undefined
}

export type GeminiInlineMedia = {
  inlineData: {
    mimeType: string
    data: string
  }
}

export type GeminiVideoReferenceImage = {
  image: GeminiInlineMedia
  referenceType: 'asset'
}

export type GeminiGeneratedVideo = {
  video?: GeminiVideo | undefined
}

export type GeminiVideoOperation = {
  name?: string | undefined
  done?: boolean | undefined
  error?: unknown
  metadata?: unknown
  response?: {
    generatedVideos?: GeminiGeneratedVideo[] | undefined
    raiMediaFilteredCount?: unknown
    raiMediaFilteredReasons?: unknown
  } | undefined
  [key: string]: unknown
}

export class GeminiRestError extends Error {
  status: number
  headers: Headers
  body: unknown

  constructor(message: string, status: number, headers: Headers, body: unknown) {
    super(message)
    this.name = 'GeminiRestError'
    this.status = status
    this.headers = headers
    this.body = body
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parseJsonOrText = (text: string): unknown => {
  if (text.trim().length === 0) {
    return {}
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

const buildGeminiUrl = (path: string, params?: Record<string, string>): string => {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  const url = new URL(`${GEMINI_API_BASE_URL}/${normalizedPath}`)
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

const buildV1BetaUrl = (path: string, params?: Record<string, string>): string =>
  buildGeminiUrl(`${GEMINI_API_VERSION}/${path}`, params)

const geminiJsonRequest = async (
  apiKey: string,
  path: string,
  init: {
    method: 'GET' | 'POST' | 'DELETE'
    body?: unknown
    headers?: ConstructorParameters<typeof Headers>[0] | undefined
    query?: Record<string, string> | undefined
    apiVersionPath?: boolean | undefined
    abortSignal?: AbortSignal | undefined
  }
): Promise<{ json: unknown, headers: Headers, status: number }> => {
  const url = init.apiVersionPath === false
    ? buildGeminiUrl(path, init.query)
    : buildV1BetaUrl(path, init.query)
  const headers = new Headers(init.headers)
  headers.set('x-goog-api-key', apiKey)
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(url, {
    method: init.method,
    headers,
    ...(init.body !== undefined ? { body: typeof init.body === 'string' ? init.body : JSON.stringify(init.body) } : {}),
    ...(init.abortSignal ? { signal: init.abortSignal } : {})
  })
  const text = await response.text()
  const parsed = parseJsonOrText(text)
  if (!response.ok) {
    throw new GeminiRestError(formatGeminiErrorMessage(parsed, response.status), response.status, response.headers, parsed)
  }
  if (typeof parsed === 'string') {
    throw new AppError(`Gemini API returned invalid JSON: ${parsed.slice(0, 500)}`, {
      kind: 'validation',
      status: response.status,
      metadata: {
        body: parsed,
        rawResponse: parsed
      }
    })
  }
  return { json: parsed, headers: response.headers, status: response.status }
}

const geminiBinaryRequest = async (
  apiKey: string,
  path: string,
  query?: Record<string, string>
): Promise<{ bytes: Uint8Array, headers: Headers, status: number }> => {
  const response = await fetch(buildV1BetaUrl(path, query), {
    method: 'GET',
    headers: {
      'x-goog-api-key': apiKey
    }
  })
  if (!response.ok) {
    const text = await response.text()
    const parsed = parseJsonOrText(text)
    throw new GeminiRestError(formatGeminiErrorMessage(parsed, response.status), response.status, response.headers, parsed)
  }
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    headers: response.headers,
    status: response.status
  }
}

const formatGeminiErrorMessage = (body: unknown, status: number): string => {
  if (isRecord(body) && isRecord(body['error'])) {
    const error = body['error']
    const message = typeof error['message'] === 'string' ? error['message'] : JSON.stringify(body)
    const code = typeof error['code'] === 'number' ? error['code'] : status
    return `Gemini API request failed with status ${code}: ${message}`
  }
  if (typeof body === 'string' && body.length > 0) {
    return `Gemini API request failed with status ${status}: ${body}`
  }
  return `Gemini API request failed with status ${status}`
}

export const normalizeGeminiModelPath = (model: string): string => {
  if (!model || model.includes('..') || model.includes('?') || model.includes('&')) {
    throw new Error('invalid Gemini model parameter')
  }
  return model.startsWith('models/') || model.startsWith('tunedModels/')
    ? model
    : `models/${model}`
}

const encodePath = (path: string): string =>
  path.split('/').map((part) => encodeURIComponent(part)).join('/')

export const geminiFileDataPart = (uri: string, mimeType: string): GeminiPart => ({
  fileData: {
    fileUri: uri,
    mimeType
  }
})

export const geminiUserContent = (parts: Array<GeminiPart | string>): GeminiContent => ({
  role: 'user',
  parts: parts.map((part) => typeof part === 'string' ? { text: part } : part)
})

const normalizeGeminiContents = (
  contents: string | GeminiPart | GeminiContent | Array<string | GeminiPart | GeminiContent>
): GeminiContent[] => {
  if (typeof contents === 'string') {
    return [geminiUserContent([contents])]
  }
  if (isRecord(contents) && Array.isArray(contents['parts'])) {
    return [contents as GeminiContent]
  }
  if (!Array.isArray(contents)) {
    return [geminiUserContent([contents as GeminiPart])]
  }
  if (contents.length > 0 && isRecord(contents[0]) && Array.isArray((contents[0] as Record<string, unknown>)['parts'])) {
    return contents as GeminiContent[]
  }
  return [geminiUserContent(contents as Array<string | GeminiPart>)]
}

export const extractGeminiResponseText = (response: GeminiGenerateContentResponse): string | undefined => {
  const parts = response.candidates?.[0]?.content?.parts ?? []
  let text = ''
  let found = false
  for (const part of parts) {
    if (part.thought === true || typeof part.text !== 'string') {
      continue
    }
    found = true
    text += part.text
  }
  return found ? text : undefined
}

export const geminiGenerateContent = async (
  apiKey: string,
  params: {
    model: string
    contents: string | GeminiPart | GeminiContent | Array<string | GeminiPart | GeminiContent>
    generationConfig?: Record<string, unknown> | undefined
    tools?: unknown[] | undefined
    systemInstruction?: string | GeminiContent | undefined
    abortSignal?: AbortSignal | undefined
  }
): Promise<GeminiGenerateContentResponse> => {
  const body: Record<string, unknown> = {
    contents: normalizeGeminiContents(params.contents)
  }
  if (params.generationConfig) {
    body['generationConfig'] = params.generationConfig
  }
  if (params.tools) {
    body['tools'] = params.tools
  }
  if (params.systemInstruction) {
    body['systemInstruction'] = typeof params.systemInstruction === 'string'
      ? { parts: [{ text: params.systemInstruction }] }
      : params.systemInstruction
  }
  const modelPath = normalizeGeminiModelPath(params.model)
  const { json, headers, status } = await geminiJsonRequest(apiKey, `${encodePath(modelPath)}:generateContent`, {
    method: 'POST',
    body,
    ...(params.abortSignal ? { abortSignal: params.abortSignal } : {})
  })
  const response = isRecord(json) ? json as GeminiGenerateContentResponse : {}
  response.text = extractGeminiResponseText(response)
  response.sdkHttpResponse = { headers, status }
  return response
}

export const geminiGenerateImages = async (
  apiKey: string,
  params: {
    model: string
    prompt: string
    numberOfImages: number
    aspectRatio?: string | undefined
    imageSize?: string | undefined
    personGeneration?: string | undefined
  }
): Promise<GeminiGenerateImagesResponse> => {
  const body: Record<string, unknown> = {
    instances: [{ prompt: params.prompt }],
    parameters: {
      sampleCount: params.numberOfImages,
      ...(params.aspectRatio ? { aspectRatio: params.aspectRatio } : {}),
      ...(params.imageSize ? { sampleImageSize: params.imageSize } : {}),
      ...(params.personGeneration ? { personGeneration: params.personGeneration } : {})
    }
  }
  const modelPath = normalizeGeminiModelPath(params.model)
  const { json, headers, status } = await geminiJsonRequest(apiKey, `${encodePath(modelPath)}:predict`, {
    method: 'POST',
    body
  })
  const raw = isRecord(json) ? json : {}
  const predictions = Array.isArray(raw['predictions']) ? raw['predictions'] : []
  const generatedImages = predictions
    .map((prediction): GeminiGeneratedImage | undefined => {
      if (!isRecord(prediction)) return undefined
      return {
        image: {
          imageBytes: typeof prediction['bytesBase64Encoded'] === 'string' ? prediction['bytesBase64Encoded'] : undefined,
          mimeType: typeof prediction['mimeType'] === 'string' ? prediction['mimeType'] : undefined
        },
        ...(prediction['raiFilteredReason'] !== undefined ? { raiFilteredReason: prediction['raiFilteredReason'] } : {}),
        ...(prediction['safetyAttributes'] !== undefined ? { safetyAttributes: prediction['safetyAttributes'] } : {})
      }
    })
    .filter((image): image is GeminiGeneratedImage => image !== undefined)
  return {
    generatedImages,
    ...(raw['positivePromptSafetyAttributes'] !== undefined ? { positivePromptSafetyAttributes: raw['positivePromptSafetyAttributes'] } : {}),
    sdkHttpResponse: { headers, status }
  }
}

export const geminiPredictLongRunning = async (
  apiKey: string,
  params: {
    model: string
    prompt: string
    numberOfVideos: number
    durationSeconds: number
    resolution: string
    aspectRatio?: string | undefined
    image?: GeminiInlineMedia | undefined
    lastFrame?: GeminiInlineMedia | undefined
    referenceImages?: GeminiVideoReferenceImage[] | undefined
    video?: GeminiInlineMedia | undefined
  }
): Promise<GeminiVideoOperation> => {
  const body: Record<string, unknown> = {
    instances: [{
      prompt: params.prompt,
      ...(params.image ? { image: params.image } : {}),
      ...(params.lastFrame ? { lastFrame: params.lastFrame } : {}),
      ...(params.referenceImages && params.referenceImages.length > 0 ? { referenceImages: params.referenceImages } : {}),
      ...(params.video ? { video: params.video } : {})
    }],
    parameters: {
      sampleCount: params.numberOfVideos,
      durationSeconds: params.durationSeconds,
      resolution: params.resolution,
      ...(params.aspectRatio ? { aspectRatio: params.aspectRatio } : {})
    }
  }
  const modelPath = normalizeGeminiModelPath(params.model)
  const { json } = await geminiJsonRequest(apiKey, `${encodePath(modelPath)}:predictLongRunning`, {
    method: 'POST',
    body
  })
  return normalizeGeminiVideoOperation(json)
}

export const geminiGetOperation = async (
  apiKey: string,
  operationName: string
): Promise<GeminiVideoOperation> => {
  const { json } = await geminiJsonRequest(apiKey, encodePath(operationName), {
    method: 'GET'
  })
  return normalizeGeminiVideoOperation(json)
}

const normalizeGeminiVideoOperation = (value: unknown): GeminiVideoOperation => {
  const raw = isRecord(value) ? value : {}
  const operation: GeminiVideoOperation = {
    ...(typeof raw['name'] === 'string' ? { name: raw['name'] } : {}),
    ...(typeof raw['done'] === 'boolean' ? { done: raw['done'] } : {}),
    ...(raw['metadata'] !== undefined ? { metadata: raw['metadata'] } : {}),
    ...(raw['error'] !== undefined ? { error: raw['error'] } : {})
  }
  const response = isRecord(raw['response']) ? raw['response'] : undefined
  const generateVideoResponse = response && isRecord(response['generateVideoResponse'])
    ? response['generateVideoResponse']
    : response
  if (generateVideoResponse) {
    const samples = Array.isArray(generateVideoResponse['generatedSamples'])
      ? generateVideoResponse['generatedSamples']
      : Array.isArray(generateVideoResponse['generatedVideos'])
        ? generateVideoResponse['generatedVideos']
        : []
    operation.response = {
      generatedVideos: samples
        .map((sample): GeminiGeneratedVideo | undefined => {
          if (!isRecord(sample)) return undefined
          if (isRecord(sample['video'])) {
            return { video: normalizeGeminiVideo(sample['video']) }
          }
          if (isRecord(sample['_self'])) {
            return { video: normalizeGeminiVideo(sample['_self']) }
          }
          return undefined
        })
        .filter((video): video is GeminiGeneratedVideo => video !== undefined),
      ...(generateVideoResponse['raiMediaFilteredCount'] !== undefined ? { raiMediaFilteredCount: generateVideoResponse['raiMediaFilteredCount'] } : {}),
      ...(generateVideoResponse['raiMediaFilteredReasons'] !== undefined ? { raiMediaFilteredReasons: generateVideoResponse['raiMediaFilteredReasons'] } : {})
    }
  }
  return operation
}

const normalizeGeminiVideo = (raw: Record<string, unknown>): GeminiVideo => ({
  ...(typeof raw['uri'] === 'string' ? { uri: raw['uri'] } : {}),
  ...(typeof raw['encodedVideo'] === 'string' ? { videoBytes: raw['encodedVideo'] } : {}),
  ...(typeof raw['videoBytes'] === 'string' ? { videoBytes: raw['videoBytes'] } : {}),
  ...(typeof raw['encoding'] === 'string' ? { mimeType: raw['encoding'] } : {}),
  ...(typeof raw['mimeType'] === 'string' ? { mimeType: raw['mimeType'] } : {})
})

export const geminiUploadFile = async (
  apiKey: string,
  filePath: string,
  config: {
    mimeType: string
    displayName?: string | undefined
    name?: string | undefined
    abortSignal?: AbortSignal | undefined
  }
): Promise<GeminiFile> => {
  const file = Bun.file(filePath)
  const sizeBytes = file.size
  const uploadFileName = basename(filePath)
  const fileMetadata: Record<string, unknown> = {
    mimeType: config.mimeType,
    sizeBytes: String(sizeBytes),
    ...(config.displayName ? { displayName: config.displayName } : {}),
    ...(config.name ? { name: config.name.startsWith('files/') ? config.name : `files/${config.name}` } : {})
  }
  const startResponse = await fetch(buildGeminiUrl('upload/v1beta/files'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
      'x-goog-upload-protocol': 'resumable',
      'x-goog-upload-command': 'start',
      'x-goog-upload-header-content-length': String(sizeBytes),
      'x-goog-upload-header-content-type': config.mimeType,
      ...(uploadFileName ? { 'x-goog-upload-file-name': uploadFileName } : {})
    },
    body: JSON.stringify({ file: fileMetadata }),
    ...(config.abortSignal ? { signal: config.abortSignal } : {})
  })
  if (!startResponse.ok) {
    const parsed = parseJsonOrText(await startResponse.text())
    throw new GeminiRestError(formatGeminiErrorMessage(parsed, startResponse.status), startResponse.status, startResponse.headers, parsed)
  }
  const uploadUrl = startResponse.headers.get('x-goog-upload-url')
  if (!uploadUrl) {
    throw new Error('Failed to get Gemini upload URL. Server did not return x-goog-upload-url.')
  }

  let offset = 0
  let finalResponse: Response | undefined
  while (offset < sizeBytes) {
    const chunkSize = Math.min(GEMINI_UPLOAD_CHUNK_BYTES, sizeBytes - offset)
    const command = offset + chunkSize >= sizeBytes ? 'upload, finalize' : 'upload'
    const chunk = await file.slice(offset, offset + chunkSize).arrayBuffer()
    finalResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'x-goog-upload-command': command,
        'x-goog-upload-offset': String(offset),
        'x-goog-upload-file-name': uploadFileName,
        'content-length': String(chunkSize)
      },
      body: chunk,
      ...(config.abortSignal ? { signal: config.abortSignal } : {})
    })
    if (!finalResponse.ok) {
      const parsed = parseJsonOrText(await finalResponse.text())
      throw new GeminiRestError(formatGeminiErrorMessage(parsed, finalResponse.status), finalResponse.status, finalResponse.headers, parsed)
    }
    offset += chunkSize
    const uploadStatus = finalResponse.headers.get('x-goog-upload-status')
    if (uploadStatus !== 'active') {
      break
    }
  }

  if (!finalResponse) {
    throw new Error('Gemini Files API upload did not upload any content.')
  }
  const uploadStatus = finalResponse.headers.get('x-goog-upload-status')
  const finalText = await finalResponse.text()
  const parsed = parseJsonOrText(finalText)
  if (uploadStatus !== 'final') {
    throw new Error('Failed to upload Gemini file: upload status is not finalized.')
  }
  if (typeof parsed === 'string') {
    throw new AppError(`Gemini Files API upload returned invalid JSON: ${parsed.slice(0, 500)}`, {
      kind: 'validation',
      status: finalResponse.status,
      metadata: {
        body: finalText,
        rawResponse: finalText
      }
    })
  }
  if (isRecord(parsed) && isRecord(parsed['file'])) {
    return parsed['file'] as GeminiFile
  }
  throw new Error('Gemini Files API upload did not return file metadata.')
}

export const getGeminiFileState = (file: unknown): string | undefined => {
  if (!isRecord(file)) {
    return undefined
  }
  const state = file['state']
  if (typeof state === 'string') {
    return state.toUpperCase()
  }
  if (isRecord(state) && typeof state['name'] === 'string') {
    return state['name'].toUpperCase()
  }
  return undefined
}

export const geminiGetFile = async (
  apiKey: string,
  name: string
): Promise<GeminiFile> => {
  const { json } = await geminiJsonRequest(apiKey, `files/${encodeURIComponent(extractGeminiFileName(name))}`, {
    method: 'GET'
  })
  return isRecord(json) ? json as GeminiFile : {}
}

export const geminiDeleteFile = async (
  apiKey: string,
  name: string
): Promise<void> => {
  await geminiJsonRequest(apiKey, `files/${encodeURIComponent(extractGeminiFileName(name))}`, {
    method: 'DELETE'
  })
}

export const geminiDownloadFile = async (
  apiKey: string,
  file: string | GeminiVideo | GeminiGeneratedVideo,
  downloadPath: string
): Promise<void> => {
  const inlineVideoBytes = extractInlineVideoBytes(file)
  if (inlineVideoBytes) {
    await Bun.write(downloadPath, Buffer.from(inlineVideoBytes, 'base64'))
    return
  }
  const name = extractGeminiFileNameFromFile(file)
  const response = await geminiBinaryRequest(apiKey, `files/${encodeURIComponent(name)}:download`, { alt: 'media' })
  await Bun.write(downloadPath, response.bytes)
}

const extractInlineVideoBytes = (file: string | GeminiVideo | GeminiGeneratedVideo): string | undefined => {
  if (typeof file === 'string') {
    return undefined
  }
  if ('videoBytes' in file && typeof file.videoBytes === 'string') {
    return file.videoBytes
  }
  if ('video' in file && isRecord(file.video) && typeof file.video['videoBytes'] === 'string') {
    return file.video['videoBytes']
  }
  return undefined
}

const extractGeminiFileNameFromFile = (file: string | GeminiVideo | GeminiGeneratedVideo): string => {
  if (typeof file === 'string') {
    return extractGeminiFileName(file)
  }
  if ('uri' in file && typeof file.uri === 'string') {
    return extractGeminiFileName(file.uri)
  }
  if ('video' in file && isRecord(file.video) && typeof file.video['uri'] === 'string') {
    return extractGeminiFileName(file.video['uri'])
  }
  throw new Error('Could not extract Gemini file name from generated media.')
}

const extractGeminiFileName = (name: string): string => {
  if (name.startsWith('https://')) {
    const suffix = name.split('files/')[1]
    const match = suffix?.match(/^[A-Za-z0-9_-]+/)
    if (!match) {
      throw new Error(`Could not extract Gemini file name from URI ${name}`)
    }
    return match[0] as string
  }
  if (name.startsWith('files/')) {
    return name.slice('files/'.length)
  }
  return name
}
