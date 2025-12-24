export const metadata = {
  instruction: `- Analyze the transcript to extract metadata including the recording date, location, participants, and topic.
  - For the date: Look for explicit mentions or contextual clues (e.g., "today is...", "this week...", references to recent events).
  - For the location: Identify any mentioned venues, cities, studios, or settings where the recording took place.
  - For the participants: List all speakers, hosts, guests, or individuals mentioned as present during the recording.
  - For the topic: Provide a brief statement of the main subject matter or purpose of the recording.
  - If any metadata cannot be determined from the transcript, indicate "Not specified" for that field.`,
  example: `## Metadata

    **Date:** January 15, 2024
    **Location:** Studio 5B, New York City
    **Participants:** 
    - Host: Sarah Johnson
    - Guest: Dr. Michael Chen, Professor of Economics at MIT
    - Co-host: Alex Martinez
    
    **Topic:** The impact of artificial intelligence on global labor markets and economic policy implications for the next decade.`,
}
