"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { searchChatMessagesAction } from "@/actions/chat.actions";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";

type Hit = {
  id: string;
  conversationId: string;
  bodyText: string;
  createdAt: string;
};

type Props = {
  conversationId?: string | null;
  messagesBasePath?: string;
};

export function ChatSearchBar({
  conversationId,
  messagesBasePath = "/messages",
}: Props) {
  const t = useTranslations("messaging.search");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [pending, startTransition] = useTransition();

  function runSearch() {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }
    startTransition(async () => {
      const result = await searchChatMessagesAction({
        query,
        conversationId,
      });
      if (!result.success) {
        setHits([]);
        return;
      }
      setHits(
        result.results.map((r) => ({
          id: r.id,
          conversationId: r.conversationId,
          bodyText: r.bodyText,
          createdAt: r.createdAt,
        })),
      );
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded-xl border bg-background py-2 pe-3 ps-8 text-sm"
            placeholder={t("placeholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch();
              }
            }}
          />
        </div>
        <Button type="button" size="sm" disabled={pending} onClick={runSearch}>
          {t("cta")}
        </Button>
      </div>
      {hits.length > 0 ? (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border bg-card p-2 text-xs">
          {hits.map((h) => (
            <li key={h.id}>
              <Link
                href={`${messagesBasePath}/${h.conversationId}`}
                className="block rounded-lg px-2 py-1.5 hover:bg-muted"
              >
                <p className="line-clamp-2 text-foreground">{h.bodyText}</p>
                <p className="text-muted-foreground">
                  {new Date(h.createdAt).toLocaleString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
