/**
 * Official system accounts (Dalily first).
 * Future-ready for additional verified platform accounts.
 * Keep this module client-safe (no server-only imports).
 */

export const DALILY_CONVERSATION_ID = "dalily";

export type OfficialAccountId = "dalily";

export type OfficialAccountProfile = {
  id: OfficialAccountId;
  conversationId: string;
  /** i18n key under messages namespace */
  nameKey: string;
  subtitleKey: string;
  descriptionKey: string;
  readOnlyHintKey: string;
  verified: true;
  accountType: "system";
  sinceLabelKey: string;
  searchAliases: string[];
  /** Prefer brand mark; letter fallback when mark unavailable */
  avatar: "brand" | "letter";
  letterFallback: string;
};

export const OFFICIAL_ACCOUNTS: Record<OfficialAccountId, OfficialAccountProfile> = {
  dalily: {
    id: "dalily",
    conversationId: DALILY_CONVERSATION_ID,
    nameKey: "dalilyName",
    subtitleKey: "dalilySubtitle",
    descriptionKey: "dalilyDescription",
    readOnlyHintKey: "dalilyReadOnly",
    verified: true,
    accountType: "system",
    sinceLabelKey: "dalilySince",
    searchAliases: [
      "dalily",
      "دليلي",
      "official",
      "system",
      "فريق دليلي",
      "dalily team",
    ],
    avatar: "brand",
    letterFallback: "D",
  },
};

export function getOfficialAccountByConversationId(
  conversationId: string,
): OfficialAccountProfile | null {
  for (const account of Object.values(OFFICIAL_ACCOUNTS)) {
    if (account.conversationId === conversationId) return account;
  }
  return null;
}

export function isOfficialConversationId(conversationId: string): boolean {
  return getOfficialAccountByConversationId(conversationId) != null;
}

export function isVerifiedSystemConversation(conversationId: string): boolean {
  const account = getOfficialAccountByConversationId(conversationId);
  return Boolean(account?.verified);
}
