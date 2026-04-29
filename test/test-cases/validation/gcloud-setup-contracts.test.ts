import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { setupGcloudStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gcloud/gcloud'
import { ensureGcloudDocaiSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/gcloud-docai/gcloud-docai'
import type { AutoshowConfig } from '~/types'

const tempDirs: string[] = []
const previousEnv: Record<string, string | undefined> = {}
const envKeys = [
  'AUTOSHOW_GCLOUD_BIN',
  'AUTOSHOW_GCLOUD_PROJECT',
  'AUTOSHOW_GCLOUD_DOCAI_LOCATION',
  'AUTOSHOW_GCLOUD_DOCAI_OCR_PROCESSOR_ID',
  'AUTOSHOW_GCLOUD_BUCKET'
]
const originalFetch = globalThis.fetch

const writeFakeGcloud = async (dir: string): Promise<{ bin: string, log: string }> => {
  const bin = join(dir, 'gcloud')
  const log = join(dir, 'gcloud.log')
  const projectFile = join(dir, 'project.txt')
  const servicesFile = join(dir, 'services.txt')
  await writeFile(projectFile, '')
  await writeFile(servicesFile, '')
  await writeFile(log, '')
  await writeFile(bin, `#!/bin/sh
echo "$@" >> "${log}"
if [ "$1 $2" = "auth print-access-token" ]; then
  echo "token-123"
  exit 0
fi
if [ "$1 $2 $3" = "config get-value project" ]; then
  cat "${projectFile}"
  exit 0
fi
if [ "$1 $2 $3" = "config set project" ]; then
  echo "$4" > "${projectFile}"
  exit 0
fi
if [ "$1 $2" = "projects describe" ]; then
  echo "$3"
  exit 0
fi
if [ "$1 $2 $3" = "billing projects describe" ]; then
  echo '{"billingAccountName":"billingAccounts/000000-000000-000000","billingEnabled":true}'
  exit 0
fi
if [ "$1 $2" = "services list" ]; then
  filter=""
  for arg in "$@"; do
    case "$arg" in
      --filter=config.name=*) filter="\${arg#--filter=config.name=}" ;;
      --filter=config.name:*) filter="\${arg#--filter=config.name:}" ;;
    esac
  done
  if grep -qx "$filter" "${servicesFile}"; then
    echo "$filter"
  fi
  exit 0
fi
if [ "$1 $2" = "services enable" ]; then
  echo "$3" >> "${servicesFile}"
  exit 0
fi
if [ "$1 $2 $3" = "storage buckets create" ]; then
  exit 0
fi
if [ "$1 $2" = "storage ls" ]; then
  exit 0
fi
exit 1
`)
  await chmod(bin, 0o755)
  return { bin, log }
}

beforeEach(() => {
  for (const key of envKeys) {
    previousEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(async () => {
  for (const key of envKeys) {
    if (previousEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = previousEnv[key]
    }
  }
  globalThis.fetch = originalFetch
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('gcloud setup contracts', () => {
  test('enables STT, Document AI, and Storage without writing AutoShow config', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-gcloud-setup-'))
    tempDirs.push(dir)
    const configPath = join(dir, 'autoshow.json')
    const { bin, log } = await writeFakeGcloud(dir)
    process.env['AUTOSHOW_GCLOUD_BIN'] = bin

    const fetchCalls: Array<{ url: string, method: string }> = []
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString()
      fetchCalls.push({ url, method: init?.method ?? 'GET' })
      if (init?.method === 'POST') {
        return Response.json({ name: 'projects/test-project/locations/us/processors/processor-created' })
      }
      return Response.json({ processors: [] })
    }) as typeof fetch

    await setupGcloudStt({
      focused: true,
      preferredProject: 'test-project',
      configPathOverride: configPath
    })

    const commands = await readFile(log, 'utf8')
    expect(commands).toContain('services enable speech.googleapis.com')
    expect(commands).toContain('services enable documentai.googleapis.com')
    expect(commands).toContain('services enable storage.googleapis.com')
    expect(commands).toContain('storage buckets create gs://autoshow-docai-test-project-')
    expect(fetchCalls).toContainEqual(expect.objectContaining({ method: 'POST' }))
    expect(await Bun.file(configPath).exists()).toBe(false)
    await expect(loadConfig(configPath)).resolves.toEqual({ version: 2 })
  })

  test('reuses saved Document AI processor and bucket values without changing config', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-gcloud-setup-saved-'))
    tempDirs.push(dir)
    const configPath = join(dir, 'autoshow.json')
    const { bin, log } = await writeFakeGcloud(dir)
    process.env['AUTOSHOW_GCLOUD_BIN'] = bin
    const savedConfig: AutoshowConfig = {
      version: 2,
      defaults: {
        extract: {
          stt: { gcloudStt: ['chirp_3'] },
          ocr: {
            gcloudDocai: ['ocr'],
            gcloudDocaiLocation: 'us',
            gcloudDocaiOcrProcessorId: 'saved-processor',
            gcloudDocaiLayoutProcessorId: 'saved-layout-processor',
            gcloudDocaiBucket: 'saved-bucket'
          }
        }
      }
    }
    await writeFile(configPath, JSON.stringify(savedConfig, null, 2))

    const fetchCalls: string[] = []
    globalThis.fetch = (async (input: string | URL | Request) => {
      fetchCalls.push(input.toString())
      return Response.json({ processors: [] })
    }) as typeof fetch

    await setupGcloudStt({
      focused: true,
      preferredProject: 'test-project',
      configPathOverride: configPath
    })

    const commands = await readFile(log, 'utf8')
    expect(commands).toContain('storage ls gs://saved-bucket')
    expect(commands).not.toContain('storage buckets create')
    expect(fetchCalls).toHaveLength(0)
    await expect(loadConfig(configPath)).resolves.toMatchObject({
      defaults: {
        extract: {
          ocr: {
            gcloudDocaiOcrProcessorId: 'saved-processor',
            gcloudDocaiLayoutProcessorId: 'saved-layout-processor',
            gcloudDocaiBucket: 'saved-bucket'
          }
        }
      }
    })
    await expect(loadConfig(configPath)).resolves.toEqual(savedConfig)
  })

  test('Document AI runtime keeps environment override compatibility', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-gcloud-runtime-env-'))
    tempDirs.push(dir)
    const { bin } = await writeFakeGcloud(dir)
    process.env['AUTOSHOW_GCLOUD_BIN'] = bin
    process.env['AUTOSHOW_GCLOUD_PROJECT'] = 'env-project'
    process.env['AUTOSHOW_GCLOUD_DOCAI_LOCATION'] = 'eu'
    process.env['AUTOSHOW_GCLOUD_DOCAI_OCR_PROCESSOR_ID'] = 'env-processor'
    process.env['AUTOSHOW_GCLOUD_BUCKET'] = 'env-bucket'

    await expect(ensureGcloudDocaiSetup('ocr')).resolves.toMatchObject({
      projectId: 'env-project',
      location: 'eu',
      processorId: 'env-processor',
      bucket: 'env-bucket'
    })
  })
})
