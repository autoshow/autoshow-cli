export type BunFetchProfileId = 'bun-fetch-default'

export type DownloadProfileId = BunFetchProfileId

export type ResolvedEngine = 'bun-fetch'

export type DownloadProfile = {
  engine: ResolvedEngine
  profileId: DownloadProfileId
  flags: string[]
}

export type DownloadFlowId =
  | 'uv-installer'
  | 'yt-dlp-binary'
  | 'whisper-model'
  | 'llama-tarball'

export type DownloadMode = 'file' | 'pipe-to-tar' | 'script-installer'

export type DownloadRequest = {
  url: string
  destination: string
  headers?: Record<string, string>
  expectedMinBytes?: number
  flowId?: DownloadFlowId
  mode?: DownloadMode
  pipeArgs?: string[]
  pipeCwd?: string
}

export type DownloadResult = {
  success: boolean
  bytes: number
  engine: ResolvedEngine
  profileId: DownloadProfileId
  durationMs: number
}
