import { env } from '@/node-utils'
import { l, err } from '@/logging'
import type { VectorizeIndexConfig, VectorizeIndexInfo } from '@/types'

export async function checkIndexExists(indexName: string): Promise<boolean> {
  const p = '[text/utils/vectorize-setup]'
  
  const accountId = env['CLOUDFLARE_ACCOUNT_ID']
  const apiToken = env['CLOUDFLARE_API_TOKEN']
  
  if (!accountId || !apiToken) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set')
  }
  
  try {
    l.dim(`${p} Checking if index '${indexName}' exists`)
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${indexName}`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (response.status === 404) {
      l.dim(`${p} Index '${indexName}' does not exist`)
      return false
    } else if (response.ok) {
      const data = await response.json() as { result: VectorizeIndexInfo }
      l.dim(`${p} Index '${indexName}' exists with ${data.result.config.dimensions} dimensions`)
      return true
    } else {
      const errorText = await response.text()
      throw new Error(`Failed to check index: ${response.status} - ${errorText}`)
    }
  } catch (error) {
    err(`${p} Error checking index existence: ${error}`)
    throw error
  }
}
export async function createVectorizeIndex(indexName: string, dimensions: number = 1024): Promise<void> {
  const p = '[text/utils/vectorize-setup]'
  
  const accountId = env['CLOUDFLARE_ACCOUNT_ID']
  const apiToken = env['CLOUDFLARE_API_TOKEN']
  
  if (!accountId || !apiToken) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set')
  }
  
  const indexConfig: VectorizeIndexConfig = {
    name: indexName,
    description: `Embeddings index created by AutoShow CLI using bge-m3 model`,
    config: {
      dimensions,
      metric: 'cosine'
    }
  }
  
  try {
    l.dim(`${p} Creating index '${indexName}' with ${dimensions} dimensions`)
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(indexConfig)
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
        if (errorData.errors?.[0]?.message) {
          throw new Error(`Failed to create index: ${errorData.errors[0].message}`)
        }
      } catch (e) {
        l.dim(`${p} Failed to parse error response`)
      }
      throw new Error(`Failed to create index: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json() as { result: VectorizeIndexInfo }
    l.success(`Index '${data.result.name}' created successfully`)
    l.dim(`${p} Index configuration: ${data.result.config.dimensions}D, ${data.result.config.metric} metric`)
    
    l.dim(`${p} Waiting for index to initialize...`)
    await new Promise(resolve => setTimeout(resolve, 3000))
    
  } catch (error) {
    err(`${p} Error creating index: ${error}`)
    throw error
  }
}
export async function ensureVectorizeIndex(indexName: string, dimensions: number = 1024): Promise<void> {
  const p = '[text/utils/vectorize-setup]'
  
  try {
    const exists = await checkIndexExists(indexName)
    
    if (!exists) {
      l.dim(`${p} Index does not exist, creating new index`)
      await createVectorizeIndex(indexName, dimensions)
    } else {
      l.dim(`${p} Index '${indexName}' already exists and is ready`)
    }
  } catch (error) {
    err(`${p} Error ensuring index exists: ${error}`)
    throw error
  }
}
export async function listVectorizeIndexes(): Promise<VectorizeIndexInfo[]> {
  const p = '[text/utils/vectorize-setup]'
  
  const accountId = env['CLOUDFLARE_ACCOUNT_ID']
  const apiToken = env['CLOUDFLARE_API_TOKEN']
  
  if (!accountId || !apiToken) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set')
  }
  
  try {
    l.dim(`${p} Listing all Vectorize indexes`)
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to list indexes: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json() as { result: VectorizeIndexInfo[] }
    l.dim(`${p} Found ${data.result.length} indexes`)
    return data.result
    
  } catch (error) {
    err(`${p} Error listing indexes: ${error}`)
    throw error
  }
}
export async function deleteVectorizeIndex(indexName: string): Promise<void> {
  const p = '[text/utils/vectorize-setup]'
  
  const accountId = env['CLOUDFLARE_ACCOUNT_ID']
  const apiToken = env['CLOUDFLARE_API_TOKEN']
  
  if (!accountId || !apiToken) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set')
  }
  
  try {
    l.dim(`${p} Deleting index '${indexName}'`)
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${indexName}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to delete index: ${response.status} - ${errorText}`)
    }
    
    l.success(`Index '${indexName}' deleted successfully`)
    
  } catch (error) {
    err(`${p} Error deleting index: ${error}`)
    throw error
  }
}