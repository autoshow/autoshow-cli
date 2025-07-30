// import { PrismaClient } from '@prisma/client'
// import {
//   env, fileURLToPath, readFileSync, join, dirname, isAbsolute, resolve
// } from '../node-utils.ts'

// export async function queryEmbeddings(question: string, customDir?: string): Promise<void> {
//   if (!question) {
//     throw new Error('No question provided.')
//   }

//   const OPENAI_API_KEY = env['OPENAI_API_KEY']
//   if (!OPENAI_API_KEY) {
//     throw new Error('Please set the OPENAI_API_KEY environment variable.')
//   }

//   const __filename = fileURLToPath(import.meta.url)
//   const __dirname = dirname(__filename)

//   // Determine the base directory for reading files if customDir is provided.
//   // Otherwise default to the "content" directory, matching create-embed behavior.
//   let baseDir: string
//   if (customDir) {
//     baseDir = isAbsolute(customDir)
//       ? customDir
//       : resolve(process.cwd(), customDir)
//   } else {
//     baseDir = resolve(__dirname, '..', '..', '..', 'content')
//   }

//   const db = new PrismaClient()

//   try {
//     const queryEmbedding = await embedText(question, OPENAI_API_KEY)
//     // Convert the embedding to the pgvector format
//     const vectorString = `[${queryEmbedding.join(',')}]`

//     // Use the <=> operator for cosine distance
//     const sql = `
//       SELECT
//         filename,
//         vector <=> $1::vector(3072) AS distance
//       FROM embeddings
//       ORDER BY vector <=> $1::vector(3072)
//       LIMIT 5
//     `
//     // Pass 'vectorString' directly as a single parameter
//     const rows: { filename: string }[] = await db.$queryRawUnsafe(sql, vectorString)

//     console.log(`Top matches for: "${question}"`)
//     console.table(rows)
//     if (rows.length === 0) {
//       console.log('No matches found in the database.')
//       return
//     }

//     let combinedContent = ''
//     for (const row of rows) {
//       /**
//        * If the stored filename is absolute, read it directly.
//        * Otherwise, join it with baseDir (the directory used during embedding).
//        */
//       const filename = row.filename
//       const fileAbsolutePath = isAbsolute(filename)
//         ? filename
//         : join(baseDir, filename)

//       let fileContent = ''
//       try {
//         fileContent = readFileSync(fileAbsolutePath, 'utf8')
//       } catch (err) {
//         console.error(`Error reading file for context: ${fileAbsolutePath}`, err)
//       }
//       combinedContent += `\n\n---\n**File: ${filename}**\n${fileContent}\n`
//     }

//     const answer = await callChatCompletion(question, combinedContent, OPENAI_API_KEY)
//     console.log('Answer:\n', answer)
//   } finally {
//     await db.$disconnect()
//   }
// }

// async function embedText(text: string, apiKey: string): Promise<number[]> {
//   const resp = await fetch('https://api.openai.com/v1/embeddings', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'Authorization': `Bearer ${apiKey}`
//     },
//     body: JSON.stringify({
//       input: text,
//       model: 'text-embedding-3-large',
//       encoding_format: 'float'
//     })
//   })
//   if (!resp.ok) {
//     throw new Error(`OpenAI error: ${await resp.text()}`)
//   }
//   const json = await resp.json()
//   return json.data[0].embedding
// }

// async function callChatCompletion(userQuestion: string, fileContent: string, apiKey: string): Promise<string> {
//   const chatBody = {
//     model: 'o1-preview',
//     messages: [
//       {
//         role: 'user',
//         content: `Context:\n${fileContent}\n\nQuestion: ${userQuestion}`
//       }
//     ]
//   }
//   const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'Authorization': `Bearer ${apiKey}`
//     },
//     body: JSON.stringify(chatBody)
//   })
//   const chatJson = await chatRes.json()
//   console.log(JSON.stringify(chatJson, null, 2))
//   if (!chatRes.ok) {
//     throw new Error(`OpenAI Chat API error: ${JSON.stringify(chatJson)}`)
//   }
//   return chatJson.choices[0].message.content
// }