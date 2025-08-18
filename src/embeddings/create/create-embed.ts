import { env, readFile, isAbsolute, resolve, relative } from '@/node-utils'
import { l, err } from '@/logging'
import { ensureVectorizeIndex } from '../vectorize-setup.ts'
import { getAllMarkdownFiles, truncateContentSafely } from './file-utils.ts'
import { uploadToVectorize, validateMetadataSize } from './upload-vectorize.ts'
import type { VectorizeVector } from '@/types'

export async function createEmbeddingVector(text: string, accountId: string, apiToken: string): Promise<number[]> {
  const p = '[text/embeddings/create-embedding]'
  
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
  l.dim(`${p} Content truncation limit: 8000 characters`)
  l.dim(`${p} Metadata size limit: 10240 bytes`)
  
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