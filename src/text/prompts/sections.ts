export const sections = {
  titles: {
    instruction: `- Write 5 potential titles for the video.
  - The first two titles should be very short and have no subtitle.
  - The last three titles can be longer and include subtitles.`,
    example: `## Potential Titles

    1. Title Hard
    2. Title Harder
    3. Title Hard with a Vengeance
    4. Title Hard IV: Live Free or Title Hard
    5. Title Hard V: A Good Day to Die Hard`,
  },

  summary: {
    instruction: `- Write a one-sentence description of the transcript and a one-paragraph summary.
  - The one-sentence description shouldn't exceed 180 characters (roughly 30 words).
  - The one-paragraph summary should be approximately 600-1200 characters (roughly 100-200 words).`,
    example: `## Episode Description

    One sentence description encapsulating the content within roughly 180 characters.

    ## Episode Summary

    A concise summary of the transcript, typically 600-1200 characters or about 100-200 words, highlighting main topics, significant points, methods, conclusions, and implications.`,
  },

  shortSummary: {
    instruction: `- Write a one sentence description of the transcript.
  - The one sentence description shouldn't exceed 180 characters (roughly 30 words).\n`,
    example: `## Episode Description

    One sentence description of the transcript that encapsulates the content contained in the file but does not exceed roughly 180 characters (or approximately 30 words).\n`,
  },

  longSummary: {
    instruction: `- Write a one paragraph summary of the transcript.
  - The one paragraph summary should be approximately 600-1200 characters (roughly 100-200 words).\n`,
    example: `## Episode Summary

    A concise summary of a chapter's content, typically ranging from 600 to 1200 characters or approximately 100 to 200 words. It begins by introducing the main topic or theme of the chapter, providing context for the reader. The summary then outlines key points or arguments presented in the chapter, touching on major concepts, theories, or findings discussed. It may briefly mention methodologies used or data analyzed, if applicable. The paragraph also highlights any significant conclusions or implications drawn from the chapter's content. Throughout, it maintains a balance between providing enough detail to give readers a clear understanding of the chapter's scope and keeping the information general enough to apply to various subjects. This summary style efficiently conveys the essence of the chapter's content, allowing readers to quickly grasp its main ideas and decide if they want to dig deeper into the full text.\n`,
  },

  bulletPoints: {
    instruction: `- Write a bullet point list summarizing the transcript.\n`,
    example: `## Bullet Point Summary

    - A concise summary of a chapter's content in bullet point list form.
    - It begins by introducing the main topic or theme of the chapter, providing context for the reader.
    - The summary then outlines key points or arguments presented in the chapter\n`,
  },
  quotes: {
    instruction: `- Select the five most important and impactful quotes from the transcript.\n`,
    example: `## Important Quotes
    
    1. "First important quote from the episode."
    2. "Second important quote from the episode."
    3. "Third important quote from the episode."
    4. "Fourth important quote from the episode."
    5. "Fifth important quote from the episode."\n`,
  },

  chapterTitlesAndQuotes: {
    instruction: `- Create chapter titles based on the topics discussed throughout the transcript.
  - Include timestamps for when these chapters begin.
  - Chapters should be roughly 3-6 minutes long.
  - Under each chapter title, include the most representative quote from that chapter.\n`,
    example: `## Chapters with Quotes
    
    ### 00:00:00 - Introduction to Web Development
    
    > "Web development is constantly evolving, driven by new technologies and user expectations."\n`,
  },

  x: {
    instruction: `- Write a concise, engaging social media post optimized for the platform X (formerly Twitter).
  - Keep the post under 280 characters.
  - Include hashtags if appropriate.\n`,
    example: `## X Social Post
    
    Web development isn't just coding; it's shaping the future. Dive into the latest trends and stay ahead of the curve. #WebDev #JavaScript\n`,
  },

  facebook: {
    instruction: `- Write an engaging Facebook post summarizing the key themes of the transcript.
  - Keep it conversational and suitable for broad audiences.
  - Posts should ideally be around 100-200 words.\n`,
    example: `## Facebook Social Post
    
    Have you ever wondered how web applications have transformed over the last decade? In our latest episode, we explore this evolution, highlighting the rise of JavaScript frameworks, backend innovations, and future trends that every developer should watch. Tune in to learn more and stay updated!\n`,
  },

  linkedin: {
    instruction: `- Write a professional and insightful LinkedIn post based on the transcript.
  - Highlight key takeaways or actionable insights relevant to professionals.
  - Aim for 150-300 words.\n`,
    example: `## LinkedIn Social Post
    
    Today's web developers need to master a blend of skills, from client-side frameworks to robust backend technologies. Our latest content explores how professionals can stay competitive by embracing new tools, adapting to market trends, and continuously learning. What steps are you taking to future-proof your career? Share your thoughts!\n`,
  },
  chapterTitles: {
    instruction: `- Create chapter titles based on the topics discussed throughout the transcript.
  - Include only starting timestamps in exact HH:MM:SS format, always using two digits each for hours, minutes, and seconds.
  - Chapters should be roughly 3-6 minutes long.`,
    example: `## Chapters

    ### 00:00:00 - Introduction and Overview
    ### 00:03:12 - The History of Web Development
    ### 00:07:45 - The Rise of JavaScript Frameworks
    ### 00:12:30 - Server-Side Technologies
    ### 00:18:00 - The Future of Web Development`,
  },

  shortChapters: {
    instruction: `- Create chapter titles and one-sentence descriptions based on the topics discussed.
  - Include only starting timestamps in exact HH:MM:SS format, always using two digits each for hours, minutes, and seconds.
  - Chapters should be roughly 3-6 minutes long.
  - Ensure chapters cover the entire content, clearly noting the last timestamp (HH:MM:SS), indicating total duration.
  - Descriptions should flow naturally from the content.`,
    example: `## Chapters

    ### 00:00:00 - Introduction and Episode Overview

    Briefly introduces the episode's main themes, setting the stage for detailed discussions ahead.`,
  },

  mediumChapters: {
    instruction: `- Create chapter titles and one-paragraph descriptions based on the topics discussed.
  - Include only starting timestamps in exact HH:MM:SS format, always using two digits each for hours, minutes, and seconds.
  - Chapters should be roughly 3-6 minutes long.
  - Write descriptions of about 50 words each.
  - Ensure chapters cover the entire content, clearly noting the last timestamp (HH:MM:SS), indicating total duration.
  - Descriptions should flow naturally from the content.`,
    example: `## Chapters

    ### 00:00:00 - Introduction and Overview

    Introduces the key themes and concepts explored in the episode, briefly outlining the significant points and their relevance to broader discussions. This foundation helps listeners grasp the scope and importance of the subsequent content and prepares them for deeper exploration of each topic.`,
  },

  longChapters: {
    instruction: `- Create chapter titles and descriptions based on the topics discussed throughout.
  - Include only starting timestamps in exact HH:MM:SS format, always using two digits each for hours, minutes, and seconds.
  - Chapters should each cover approximately 3-6 minutes of content.
  - Write a two-paragraph description (75+ words) for each chapter.
  - Ensure chapters cover the entire content, clearly noting the last timestamp (HH:MM:SS), indicating total duration.
  - Descriptions should flow naturally from the content, avoiding formulaic language.`,
    example: `## Chapters

    ### 00:00:00 - Introduction and Overview

    A comprehensive introduction providing readers with the main themes and concepts explored throughout the chapter. The content highlights significant points discussed in detail and explores their broader implications and practical relevance.

    Connections are made between concepts, emphasizing interrelationships and potential impacts on various fields or current challenges. The chapter sets a clear foundation for understanding the subsequent discussions.`,
  },

  takeaways: {
    instruction: `- Include three key takeaways the listener should get from the episode.\n`,
    example: `## Key Takeaways

    1. Full-stack development requires a broad understanding of both client-side and server-side technologies, enabling developers to create more cohesive and efficient web applications.
    2. Modern front-end frameworks like React and Vue.js have revolutionized UI development, emphasizing component-based architecture and reactive programming paradigms.
    3. Backend technologies like Node.js and cloud services have made it easier to build scalable, high-performance web applications, but require careful consideration of security and data management practices.\n`,
  },

  questions: {
    instruction: `- Include a list of 10 questions to check the listeners' comprehension of the material.
  - Ensure questions cover all major sections of the content.
  - Ensure the questions are correct, emphasize the right things, and aren't redundant.
  - Do not say things like "the instructor describes" or "according to the lesson," assume that all the questions relate to the lesson told by the instructor.
  - The first five questions should be beginner level questions and the last five should be expert level questions.\n`,
    example: `## Questions to Check Comprehension

    ### Beginner Questions

    1. What are the three main components of the modern web development stack?
    2. How has the role of JavaScript evolved in web development over the past decade?
    3. What are the key differences between React and Vue.js?
    4. Why is server-side rendering beneficial for web applications?
    5. What is the purpose of a RESTful API in full-stack development?

    ### Expert Questions

    6. How does Node.js differ from traditional server-side languages like PHP or Python?
    7. What are the main considerations when choosing a database for a web application?
    8. How do containerization technologies like Docker impact web development and deployment?
    9. What role does responsive design play in modern web development?
    10. How can developers ensure the security of user data in web applications?\n`,
  },

  faq: {
    instruction: `- Include a list of 5-10 frequently asked questions and answers based on the transcript.
  - Ensure questions and answers cover all major sections of the content.\n`,
    example: `## FAQ

    Q: What are the three main components of the Jamstack?
    A: JavaScript, APIs, and markup.\n`,
  },

  blog: {
    instruction: `- Generate a blog outline and first draft for a blog post based on this piece of content.
    
    - Make sure the blog post is at least 750 words.\n`,
    example: `## Blog Outline

    1. Part 1
    2. Part 2
    3. Part 3
    
    ### Blog First Draft
    
    First draft of a blog.\n`,
  },

  rapSong: {
    instruction: `- Write a highly complex, multi-syllabic rhyming, Eminem inspired rap based on this transcript.
    - Do not rhyme any words with themselves.
    - Give it a basic song structure with verses, choruses, and a bridge.
    - Give the song three potential titles.\n`,
    example: `## Song
    
    Lyrics to the song.\n`
  },

  rockSong: {
    instruction: `- Write a high-energy, anthemic rock song with powerful imagery and impactful, multi-layered lyrics.
    - Use metaphors and vivid language to convey a sense of rebellion or freedom.
    - Structure the song with verses, choruses, and a bridge.
    - Provide the song with three potential titles.\n`,
    example: `## Song
    
    Lyrics to the song.\n`
  },

  countrySong: {
    instruction: `- Write a heartfelt, storytelling country song with simple yet emotionally charged lyrics.
    - Include themes of life, love, and the struggles of everyday people.
    - Structure the song with verses, choruses, and a bridge.
    - Offer the song three potential titles.\n`,
    example: `## Song
    
    Lyrics to the song.\n`
  },

  keyMoments: {
    instruction: `- Identify the most compelling segments from the transcript ({COUNT} by default).
  - Each segment should be approximately {DURATION} seconds long.
  - Look for particularly insightful explanations, key turning points, or any segments that stand out as especially valuable or engaging.
  - For each key moment:
    - Find the exact start timestamp from the transcript
    - Calculate the end timestamp based on the specified duration
    - Extract and include the ACTUAL transcript text from that time range (do not use placeholder text)
    - Write a brief explanation (1-2 sentences) of what makes this segment valuable
  - IMPORTANT: You must copy the exact transcript text with timestamps from the specified time range. Do not summarize or paraphrase.`,
    example: `## Key Moments

    ### 1. 00:12:45 - 00:13:45

    **Why it matters:** This segment stands out for its clear and concise explanation of the core concept, making complex ideas accessible to the audience.

    **Transcript:**
    [00:12:45] So when we talk about microservices, what we're really discussing is a fundamental shift in how we think about application architecture.
    [00:12:52] Instead of building one monolithic application, we're breaking it down into smaller, independent services.
    [00:13:01] Each service has its own database, its own deployment cycle, and its own team responsible for it.
    [00:13:09] This might sound like more work initially, and honestly, it is.
    [00:13:15] But the benefits become clear when you need to scale specific parts of your application.
    [00:13:22] You can scale just the payment service during Black Friday without touching the user profile service.
    [00:13:30] That's the kind of flexibility that modern applications need to stay competitive.
    [00:13:38] And it's why companies like Netflix and Amazon pioneered this approach.

    ### 2. 00:24:30 - 00:25:30

    **Why it matters:** The speaker provides a compelling real-world example that perfectly illustrates the main theme.

    **Transcript:**
    [00:24:30] Let me tell you about a client I worked with last year who was struggling with their monolithic e-commerce platform.
    [00:24:37] Every time they wanted to update the recommendation engine, they had to redeploy the entire application.
    [00:24:44] This meant scheduling downtime, coordinating with multiple teams, and crossing their fingers that nothing would break.
    [00:24:52] After we migrated to microservices, they could update recommendations in real-time.
    [00:24:58] The results were immediate - conversion rates jumped by 23% in the first month.
    [00:25:05] But more importantly, their development velocity increased dramatically.
    [00:25:11] Teams could work independently, deploy when ready, and iterate quickly based on user feedback.
    [00:25:19] That's the real power of this architecture - it's not just about technology, it's about enabling business agility.`,
  },
}