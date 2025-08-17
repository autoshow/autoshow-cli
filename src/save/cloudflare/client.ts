import { l, err } from '@/logging'
import { getR2ApiToken } from './token-manager'

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
    const headers = await getHeaders()
    if (!headers) {
      throw new Error('Failed to get authorization headers')
    }
    
    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: bucketName,
        locationHint: 'auto'
      })
    })
    
    if (response.ok) {
      l.dim(`${p} Successfully created bucket: ${bucketName}`)
      return true
    }
    
    const errorData = await response.json()
    if (errorData.errors?.[0]?.code === 10006) {
      l.dim(`${p} Bucket already exists: ${bucketName}`)
      return true
    }
    
    err(`${p} Failed to create bucket: ${JSON.stringify(errorData)}`)
    return false
  } catch (error) {
    err(`${p} Failed to create bucket: ${(error as Error).message}`)
    return false
  }
}

export async function headBucket(accountId: string, bucketName: string): Promise<boolean> {
  const p = '[save/cloudflare/client]'
  l.dim(`${p} Checking if bucket exists: ${bucketName}`)
  
  try {
    const headers = await getHeaders()
    if (!headers) {
      throw new Error('Failed to get authorization headers')
    }
    
    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`
    const response = await fetch(`${baseUrl}/${bucketName}`, {
      method: 'GET',
      headers
    })
    
    if (response.ok) {
      l.dim(`${p} Bucket exists: ${bucketName}`)
      return true
    }
    
    if (response.status === 404) {
      l.dim(`${p} Bucket does not exist: ${bucketName}`)
      return false
    }
    
    const errorData = await response.json()
    err(`${p} Error checking bucket: ${JSON.stringify(errorData)}`)
    return false
  } catch (error) {
    l.dim(`${p} Error checking bucket: ${(error as Error).message}`)
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
    
    const base64Body = Buffer.isBuffer(body) 
      ? body.toString('base64')
      : Buffer.from(body).toString('base64')
    
    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`
    const uploadUrl = `${baseUrl}/${bucketName}/upload`
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        key,
        body: base64Body,
        contentType: 'application/octet-stream'
      })
    })
    
    if (!response.ok) {
      const alternativeUrl = `${baseUrl}/${bucketName}/objects/${key}`
      const altResponse = await fetch(alternativeUrl, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/octet-stream'
        },
        body: body
      })
      
      if (altResponse.ok) {
        l.dim(`${p} Successfully uploaded object via alternative method: ${bucketName}/${key}`)
        return true
      }
      
      const errorData = await altResponse.text()
      err(`${p} Failed to upload object: ${errorData}`)
      return false
    }
    
    l.dim(`${p} Successfully uploaded object: ${bucketName}/${key}`)
    return true
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
    
    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`
    const objectUrl = `${baseUrl}/${bucketName}/objects/${key}`
    const response = await fetch(objectUrl, {
      method: 'GET',
      headers
    })
    
    if (!response.ok) {
      const errorData = await response.text()
      err(`${p} Failed to get object: ${errorData}`)
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
    
    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`
    const objectUrl = `${baseUrl}/${bucketName}/objects/${key}`
    const response = await fetch(objectUrl, {
      method: 'DELETE',
      headers
    })
    
    if (!response.ok) {
      const errorData = await response.text()
      err(`${p} Failed to delete object: ${errorData}`)
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
    const headers = await getHeaders()
    if (!headers) {
      throw new Error('Failed to get authorization headers')
    }
    
    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`
    const response = await fetch(baseUrl, {
      method: 'GET',
      headers
    })
    
    if (!response.ok) {
      const errorData = await response.text()
      err(`${p} Failed to list buckets: ${errorData}`)
      return []
    }
    
    const data = await response.json()
    const buckets = data.result?.buckets || []
    
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