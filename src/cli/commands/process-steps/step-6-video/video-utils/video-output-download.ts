import { classifyFetchRetry, withRetry } from '~/utils/retries'

class VideoOutputDownloadHttpError extends Error {
  status: number
  headers: Headers

  constructor(providerLabel: string, status: number, headers: Headers) {
    super(`${providerLabel} video download failed (${status})`)
    this.name = 'VideoOutputDownloadHttpError'
    this.status = status
    this.headers = headers
  }
}

export const downloadVideoOutputBytes = async (
  videoUrl: string,
  providerLabel: string
): Promise<Uint8Array> =>
  await withRetry(
    {
      operationName: `${providerLabel.toLowerCase()}-video-download`,
      retryClass: 'runtime_http_read'
    },
    async (signal) => {
      const response = await fetch(videoUrl, signal ? { signal } : undefined)
      if (!response.ok) {
        throw new VideoOutputDownloadHttpError(providerLabel, response.status, response.headers)
      }
      return new Uint8Array(await response.arrayBuffer())
    },
    (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
  )
