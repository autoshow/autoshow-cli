import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export type MockFetchCall = {
  url: string
  method: string
  headers: Headers
  bodyText: string
  bodyJson?: Record<string, unknown> | undefined
  bodyBytes?: number | undefined
  form?: FormData | undefined
}

export type MockFetchHandler = (
  call: MockFetchCall,
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
) => Promise<Response> | Response

export const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init?.headers as Record<string, string> | undefined)
    }
  })

export const bytesResponse = (
  body: Uint8Array,
  init?: ResponseInit
): Response => new Response(body, init)

const readMockFetchBody = async (
  body: RequestInit['body'] | null | undefined
): Promise<{ text: string, bytes?: number | undefined, form?: FormData | undefined }> => {
  if (typeof body === 'string') {
    return { text: body }
  }
  if (body instanceof FormData) {
    return { text: '', form: body }
  }
  if (body instanceof ArrayBuffer) {
    return { text: '', bytes: body.byteLength }
  }
  if (ArrayBuffer.isView(body)) {
    return { text: '', bytes: body.byteLength }
  }
  if (body instanceof Blob) {
    return { text: '', bytes: body.size }
  }
  return { text: '' }
}

export const installMockFetch = (handler: MockFetchHandler): MockFetchCall[] => {
  const calls: MockFetchCall[] = []
  globalThis.fetch = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ): Promise<Response> => {
    const { text, bytes, form } = await readMockFetchBody(init?.body)
    const call: MockFetchCall = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      bodyText: text,
      ...(text.trim().startsWith('{') ? { bodyJson: JSON.parse(text) as Record<string, unknown> } : {}),
      ...(bytes !== undefined ? { bodyBytes: bytes } : {}),
      ...(form ? { form } : {})
    }
    calls.push(call)
    return await handler(call, input, init)
  }) as typeof fetch
  return calls
}

export type EnvSnapshot = Record<string, string | undefined>

export const snapshotEnv = (keys: readonly string[]): EnvSnapshot =>
  Object.fromEntries(keys.map((key) => [key, process.env[key]]))

export const clearEnv = (keys: readonly string[]): void => {
  for (const key of keys) {
    delete process.env[key]
  }
}

export const restoreEnv = (snapshot: EnvSnapshot): void => {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

export const createTempDirTracker = (
  defaultPrefix: string
): {
  make: (prefix?: string) => Promise<string>
  withDir: <T>(fn: (dir: string) => Promise<T>, prefix?: string) => Promise<T>
  cleanup: () => Promise<void>
} => {
  const tempDirs: string[] = []

  const make = async (prefix = defaultPrefix): Promise<string> => {
    const dir = await mkdtemp(join(tmpdir(), prefix))
    tempDirs.push(dir)
    return dir
  }

  return {
    make,
    withDir: async <T,>(fn: (dir: string) => Promise<T>, prefix?: string): Promise<T> =>
      await fn(await make(prefix)),
    cleanup: async (): Promise<void> => {
      await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
    }
  }
}
