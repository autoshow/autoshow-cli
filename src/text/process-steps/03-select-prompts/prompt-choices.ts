import { titles } from '@/prompts/text-prompts/content-structure-summaries/titles'
import { summary } from '@/prompts/text-prompts/content-structure-summaries/summary'
import { shortSummary } from '@/prompts/text-prompts/content-structure-summaries/short-summary'
import { longSummary } from '@/prompts/text-prompts/content-structure-summaries/long-summary'
import { metadata } from '@/prompts/text-prompts/content-structure-summaries/metadata'
import { bulletPoints } from '@/prompts/text-prompts/content-structure-summaries/bullet-points'
import { quotes } from '@/prompts/text-prompts/content-structure-summaries/quotes'
import { chapterTitlesAndQuotes } from '@/prompts/text-prompts/content-structure-summaries/chapter-titles-and-quotes'
import { chapterTitles } from '@/prompts/text-prompts/content-structure-summaries/chapter-titles'
import { faq } from '@/prompts/text-prompts/content-structure-summaries/faq'
import { shortChapters } from '@/prompts/text-prompts/content-structure-summaries/short-chapters'
import { mediumChapters } from '@/prompts/text-prompts/content-structure-summaries/medium-chapters'
import { longChapters } from '@/prompts/text-prompts/content-structure-summaries/long-chapters'
import { takeaways } from '@/prompts/text-prompts/content-structure-summaries/takeaways'
import { keyMoments } from '@/prompts/text-prompts/content-structure-summaries/key-moments'
import { questions } from '@/prompts/text-prompts/content-structure-summaries/questions'
import { x } from '@/prompts/text-prompts/marketing-social-media/x'
import { facebook } from '@/prompts/text-prompts/marketing-social-media/facebook'
import { linkedin } from '@/prompts/text-prompts/marketing-social-media/linkedin'
import { instagram } from '@/prompts/text-prompts/marketing-social-media/instagram'
import { tiktok } from '@/prompts/text-prompts/marketing-social-media/tiktok'
import { youtubeDescription } from '@/prompts/text-prompts/marketing-social-media/youtube-description'
import { emailNewsletter } from '@/prompts/text-prompts/marketing-social-media/email-newsletter'
import { seoArticle } from '@/prompts/text-prompts/marketing-social-media/seo-article'
import { contentStrategy } from '@/prompts/text-prompts/marketing-social-media/content-strategy'
import { blog } from '@/prompts/text-prompts/marketing-social-media/blog'
import { rapSong } from '@/prompts/text-prompts/creative-entertainment/rap-song'
import { rockSong } from '@/prompts/text-prompts/creative-entertainment/rock-song'
import { countrySong } from '@/prompts/text-prompts/creative-entertainment/country-song'
import { popSong } from '@/prompts/text-prompts/creative-entertainment/pop-song'
import { jazzSong } from '@/prompts/text-prompts/creative-entertainment/jazz-song'
import { folkSong } from '@/prompts/text-prompts/creative-entertainment/folk-song'
import { shortStory } from '@/prompts/text-prompts/creative-entertainment/short-story'
import { screenplay } from '@/prompts/text-prompts/creative-entertainment/screenplay'
import { poetryCollection } from '@/prompts/text-prompts/creative-entertainment/poetry-collection'

export const PROMPT_CHOICES: Array<{ name: string; value: string }> = [
  { name: 'Titles', value: 'titles' },
  { name: 'Summary', value: 'summary' },
  { name: 'Short Summary', value: 'shortSummary' },
  { name: 'Long Summary', value: 'longSummary' },
  { name: 'Metadata', value: 'metadata' },
  { name: 'Bullet Point Summary', value: 'bulletPoints' },
  { name: 'Chapter Titles', value: 'chapterTitles' },
  { name: 'Short Chapters', value: 'shortChapters' },
  { name: 'Medium Chapters', value: 'mediumChapters' },
  { name: 'Long Chapters', value: 'longChapters' },
  { name: 'Key Takeaways', value: 'takeaways' },
  { name: 'Questions', value: 'questions' },
  { name: 'FAQ', value: 'faq' },
  { name: 'Blog', value: 'blog' },
  { name: 'Rap Song', value: 'rapSong' },
  { name: 'Rock Song', value: 'rockSong' },
  { name: 'Country Song', value: 'countrySong' },
  { name: 'Pop Song', value: 'popSong' },
  { name: 'Jazz Song', value: 'jazzSong' },
  { name: 'Folk Song', value: 'folkSong' },
  { name: 'Short Story', value: 'shortStory' },
  { name: 'Screenplay', value: 'screenplay' },
  { name: 'Poetry Collection', value: 'poetryCollection' },
  { name: 'Quotes', value: 'quotes' },
  { name: 'Chapter Titles and Quotes', value: 'chapterTitlesAndQuotes' },
  { name: 'Social Post (X)', value: 'x' },
  { name: 'Social Post (Facebook)', value: 'facebook' },
  { name: 'Social Post (LinkedIn)', value: 'linkedin' },
  { name: 'Social Post (Instagram)', value: 'instagram' },
  { name: 'Social Post (TikTok)', value: 'tiktok' },
  { name: 'YouTube Description', value: 'youtubeDescription' },
  { name: 'Email Newsletter', value: 'emailNewsletter' },
  { name: 'SEO Article', value: 'seoArticle' },
  { name: 'Content Strategy', value: 'contentStrategy' },
  { name: 'Key Moments', value: 'keyMoments' },
]

export const sections = {
  titles,
  summary,
  shortSummary,
  longSummary,
  metadata,
  bulletPoints,
  quotes,
  chapterTitlesAndQuotes,
  x,
  facebook,
  linkedin,
  instagram,
  tiktok,
  youtubeDescription,
  emailNewsletter,
  seoArticle,
  contentStrategy,
  chapterTitles,
  shortChapters,
  mediumChapters,
  longChapters,
  takeaways,
  questions,
  faq,
  blog,
  rapSong,
  rockSong,
  countrySong,
  popSong,
  jazzSong,
  folkSong,
  shortStory,
  screenplay,
  poetryCollection,
  keyMoments,
}