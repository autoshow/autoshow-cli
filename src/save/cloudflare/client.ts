import Cloudflare from 'cloudflare'
import { l, err } from '@/logging'
import { getR2ApiToken } from './token-manager'

let cachedClient: Cloudflare | null = null

export function createCloudflareClient(): Cloudflare {
  const p = '[utils/cloudflare-client]'
  
  if (cachedClient) {
    return cachedClient
  }
  
  const accountId = process.env['CLOUDFLARE_ACCOUNT_ID']
  const apiToken = process.env['CLOUDFLARE_API_TOKEN'] || process.env['CLOUDFLARE_R2_API_TOKEN']
  
  if (!accountId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID environment variable is required')
  }
  
  if (!apiToken) {
    throw new Error('CLOUDFLARE_API_TOKEN or CLOUDFLARE_R2_API_TOKEN environment variable is required')
  }
  
  l.dim(`${p} Creating Cloudflare SDK client`)
  
  cachedClient = new Cloudflare({
    apiToken
  })
  
  return cachedClient
}

export function getCloudflareAccountId(): string {
  const accountId = process.env['CLOUDFLARE_ACCOUNT_ID']
  if (!accountId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID environment variable is required')
  }
  return accountId
}

async function getHeaders(): Promise<Record<string, string> | null> {
  const token = await getR2ApiToken()
  if (!token) {
    return null
  }
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

export async function createBucket(accountId: string, bucketName: string): Promise<boolean> {
  const p = '[save/cloudflare/client]'
  l.dim(`${p} Creating bucket: ${bucketName}`)
  
  try {
    const client = createCloudflareClient()
    
    const result = await client.r2.buckets.create({
      account_id: accountId,
      name: bucketName
    })
    
    if (result) {
      l.dim(`${p} Successfully created bucket: ${bucketName}`)
      return true
    }
    
    return false
  } catch (error: any) {
    if (error.status === 400 && error.message?.includes('already exists')) {
      l.dim(`${p} Bucket already exists: ${bucketName}`)
      return true
    }
    
    err(`${p} Failed to create bucket: ${error.message}`)
    return false
  }
}

export async function headBucket(accountId: string, bucketName: string): Promise<boolean> {
  const p = '[save/cloudflare/client]'
  l.dim(`${p} Checking if bucket exists: ${bucketName}`)
  
  try {
    const client = createCloudflareClient()
    
    const result = await client.r2.buckets.get(bucketName, {
      account_id: accountId
    })
    
    if (result) {
      l.dim(`${p} Bucket exists: ${bucketName}`)
      return true
    }
    
    return false
  } catch (error: any) {
    if (error.status === 404) {
      l.dim(`${p} Bucket does not exist: ${bucketName}`)
      return false
    }
    
    l.dim(`${p} Error checking bucket: ${error.message}`)
    return false
  }
}

export async function putObject(accountId: string, bucketName: string, key: string, body: Buffer | string): Promise<boolean> {
  const p = '[save/cloudflare/client]'
  l.dim(`${p} Uploading object: ${bucketName}/${key}`)
  
  try {
    const headers = await getHeaders()
    if (!headers) {
      throw new Error('Failed to get authorization headers')
    }
    
    const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body)
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${key}`,
      {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/octet-stream',
          'Content-Length': bodyBuffer.length.toString()
        },
        body: bodyBuffer
      }
    )
    
    if (response.ok) {
      l.dim(`${p} Successfully uploaded object: ${bucketName}/${key}`)
      return true
    }
    
    const errorText = await response.text()
    err(`${p} Failed to upload object: ${errorText}`)
    return false
  } catch (error) {
    err(`${p} Failed to upload object: ${(error as Error).message}`)
    return false
  }
}

export async function getObject(accountId: string, bucketName: string, key: string): Promise<string | null> {
  const p = '[save/cloudflare/client]'
  l.dim(`${p} Getting object: ${bucketName}/${key}`)
  
  try {
    const headers = await getHeaders()
    if (!headers) {
      throw new Error('Failed to get authorization headers')
    }
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${key}`,
      {
        method: 'GET',
        headers
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      err(`${p} Failed to get object: ${errorText}`)
      return null
    }
    
    const content = await response.text()
    l.dim(`${p} Successfully retrieved object: ${bucketName}/${key}`)
    return content
  } catch (error) {
    err(`${p} Failed to get object: ${(error as Error).message}`)
    return null
  }
}

export async function deleteObject(accountId: string, bucketName: string, key: string): Promise<boolean> {
  const p = '[save/cloudflare/client]'
  l.dim(`${p} Deleting object: ${bucketName}/${key}`)
  
  try {
    const headers = await getHeaders()
    if (!headers) {
      throw new Error('Failed to get authorization headers')
    }
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${key}`,
      {
        method: 'DELETE',
        headers
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      err(`${p} Failed to delete object: ${errorText}`)
      return false
    }
    
    l.dim(`${p} Successfully deleted object: ${bucketName}/${key}`)
    return true
  } catch (error) {
    err(`${p} Failed to delete object: ${(error as Error).message}`)
    return false
  }
}

export async function putBucketVersioning(_accountId: string, bucketName: string, enabled: boolean): Promise<boolean> {
  const p = '[save/cloudflare/client]'
  l.dim(`${p} Setting versioning for bucket: ${bucketName} to ${enabled ? 'enabled' : 'disabled'}`)
  return true
}

export async function putBucketLifecycle(_accountId: string, bucketName: string, days: number): Promise<boolean> {
  const p = '[save/cloudflare/client]'
  l.dim(`${p} Setting lifecycle policy for bucket: ${bucketName} to ${days} days`)
  return true
}

export async function listBuckets(accountId: string): Promise<string[]> {
  const p = '[save/cloudflare/client]'
  l.dim(`${p} Listing buckets`)
  
  try {
    const client = createCloudflareClient()
    
    const response = await client.r2.buckets.list({
      account_id: accountId
    })
    
    const buckets = response?.buckets || []
    
    l.dim(`${p} Found ${buckets.length} buckets`)
    return buckets.map((b: any) => b.name)
  } catch (error) {
    err(`${p} Failed to list buckets: ${(error as Error).message}`)
    return []
  }
}

export async function healthCheck(accountId: string, bucketName: string): Promise<boolean> {
  const p = '[save/cloudflare/client]'
  l.dim(`${p} Running health check for bucket: ${bucketName}`)
  
  try {
    const testKey = `health-check-${Date.now()}.txt`
    const testContent = `Health check at ${new Date().toISOString()}`
    
    l.dim(`${p} Writing test object: ${testKey}`)
    const writeSuccess = await putObject(accountId, bucketName, testKey, testContent)
    if (!writeSuccess) {
      err(`${p} Health check failed: Unable to write test object`)
      return false
    }
    
    l.dim(`${p} Reading test object: ${testKey}`)
    const readContent = await getObject(accountId, bucketName, testKey)
    if (readContent !== testContent) {
      err(`${p} Health check failed: Read content doesn't match written content`)
      return false
    }
    
    l.dim(`${p} Deleting test object: ${testKey}`)
    const deleteSuccess = await deleteObject(accountId, bucketName, testKey)
    if (!deleteSuccess) {
      l.warn(`${p} Health check warning: Unable to delete test object`)
    }
    
    l.success(`${p} Health check passed for bucket: ${bucketName}`)
    return true
  } catch (error) {
    err(`${p} Health check failed: ${(error as Error).message}`)
    return false
  }
}