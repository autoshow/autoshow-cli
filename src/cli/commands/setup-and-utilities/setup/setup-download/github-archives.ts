import { rm } from 'node:fs/promises'
import { downloadFile } from './download'
import type { DownloadFlowId } from '~/types'

export type GithubArchiveOptions = {
  owner: string
  repo: string
  ref: string
}

export type DownloadGithubArchiveOptions = GithubArchiveOptions & {
  destination: string
  stripComponents?: number
  flowId?: DownloadFlowId
}

const encodePathSegment = (value: string): string => encodeURIComponent(value).replace(/%2F/g, '/')

export const buildGithubArchiveUrl = ({ owner, repo, ref }: GithubArchiveOptions): string =>
  `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/archive/refs/tags/${encodePathSegment(ref)}.tar.gz`

export const buildGithubCommitArchiveUrl = ({ owner, repo, ref }: GithubArchiveOptions): string =>
  `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/archive/${encodePathSegment(ref)}.tar.gz`

export const downloadGithubArchive = async (options: DownloadGithubArchiveOptions): Promise<void> => {
  await rm(options.destination, { recursive: true, force: true })
  await downloadFile({
    url: buildGithubArchiveUrl(options),
    destination: options.destination,
    mode: 'tar-gz',
    stripComponents: options.stripComponents ?? 1,
    ...(options.flowId ? { flowId: options.flowId } : {})
  })
}

export const downloadGithubCommitArchive = async (options: DownloadGithubArchiveOptions): Promise<void> => {
  await rm(options.destination, { recursive: true, force: true })
  await downloadFile({
    url: buildGithubCommitArchiveUrl(options),
    destination: options.destination,
    mode: 'tar-gz',
    stripComponents: options.stripComponents ?? 1,
    ...(options.flowId ? { flowId: options.flowId } : {})
  })
}
