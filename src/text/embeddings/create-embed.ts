import { env, readdir, readFile, join, isAbsolute, resolve, relative } from '@/node-utils'
import { l, err } from '@/logging'
import { ensureVectorizeIndex } from './vectorize-setup.ts'
import type { VectorizeVector } from '@/types'

const MAX_METADATA_BYTES = 10240
const SAFE_CONTENT_CHARS = 8000

async function getAllMarkdownFiles(dir: string): Promise<string[]> {
  const p = '[text/embeddings/create-embed]'
  l.dim(`${p} Scanning directory: ${dir}`)
  
  const dirEntries = await readdir(dir, { withFileTypes: true })
  const mdFiles: string[] = []

  await Promise.all(
    dirEntries.map(async (entry) => {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        const nestedFiles = await getAllMarkdownFiles(fullPath)
        mdFiles.push(...nestedFiles)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        mdFiles.push(fullPath)
      }
    })
  )

  l.dim(`${p} Found ${mdFiles.length} markdown files`)
  return mdFiles
}

function validateMetadataSize(metadata: Record<string, any>, vectorId: string): boolean {
  const p = '[text/embeddings/create-embed]'
  
  const metadataJson = JSON.stringify(metadata)
  const metadataBytes = new TextEncoder().encode(metadataJson).length
  
  l.dim(`${p} Vector ${vectorId} metadata size: ${metadataBytes} bytes`)
  
  if (metadataBytes > MAX_METADATA_BYTES) {
    err(`${p} Metadata for vector ${vectorId} exceeds ${MAX_METADATA_BYTES} bytes: ${metadataBytes} bytes`)
    return false
  }
  
  return true
}

function truncateContentSafely(content: string, filename: string): string {
  const p = '[text/embeddings/create-embed]'
  
  if (content.length <= SAFE_CONTENT_CHARS) {
    return content
  }
  
  l.dim(`${p} Truncating content for ${filename}: ${content.length} → ${SAFE_CONTENT_CHARS} characters`)
  
  let truncated = content.substring(0, SAFE_CONTENT_CHARS)
  
  const lastPeriod = truncated.lastIndexOf('.')
  const lastNewline = truncated.lastIndexOf('\n')
  const lastSpace = truncated.lastIndexOf(' ')
  
  const bestCutoff = Math.max(lastPeriod, lastNewline, lastSpace)
  
  if (bestCutoff > SAFE_CONTENT_CHARS * 0.8) {
    truncated = truncated.substring(0, bestCutoff + 1)
    l.dim(`${p} Found natural break point at position ${bestCutoff}`)
  }
  
  return truncated
}

async function createEmbeddingVector(text: string, accountId: string, apiToken: string): Promise<number[]> {
  const p = '[text/embeddings/create-embed]'
  
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/baai/bge-m3`
  
  l.dim(`${p} Creating embedding using bge-m3 model`)
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    let errorData
    try {
      errorData = JSON.parse(errorText)
      if (errorData.errors?.[0]?.message) {
        throw new Error(`Workers AI embedding error: ${errorData.errors[0].message}`)
      }
    } catch (e) {
      l.dim(`${p} Failed to parse error response`)
    }
    throw new Error(`Workers AI embedding API error: ${response.status} - ${errorText}`)
  }
  
  const json = await response.json() as { 
    result?: { 
      data?: number[][],
      shape?: number[] 
    },
    success?: boolean,
    errors?: Array<{ message: string }>
  }
  
  l.dim(`${p} Embedding API response received`)
  
  if (!json.success || !json.result?.data?.[0]) {
    const errorMsg = json.errors?.[0]?.message || 'Unknown embedding error'
    throw new Error(`Workers AI embedding failed: ${errorMsg}`)
  }
  
  return json.result.data[0]
}

async function uploadToVectorize(vectors: VectorizeVector[], accountId: string, apiToken: string, indexName: string): Promise<void> {
  const p = '[text/embeddings/create-embed]'
  
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${indexName}/upsert`
  
  l.dim(`${p} Uploading ${vectors.length} vectors to Vectorize index: ${indexName}`)
  
  for (const vector of vectors) {
    if (!validateMetadataSize(vector.metadata || {}, vector.id)) {
      throw new Error(`Vector ${vector.id} metadata exceeds size limit. Consider reducing content size or implementing chunking.`)
    }
  }
  
  const ndjsonContent = vectors.map(v => JSON.stringify(v)).join('\n')
  
  l.dim(`${p} Upload payload size: ${new TextEncoder().encode(ndjsonContent).length} bytes`)
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/x-ndjson'
    },
    body: ndjsonContent
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    let errorData
    try {
      errorData = JSON.parse(errorText)
      if (errorData.errors?.[0]?.message) {
        const errorMsg = errorData.errors[0].message
        if (errorMsg.includes('oversized metadata')) {
          throw new Error(`Vectorize metadata size error: ${errorMsg}\n\nThis usually means the content is too large. Try processing smaller files or implementing document chunking.`)
        }
        throw new Error(`Vectorize upload error: ${errorMsg}`)
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('Vectorize metadata size error')) {
        throw e
      }
      l.dim(`${p} Failed to parse error response`)
    }
    throw new Error(`Vectorize upload API error: ${response.status} - ${errorText}`)
  }
  
  const responseData = await response.json() as { 
    result?: { mutationId?: string },
    success?: boolean 
  }
  
  if (responseData.result?.mutationId) {
    l.dim(`${p} Upload completed with mutation ID: ${responseData.result.mutationId}`)
  }
  
  l.success(`Successfully uploaded ${vectors.length} vectors to Vectorize`)
  
  l.dim(`${p} Waiting for vectors to be indexed...`)
  await new Promise(resolve => setTimeout(resolve, 5000))
}

