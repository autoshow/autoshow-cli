export const keyMoments = {
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
}