type BunFetchProfileId = 'bun-fetch-default'

export type DownloadProfileId = BunFetchProfileId

type ResolvedEngine = 'bun-fetch'

export type DownloadProfile = {
  engine: ResolvedEngine
  profileId: DownloadProfileId
  flags: string[]
}

export type DownloadFlowId =
  | 'uv-release'
  | 'yt-dlp-binary'
  | 'whisper-model'
  | 'llama-tarball'
  | 'whisper-source'
  | 'reverb-source'
  | 'reverb-model'

type DownloadMode = 'file' | 'tar-gz'

export type DownloadRequest = {
  url: string
  destination: string
  headers?: Record<string, string>
  expectedMinBytes?: number
  flowId?: DownloadFlowId
  mode?: DownloadMode
  stripComponents?: number
}

export type DownloadResult = {
  success: boolean
  bytes: number
  engine: ResolvedEngine
  profileId: DownloadProfileId
  durationMs: number
}
