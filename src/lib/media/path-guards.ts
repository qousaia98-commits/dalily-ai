/**
 * Sprint 5.5 — storage path / bucket allowlist helpers.
 */

const ALLOWED_MEDIA_BUCKETS = new Set([
  "chat-attachments",
  "project-media",
  "avatars",
]);

export function isAllowedMediaBucket(bucket: string): boolean {
  return ALLOWED_MEDIA_BUCKETS.has(bucket);
}

/**
 * Chat attachment paths must be `{userId}/{conversationId}/…`.
 */
export function isValidChatAttachmentPath(input: {
  path: string;
  userId: string;
  conversationId: string;
}): boolean {
  const expectedPrefix = `${input.userId}/${input.conversationId}/`;
  if (!input.path.startsWith(expectedPrefix)) return false;
  if (input.path.includes("..")) return false;
  return true;
}

/**
 * Path must contain the conversation segment (defense in depth for signed URLs).
 */
export function pathBelongsToConversation(
  path: string,
  conversationId: string,
): boolean {
  if (!conversationId || path.includes("..")) return false;
  return (
    path.includes(`/${conversationId}/`) ||
    path.startsWith(`${conversationId}/`)
  );
}

/**
 * Project media paths typically include project id.
 */
export function pathBelongsToProject(path: string, projectId: string): boolean {
  if (!projectId || path.includes("..")) return false;
  return path.includes(projectId);
}