export async function createEmbeds(customDir?: string): Promise<void> {
  const p = '[text/embeddings/create-embed]'
  l.step(`\nCreating Embeddings from Markdown Files\n`)
  
  const baseDir = customDir
    ? (isAbsolute(customDir) ? customDir : resolve(process.cwd(), customDir))
    : resolve(process.cwd(), 'content')
  
  l.dim(`${p} Base directory: ${baseDir}`)
  
  const cloudflareAccountId = env['CLOUDFLARE_ACCOUNT_ID']
  if (!cloudflareAccountId) {
    throw new Error('Please set the CLOUDFLARE_ACCOUNT_ID environment variable.')
  }
  
  const cloudflareApiToken = env['CLOUDFLARE_API_TOKEN']
  if (!cloudflareApiToken) {
    throw new Error('Please set the CLOUDFLARE_API_TOKEN environment variable.')
  }
  
  const indexName = env['VECTORIZE_INDEX_NAME'] || 'autoshow-embeddings'
  l.dim(`${p} Using Vectorize index: ${indexName}`)
  l.dim(`${p} Using Workers AI model: @cf/baai/bge-m3 (1024 dimensions)`)
  l.dim(`${p} Content truncation limit: ${SAFE_CONTENT_CHARS} characters`)
  l.dim(`${p} Metadata size limit: ${MAX_METADATA_BYTES} bytes`)
  
  try {
    l.dim(`${p} Ensuring Vectorize index exists`)
    await ensureVectorizeIndex(indexName, 1024)
  } catch (error) {
    err(`${p} Failed to ensure Vectorize index: ${error}`)
    err('Please check your Cloudflare credentials and permissions')
    err('Run: npm run as -- text cloudflare test-token')
    throw error
  }
  
  let mdFiles: string[] = []
  try {
    mdFiles = await getAllMarkdownFiles(baseDir)
    if (!mdFiles.length) {
      l.warn(`No .md files found in ${baseDir}`)
      return
    }
    l.success(`Found ${mdFiles.length} markdown files to process`)
  } catch (error) {
    err(`${p} Error reading directory: ${baseDir} - ${error}`)
    throw error
  }
  
  const vectors: VectorizeVector[] = []
  const batchSize = 10
  let skippedFiles = 0
  
  l.dim(`${p} Processing files in batches of ${batchSize}`)
  
  for (let i = 0; i < mdFiles.length; i += batchSize) {
    const batch = mdFiles.slice(i, i + batchSize)
    l.dim(`${p} Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(mdFiles.length / batchSize)}`)
    
    await Promise.all(
      batch.map(async (filePath, batchIndex) => {
        const content = await readFile(filePath, 'utf8')
        const fileNameForLog = relative(process.cwd(), filePath)
        
        try {
          l.dim(`${p} Creating embedding for: ${fileNameForLog}`)
          
          const truncatedContent = truncateContentSafely(content, fileNameForLog)
          
          const metadata = {
            filename: fileNameForLog,
            content: truncatedContent,
            fullPath: filePath
          }
          
          const vectorId = `${Date.now()}-${i + batchIndex}`
          
          if (!validateMetadataSize(metadata, vectorId)) {
            l.warn(`Skipping ${fileNameForLog} due to metadata size limit`)
            skippedFiles++
            return
          }
          
          const embedding = await createEmbeddingVector(truncatedContent, cloudflareAccountId, cloudflareApiToken)
          
          vectors.push({
            id: vectorId,
            values: embedding,
            metadata
          })
          
          l.success(`Created embedding for: ${fileNameForLog}`)
        } catch (error) {
          err(`${p} Error creating embedding for ${filePath}: ${error}`)
          skippedFiles++
        }
      })
    )
    
    l.dim(`${p} Completed batch ${Math.min(i + batchSize, mdFiles.length)}/${mdFiles.length}`)
  }
  
  if (vectors.length > 0) {
    l.dim(`${p} Uploading ${vectors.length} vectors to Vectorize...`)
    
    const uploadBatchSize = 100
    for (let i = 0; i < vectors.length; i += uploadBatchSize) {
      const batch = vectors.slice(i, i + uploadBatchSize)
      l.dim(`${p} Uploading batch ${Math.floor(i / uploadBatchSize) + 1} of ${Math.ceil(vectors.length / uploadBatchSize)}`)
      await uploadToVectorize(batch, cloudflareAccountId, cloudflareApiToken, indexName)
      l.dim(`${p} Uploaded batch ${Math.min(i + uploadBatchSize, vectors.length)}/${vectors.length}`)
    }
    
    l.success(`\nSuccessfully created and uploaded ${vectors.length} embeddings to Vectorize index "${indexName}"`)
    
    if (skippedFiles > 0) {
      l.warn(`${skippedFiles} files were skipped due to size constraints`)
      l.warn('Consider implementing document chunking for large files')
    }
    
    l.success('Embeddings are ready for querying!')
  } else {
    l.warn('No embeddings were created')
    if (skippedFiles > 0) {
      err(`All ${skippedFiles} files were skipped due to size constraints`)
      err('Try reducing file sizes or implementing document chunking')
    }
  }
}