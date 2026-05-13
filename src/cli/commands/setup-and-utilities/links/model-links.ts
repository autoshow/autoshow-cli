import assemblyLinks from './model-links/assembly.json'
import awsLinks from './model-links/aws.json'
import bflLinks from './model-links/bfl.json'
import claudeLinks from './model-links/claude.json'
import deapiLinks from './model-links/deapi.json'
import deepgramLinks from './model-links/deepgram.json'
import deepinfraLinks from './model-links/deepinfra.json'
import driveLinks from './model-links/drive.json'
import elevenlabsLinks from './model-links/elevenlabs.json'
import firecrawlLinks from './model-links/firecrawl.json'
import gcloudLinks from './model-links/gcloud.json'
import geminiLinks from './model-links/gemini.json'
import gladiaLinks from './model-links/gladia.json'
import glmLinks from './model-links/glm.json'
import grokLinks from './model-links/grok.json'
import groqLinks from './model-links/groq.json'
import happyscribeLinks from './model-links/happyscribe.json'
import kimiLinks from './model-links/kimi.json'
import minimaxLinks from './model-links/minimax.json'
import mistralLinks from './model-links/mistral.json'
import openaiLinks from './model-links/openai.json'
import resendLinks from './model-links/resend.json'
import revLinks from './model-links/rev.json'
import runwayLinks from './model-links/runway.json'
import scrapecreatorsLinks from './model-links/scrapecreators.json'
import sonioxLinks from './model-links/soniox.json'
import spiderLinks from './model-links/spider.json'
import speechifyLinks from './model-links/speechify.json'
import speechmaticsLinks from './model-links/speechmatics.json'
import supadataLinks from './model-links/supadata.json'
import togetherLinks from './model-links/together.json'
import xLinks from './model-links/x.json'
import zyteLinks from './model-links/zyte.json'
import type { ModelLinksData } from '~/types'

const providerLinks = [
  elevenlabsLinks,
  groqLinks,
  togetherLinks,
  driveLinks,
  openaiLinks,
  geminiLinks,
  gladiaLinks,
  glmLinks,
  grokLinks,
  xLinks,
  kimiLinks,
  mistralLinks,
  minimaxLinks,
  claudeLinks,
  assemblyLinks,
  awsLinks,
  bflLinks,
  gcloudLinks,
  deepgramLinks,
  deepinfraLinks,
  sonioxLinks,
  speechmaticsLinks,
  speechifyLinks,
  revLinks,
  runwayLinks,
  resendLinks,
  happyscribeLinks,
  deapiLinks,
  supadataLinks,
  scrapecreatorsLinks,
  zyteLinks,
  firecrawlLinks,
  spiderLinks
] as const satisfies readonly ModelLinksData[]

const modelLinks = Object.assign({}, ...providerLinks) satisfies ModelLinksData

export default modelLinks
