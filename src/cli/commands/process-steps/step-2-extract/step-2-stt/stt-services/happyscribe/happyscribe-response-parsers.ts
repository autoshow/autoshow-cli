import type {
  HappyScribeExport,
  HappyScribeOrder,
  HappyScribeTranscription
} from '~/types'
import {
  isRecord,
  normalizeHappyScribeId,
  parseHappyScribeNumber
} from './happyscribe-utils'

export const parseHappyScribeSignedUploadUrl = (payload: unknown): string => {
  if (isRecord(payload) && typeof payload['signedUrl'] === 'string' && payload['signedUrl'].length > 0) {
    return payload['signedUrl']
  }
  if (isRecord(payload) && typeof payload['signed_url'] === 'string' && payload['signed_url'].length > 0) {
    return payload['signed_url']
  }

  throw new Error('Happy Scribe signed upload response missing signedUrl')
}

export const parseHappyScribeOrder = (payload: unknown): HappyScribeOrder => {
  if (!isRecord(payload)) {
    throw new Error('Happy Scribe order response was not an object')
  }

  const id = normalizeHappyScribeId(payload['id'])
  if (!id || typeof payload['state'] !== 'string') {
    throw new Error('Happy Scribe order response missing id or state')
  }

  const details = isRecord(payload['details'])
    ? {
        ...(typeof parseHappyScribeNumber(payload['details']['total_cents']) === 'number'
          ? { totalCents: parseHappyScribeNumber(payload['details']['total_cents']) }
          : {}),
        ...(typeof parseHappyScribeNumber(payload['details']['total_credits']) === 'number'
          ? { totalCredits: parseHappyScribeNumber(payload['details']['total_credits']) }
          : {}),
        ...(typeof payload['details']['currency'] === 'string' && payload['details']['currency'].trim().length > 0
          ? { currency: payload['details']['currency'].trim().toLowerCase() }
          : {})
      }
    : undefined

  const outputsIds = Array.isArray(payload['outputsIds'])
    ? payload['outputsIds'].map(normalizeHappyScribeId).filter((value): value is string => typeof value === 'string')
    : []
  const transcriptions: HappyScribeOrder['transcriptions'] = []
  if (Array.isArray(payload['transcriptions'])) {
    for (const value of payload['transcriptions']) {
      if (!isRecord(value)) {
        continue
      }

      const transcription: HappyScribeOrder['transcriptions'][number] = {}
      const transcriptionId = normalizeHappyScribeId(value['id'])
      const transcriptionUuid = normalizeHappyScribeId(value['uuid'])
      if (transcriptionId) {
        transcription.id = transcriptionId
      }
      if (transcriptionUuid) {
        transcription.uuid = transcriptionUuid
      }
      if (typeof value['state'] === 'string') {
        transcription.state = value['state']
      }

      if (transcription.id || transcription.uuid || transcription.state) {
        transcriptions.push(transcription)
      }
    }
  }

  return {
    id,
    state: payload['state'],
    ...(details && Object.keys(details).length > 0 ? { details } : {}),
    outputsIds,
    transcriptions
  }
}

export const parseHappyScribeTranscription = (payload: unknown): HappyScribeTranscription => {
  if (!isRecord(payload)) {
    throw new Error('Happy Scribe transcription response was not an object')
  }

  const links = isRecord(payload['_links']) ? payload['_links'] : undefined
  const selfLink = links && isRecord(links['self']) ? links['self'] : undefined

  return {
    ...(normalizeHappyScribeId(payload['id']) ? { id: normalizeHappyScribeId(payload['id']) } : {}),
    ...(typeof payload['state'] === 'string' ? { state: payload['state'] } : {}),
    ...(typeof payload['failureReason'] === 'string' ? { failureReason: payload['failureReason'] } : {}),
    ...(typeof payload['failureMessage'] === 'string' ? { failureMessage: payload['failureMessage'] } : {}),
    ...(typeof parseHappyScribeNumber(payload['costInCents']) === 'number'
      ? { costInCents: parseHappyScribeNumber(payload['costInCents']) }
      : {}),
    ...(selfLink && typeof selfLink['downloadUrl'] === 'string' && selfLink['downloadUrl'].length > 0
      ? { downloadUrl: selfLink['downloadUrl'] }
      : {})
  }
}

export const parseHappyScribeExport = (payload: unknown): HappyScribeExport => {
  if (!isRecord(payload)) {
    throw new Error('Happy Scribe export response was not an object')
  }

  const id = normalizeHappyScribeId(payload['id'])
  if (!id || typeof payload['state'] !== 'string') {
    throw new Error('Happy Scribe export response missing id or state')
  }

  return {
    id,
    state: payload['state'],
    ...(typeof payload['download_link'] === 'string' && payload['download_link'].length > 0
      ? { downloadLink: payload['download_link'] }
      : {})
  }
}

export const resolveHappyScribeOrderTranscriptionId = (
  order: HappyScribeOrder
): string | undefined => {
  const finishedTranscription = order.transcriptions.find((transcription) => transcription.state === 'automatic_done')
  if (finishedTranscription?.uuid) {
    return finishedTranscription.uuid
  }
  if (finishedTranscription?.id) {
    return finishedTranscription.id
  }

  const firstTranscription = order.transcriptions[0]
  if (firstTranscription?.uuid) {
    return firstTranscription.uuid
  }
  if (firstTranscription?.id) {
    return firstTranscription.id
  }

  return order.outputsIds[0]
}

export const buildHappyScribeOrderFailureMessage = (order: HappyScribeOrder): string => {
  if (order.state === 'locked') {
    return 'Happy Scribe order is locked due to insufficient credits or balance'
  }
  return `Happy Scribe order failed while in state "${order.state}"`
}
