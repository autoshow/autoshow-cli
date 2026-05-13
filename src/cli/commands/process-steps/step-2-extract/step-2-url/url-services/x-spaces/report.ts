import type { EnrichedSpace, SpacePostReference, SpacesArtifact, XUser } from "./types";

function escapeMarkdown(value: unknown): string {
  const text = value === undefined || value === null || value === "" ? "-" : String(value);
  return text.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function formatUser(user: XUser | undefined, fallback?: string): string {
  if (!user) {
    return fallback ?? "-";
  }

  return user.username ? `@${user.username}` : user.name ?? user.id;
}

function formatUsers(users: XUser[], fallbackIds?: string[]): string {
  if (users.length > 0) {
    return users.map((user) => formatUser(user)).join(", ");
  }

  if (fallbackIds && fallbackIds.length > 0) {
    return fallbackIds.join(", ");
  }

  return "-";
}

function formatDate(value: string | undefined): string {
  return value ?? "-";
}

function formatTitle(space: EnrichedSpace): string {
  return space.title?.trim() || "(untitled)";
}

function formatPostLinks(posts: SpacePostReference[]): string {
  if (posts.length === 0) {
    return "-";
  }

  return posts.map((post) => post.url).join(", ");
}

function formatSpaceRow(space: EnrichedSpace): string {
  return [
    formatTitle(space),
    space.state ?? "-",
    formatDate(space.scheduled_start),
    formatDate(space.started_at),
    formatDate(space.ended_at),
    formatUser(space.creator, space.creator_id),
    formatUsers(space.hosts, space.host_ids),
    formatUsers(space.speakers, space.speaker_ids),
    space.participant_count ?? "-",
    formatPostLinks(space.posts),
    space.url,
  ].map(escapeMarkdown).join(" | ");
}

function truncateText(text: string | undefined, maxLength = 160): string {
  if (!text) {
    return "-";
  }

  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function formatPostRow(post: SpacePostReference): string {
  return [
    post.url,
    formatUser(post.author, post.author_id),
    formatDate(post.created_at),
    post.space_ids.length > 0 ? post.space_ids.map((id) => `https://x.com/i/spaces/${id}`).join(", ") : "-",
    truncateText(post.text),
  ].map(escapeMarkdown).join(" | ");
}

export function renderSpacesMarkdown(artifact: SpacesArtifact): string {
  const lines = [
    "# X Spaces Report",
    "",
    `Generated: ${artifact.generated_at}`,
    "",
    "## Summary",
    "",
    `- Spaces: ${artifact.totals.spaces}`,
    `- Unique IDs: ${artifact.totals.unique_ids}`,
    `- Input IDs: ${artifact.totals.input_ids}`,
    `- Input Posts: ${artifact.totals.input_posts}`,
    `- Posts: ${artifact.totals.posts}`,
    `- Users: ${artifact.totals.users}`,
    `- Errors: ${artifact.totals.errors}`,
  ];

  if (artifact.user) {
    lines.push("", "## User", "", `- ${formatUser(artifact.user)} (${artifact.user.id})`);
  }

  lines.push("", "## Sources", "");

  if (artifact.sources.length === 0) {
    lines.push("- None");
  } else {
    for (const source of artifact.sources) {
      const counts = [
        source.discovered_ids !== undefined ? `${source.discovered_ids} ids` : undefined,
        source.discovered_spaces !== undefined ? `${source.discovered_spaces} spaces` : undefined,
        source.posts !== undefined ? `${source.posts} posts` : undefined,
        source.invalid_lines !== undefined && source.invalid_lines > 0 ? `${source.invalid_lines} invalid` : undefined,
      ].filter(Boolean).join(", ");
      lines.push(`- ${source.label}${counts ? ` (${counts})` : ""}`);
    }
  }

  lines.push("", "## Spaces", "");

  if (artifact.spaces.length === 0) {
    lines.push("_No Spaces found._");
  } else {
    lines.push(
      "Title | State | Scheduled | Started | Ended | Creator | Hosts | Speakers | Participants | Posts | URL",
      "--- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | ---"
    );

    for (const space of artifact.spaces) {
      lines.push(formatSpaceRow(space));
    }
  }

  if (artifact.posts.length > 0) {
    lines.push("", "## Posts", "");
    lines.push(
      "Post | Author | Created | Referenced Spaces | Text",
      "--- | --- | --- | --- | ---"
    );

    for (const post of artifact.posts) {
      lines.push(formatPostRow(post));
    }
  }

  if (artifact.errors.length > 0) {
    lines.push("", "## Errors", "");

    for (const error of artifact.errors) {
      const id = error.id ? ` (${error.id})` : "";
      lines.push(`- ${escapeMarkdown(error.source)}${id}: ${escapeMarkdown(error.detail)}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function renderSpacesJson(artifact: SpacesArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}
