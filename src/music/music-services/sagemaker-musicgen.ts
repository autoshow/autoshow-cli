import { l } from '@/logging'
import { generateUniqueFilename, isApiError, ensureOutputDirectory } from '../music-utils'
import { env, execPromise } from '@/node-utils'
import type { MusicGenerationOptions, MusicGenerationResult, SageMakerMusicConfig, SageMakerAsyncInferenceResult } from '@/types'

const p = '[music/music-services/sagemaker-musicgen]'

export async function generateMusicWithSageMaker(
  options: MusicGenerationOptions,
  sagemakerConfig: SageMakerMusicConfig
): Promise<MusicGenerationResult> {
  const requestId = Math.random().toString(36).substring(2, 10)
  const startTime = Date.now()
  const uniqueOutputPath = options.outputPath || generateUniqueFilename('sagemaker-musicgen', 'wav')
  
  try {
    if (!env['AWS_ACCESS_KEY_ID'] || !env['AWS_SECRET_ACCESS_KEY']) {
      throw new Error('AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY')
    }
    
    const endpointName = sagemakerConfig.endpointName || env['SAGEMAKER_MUSICGEN_ENDPOINT']
    const s3Bucket = sagemakerConfig.s3BucketName || env['SAGEMAKER_MUSICGEN_S3_BUCKET']
    
    if (!endpointName) {
      throw new Error('SageMaker endpoint name not configured. Set SAGEMAKER_MUSICGEN_ENDPOINT or provide endpointName')
    }
    
    if (!s3Bucket) {
      throw new Error('S3 bucket not configured. Set SAGEMAKER_MUSICGEN_S3_BUCKET or provide s3BucketName')
    }
    
    l.opts(`${p} [${requestId}] Starting SageMaker MusicGen generation`)
    l.dim(`${p} [${requestId}] Endpoint: ${endpointName}`)
    l.dim(`${p} [${requestId}] Model: ${sagemakerConfig.model || 'musicgen-large'}`)
    l.dim(`${p} [${requestId}] S3 Bucket: ${s3Bucket}`)
    l.dim(`${p} [${requestId}] Prompts: ${JSON.stringify(options.prompts)}`)
    l.dim(`${p} [${requestId}] Duration: ${options.duration || 30} seconds`)
    
    const texts = options.prompts?.map(p => p.text) || ['ambient music']
    
    const generationParams = {
      guidance_scale: sagemakerConfig.guidance || options.config?.guidance || 3,
      max_new_tokens: sagemakerConfig.maxNewTokens || calculateTokensFromDuration(options.duration || 30),
      do_sample: sagemakerConfig.doSample !== undefined ? sagemakerConfig.doSample : true,
      temperature: sagemakerConfig.temperature || options.config?.temperature || 1
    }
    
    const inputPayload = {
      texts,
      bucket_name: s3Bucket,
      generation_params: generationParams
    }
    
    const inputKey = `musicgen/input/${requestId}.json`
    const inputLocation = `s3://${s3Bucket}/${inputKey}`
    
    l.dim(`${p} [${requestId}] Uploading input payload to S3: ${inputLocation}`)
    await uploadToS3(s3Bucket, inputKey, JSON.stringify(inputPayload))
    
    l.dim(`${p} [${requestId}] Invoking SageMaker async endpoint`)
    const response = await invokeSageMakerAsync(endpointName, inputLocation)
    
    if (!response.OutputLocation) {
      throw new Error('No output location received from SageMaker')
    }
    
    l.dim(`${p} [${requestId}] Waiting for generation to complete...`)
    const outputData = await pollForOutput(response.OutputLocation, requestId)
    
    if (outputData.generated_outputs_s3 && outputData.generated_outputs_s3.length > 0) {
      const s3MusicUrl = outputData.generated_outputs_s3[0]
      l.dim(`${p} [${requestId}] Downloading generated music from S3: ${s3MusicUrl}`)
      
      await downloadFromS3(s3MusicUrl, uniqueOutputPath)
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      l.success(`${p} [${requestId}] Music generation completed in ${duration}s`)
      
      return {
        success: true,
        path: uniqueOutputPath,
        sessionId: requestId,
        duration: parseFloat(duration)
      }
    } else {
      throw new Error('No generated audio files in response')
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    l.warn(`${p} [${requestId}] Failed in ${duration}s: ${isApiError(error) ? error.message : 'Unknown'}`)
    return {
      success: false,
      error: isApiError(error) ? error.message : 'Unknown error',
      details: isApiError(error) && error.stack ? error.stack : 'No stack trace'
    }
  }
}

function calculateTokensFromDuration(durationSeconds: number): number {
  const tokensPerSecond = 50
  const maxTokens = Math.min(durationSeconds * tokensPerSecond, 1503)
  return maxTokens
}

async function uploadToS3(bucket: string, key: string, content: string): Promise<void> {
  const p = '[music/music-services/sagemaker-musicgen/uploadToS3]'
  const region = env['AWS_REGION'] || 'us-east-1'
  
  try {
    const command = `aws s3 cp - s3://${bucket}/${key} --region ${region}`
    await execPromise(`echo '${content}' | ${command}`)
    l.dim(`${p} Successfully uploaded to S3`)
  } catch (error) {
    l.warn(`${p} Failed to upload to S3: ${isApiError(error) ? error.message : 'Unknown'}`)
    throw error
  }
}

async function invokeSageMakerAsync(endpointName: string, inputLocation: string): Promise<SageMakerAsyncInferenceResult> {
  const p = '[music/music-services/sagemaker-musicgen/invokeSageMakerAsync]'
  const region = env['AWS_REGION'] || 'us-east-1'
  
  try {
    const command = `aws sagemaker-runtime invoke-endpoint-async \
      --endpoint-name ${endpointName} \
      --input-location ${inputLocation} \
      --content-type application/json \
      --invocation-timeout-seconds 3600 \
      --region ${region}`
    
    const { stdout } = await execPromise(command)
    const response = JSON.parse(stdout) as SageMakerAsyncInferenceResult
    
    l.dim(`${p} Async invocation successful, output location: ${response.OutputLocation}`)
    return response
  } catch (error) {
    l.warn(`${p} Failed to invoke SageMaker: ${isApiError(error) ? error.message : 'Unknown'}`)
    throw error
  }
}

async function pollForOutput(outputLocation: string, requestId: string, maxWaitSeconds: number = 600): Promise<any> {
  const p = '[music/music-services/sagemaker-musicgen/pollForOutput]'
  const region = env['AWS_REGION'] || 'us-east-1'
  const startTime = Date.now()
  const pollInterval = 5000
  
  while ((Date.now() - startTime) / 1000 < maxWaitSeconds) {
    try {
      const s3Path = outputLocation.replace('s3://', '')
      const [bucket, ...keyParts] = s3Path.split('/')
      const key = keyParts.join('/')
      
      const command = `aws s3 cp s3://${bucket}/${key} - --region ${region}`
      const { stdout } = await execPromise(command)
      
      if (stdout) {
        l.dim(`${p} [${requestId}] Output available after ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
        return JSON.parse(stdout)
      }
    } catch (error) {
      l.dim(`${p} [${requestId}] Waiting for output... (${Math.floor((Date.now() - startTime) / 1000)}s elapsed)`)
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }
  
  throw new Error(`Timeout waiting for output after ${maxWaitSeconds} seconds`)
}

async function downloadFromS3(s3Url: string, outputPath: string): Promise<void> {
  const p = '[music/music-services/sagemaker-musicgen/downloadFromS3]'
  const region = env['AWS_REGION'] || 'us-east-1'
  
  try {
    ensureOutputDirectory(outputPath)
    const command = `aws s3 cp ${s3Url} ${outputPath} --region ${region}`
    await execPromise(command)
    l.dim(`${p} Successfully downloaded music file`)
  } catch (error) {
    l.warn(`${p} Failed to download from S3: ${isApiError(error) ? error.message : 'Unknown'}`)
    throw error
  }
}

export async function checkSageMakerAvailability(): Promise<boolean> {
  const p = '[music/music-services/sagemaker-musicgen/checkAvailability]'
  
  try {
    if (!env['AWS_ACCESS_KEY_ID'] || !env['AWS_SECRET_ACCESS_KEY']) {
      l.warn(`${p} AWS credentials not configured`)
      return false
    }
    
    const endpointName = env['SAGEMAKER_MUSICGEN_ENDPOINT']
    if (!endpointName) {
      l.warn(`${p} SageMaker endpoint name not configured`)
      return false
    }
    
    const region = env['AWS_REGION'] || 'us-east-1'
    const command = `aws sagemaker describe-endpoint --endpoint-name ${endpointName} --region ${region}`
    
    const { stdout } = await execPromise(command)
    const endpointInfo = JSON.parse(stdout)
    
    if (endpointInfo.EndpointStatus === 'InService') {
      l.dim(`${p} SageMaker endpoint ${endpointName} is available and InService`)
      return true
    } else {
      l.warn(`${p} SageMaker endpoint status: ${endpointInfo.EndpointStatus}`)
      return false
    }
  } catch (error) {
    l.warn(`${p} Error checking SageMaker availability: ${isApiError(error) ? error.message : 'Unknown'}`)
    return false
  }
}