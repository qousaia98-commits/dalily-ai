"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  GroupedFeedItem,
  NotifDigestKind,
  NotificationDigest,
  NotificationPreferences,
  SmartNotification,
} from "@/lib/notifications";
import {
  completeNotificationActionAction,
  dismissNotificationAction,
  generateDigestAction,
  listDigestsAction,
  loadNotificationCenterAction,
  loadNotificationPreferencesAction,
  markAllNotificationsReadAction,
  markNotificationStatusAction,
  openDigestAction,
  saveNotificationPreferencesAction,
  seedDemoNotificationAction,
} from "@/actions/notification-center.actions";

type PanelTab = "inbox" | "digest" | "prefs";

function priorityClass(p: string) {
  if (p === "critical") return "border-red-500/40 bg-red-500/5";
  if (p === "high") return "border-amber-500/40 bg-amber-500/5";
  if (p === "low") return "border-border/40 opacity-80";
  return "border-border/70";
}

function displayNotif(
  n: SmartNotification,
  isAr: boolean,
): { title: string; body: string; action: string | null; priority: string } {
  return {
    title: isAr ? n.titleAr : n.titleEn,
    body: isAr ? n.bodyAr : n.bodyEn,
    action: isAr ? n.actionLabelAr : n.actionLabelEn,
    priority: n.aiSuggestedPriority ?? n.priority,
  };
}

export function NotificationCenterBell() {
  const t = useTranslations("notificationCenter");
  const locale = useLocale();
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>("inbox");
  const [pending, startTransition] = useTransition();
  const [feed, setFeed] = useState<GroupedFeedItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [query, setQuery] = useState("");
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [digests, setDigests] = useState<NotificationDigest[]>([]);

  const reload = useCallback(() => {
    startTransition(async () => {
      const result = await loadNotificationCenterAction({
        query: query || undefined,
      });
      if (!result.ok) return;
      setFeed(result.feed);
      setUnread(result.unreadCount);
    });
  }, [query]);

  useEffect(() => {
    if (!open) return;
    reload();
  }, [open, reload]);

  function loadPrefs() {
    startTransition(async () => {
      const result = await loadNotificationPreferencesAction();
      if (result.ok) setPrefs(result.preferences);
    });
  }

  function loadDigests() {
    startTransition(async () => {
      const result = await listDigestsAction();
      if (result.ok) setDigests(result.digests);
    });
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={t("bellAria")}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="size-5" />
        {unread > 0 ? (
          <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--dalily-gold)] px-1 text-[10px] font-bold text-background">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          className={cn(
            "absolute end-0 top-full z-50 mt-2 w-[min(100vw-1.5rem,22rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-lg sm:w-[24rem]",
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div>
              <p className="text-sm font-semibold">{t("title")}</p>
              <p className="text-[11px] text-muted-foreground">
                {t("unread", { count: unread })}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("tabs.prefs")}
                onClick={() => {
                  setTab("prefs");
                  loadPrefs();
                }}
              >
                <Settings2 className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("close")}
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-1 border-b border-border px-2 py-1.5">
            {(
              [
                ["inbox", t("tabs.inbox")],
                ["digest", t("tabs.digest")],
                ["prefs", t("tabs.prefs")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium",
                  tab === id
                    ? "bg-[var(--dalily-gold)]/15 text-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => {
                  setTab(id);
                  if (id === "prefs") loadPrefs();
                  if (id === "digest") loadDigests();
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "inbox" ? (
            <div className="max-h-[24rem] space-y-2 overflow-y-auto p-2">
              <div className="flex gap-2 px-1">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") reload();
                  }}
                  placeholder={t("search")}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      await markAllNotificationsReadAction();
                      reload();
                    });
                  }}
                >
                  {t("markAllRead")}
                </Button>
              </div>

              {feed.length === 0 ? (
                <div className="space-y-2 p-3 text-center text-sm text-muted-foreground">
                  <p>{t("empty")}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        await seedDemoNotificationAction();
                        reload();
                      });
                    }}
                  >
                    {t("seedDemo")}
                  </Button>
                </div>
              ) : (
                feed.map((item) => {
                  if (item.kind === "group") {
                    const d = displayNotif(item.representative, isAr);
                    const title =
                      item.representative.isGroupSummary
                        ? d.title
                        : t("grouped", { count: item.count, title: d.title });
                    return (
                      <FeedRow
                        key={`g-${item.groupKey}`}
                        title={title}
                        body={d.body}
                        priority={d.priority}
                        href={item.representative.href}
                        actionLabel={d.action}
                        unread={item.representative.status === "unread"}
                        isGroup
                          onOpen={() => {
                          startTransition(async () => {
                            await markNotificationStatusAction({
                              notificationId: item.representative.id,
                              status: "read",
                            });
                            reload();
                          });
                        }}
                        onDismiss={() => {
                          startTransition(async () => {
                            await dismissNotificationAction({
                              notificationId: item.representative.id,
                            });
                            reload();
                          });
                        }}
                        onAction={() => {
                          startTransition(async () => {
                            await completeNotificationActionAction({
                              notificationId: item.representative.id,
                              actionKey:
                                item.representative.actionKey ?? "open",
                            });
                            reload();
                          });
                        }}
                      />
                    );
                  }

                  const n = item.notification;
                  const d = displayNotif(n, isAr);
                  return (
                    <FeedRow
                      key={n.id}
                      title={d.title}
                      body={d.body}
                      priority={d.priority}
                      href={n.href}
                      actionLabel={d.action}
                      unread={n.status === "unread"}
                      onOpen={() => {
                        startTransition(async () => {
                          await markNotificationStatusAction({
                            notificationId: n.id,
                            status: "read",
                          });
                          reload();
                        });
                      }}
                      onDismiss={() => {
                        startTransition(async () => {
                          await dismissNotificationAction({
                            notificationId: n.id,
                          });
                          reload();
                        });
                      }}
                      onAction={() => {
                        startTransition(async () => {
                          await completeNotificationActionAction({
                            notificationId: n.id,
                            actionKey: n.actionKey ?? "open",
                          });
                          reload();
                        });
                      }}
                    />
                  );
                })
              )}
            </div>
          ) : null}

          {tab === "digest" ? (
            <div className="max-h-[24rem] space-y-2 overflow-y-auto p-3">
              <p className="text-xs text-muted-foreground">{t("digestHint")}</p>
              <div className="flex flex-wrap gap-1">
                {(
                  ["morning", "daily", "weekly", "unread"] as NotifDigestKind[]
                ).map((kind) => (
                  <Button
                    key={kind}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await generateDigestAction({
                          kind,
                          locale,
                        });
                        if (!result.ok) toast.error(t("digestError"));
                        else {
                          toast.success(t("digestReady"));
                          loadDigests();
                        }
                      });
                    }}
                  >
                    {t(`digestKinds.${kind}`)}
                  </Button>
                ))}
              </div>
              {digests.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("digestEmpty")}</p>
              ) : (
                digests.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="w-full rounded-xl border border-border/70 p-2 text-start text-sm hover:bg-muted/40"
                    onClick={() => {
                      startTransition(async () => {
                        const result = await openDigestAction({
                          digestId: d.id,
                        });
                        if (result.ok) setDigests(result.digests);
                      });
                    }}
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {t(`digestKinds.${d.digestKind}`)}
                    </p>
                    <p>{isAr ? d.summaryAr : d.summaryEn}</p>
                    {d.highlights.length > 0 ? (
                      <ul className="mt-1 text-xs text-muted-foreground">
                        {d.highlights.slice(0, 3).map((h) => (
                          <li key={h}>• {h}</li>
                        ))}
                      </ul>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          ) : null}

          {tab === "prefs" && prefs ? (
            <div className="max-h-[24rem] space-y-3 overflow-y-auto p-3 text-sm">
              <PrefsSection title={t("prefs.channels")}>
                <Toggle
                  label={t("prefs.inApp")}
                  checked={prefs.channelInApp}
                  onChange={(v) => savePref({ channelInApp: v })}
                />
                <Toggle
                  label={t("prefs.push")}
                  checked={prefs.channelPush}
                  onChange={(v) => savePref({ channelPush: v })}
                />
                <Toggle
                  label={t("prefs.email")}
                  checked={prefs.channelEmail}
                  onChange={(v) => savePref({ channelEmail: v })}
                />
              </PrefsSection>
              <PrefsSection title={t("prefs.categories")}>
                <Toggle
                  label={t("prefs.chat")}
                  checked={prefs.catChat}
                  onChange={(v) => savePref({ catChat: v })}
                />
                <Toggle
                  label={t("prefs.bookings")}
                  checked={prefs.catBookings}
                  onChange={(v) => savePref({ catBookings: v })}
                />
                <Toggle
                  label={t("prefs.emergency")}
                  checked={prefs.catEmergency}
                  onChange={(v) => savePref({ catEmergency: v })}
                />
                <Toggle
                  label={t("prefs.projects")}
                  checked={prefs.catProjects}
                  onChange={(v) => savePref({ catProjects: v })}
                />
                <Toggle
                  label={t("prefs.marketplace")}
                  checked={prefs.catMarketplace}
                  onChange={(v) => savePref({ catMarketplace: v })}
                />
                <Toggle
                  label={t("prefs.payments")}
                  checked={prefs.catPayments}
                  onChange={(v) => savePref({ catPayments: v })}
                />
                <Toggle
                  label={t("prefs.voice")}
                  checked={prefs.catVoice}
                  onChange={(v) => savePref({ catVoice: v })}
                />
              </PrefsSection>
              <PrefsSection title={t("prefs.quiet")}>
                <Toggle
                  label={t("prefs.quietEnabled")}
                  checked={prefs.quietHoursEnabled}
                  onChange={(v) => savePref({ quietHoursEnabled: v })}
                />
                {prefs.quietHoursEnabled ? (
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={prefs.quietHoursStart ?? "22:00"}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                      onChange={(e) =>
                        savePref({ quietHoursStart: e.target.value })
                      }
                    />
                    <input
                      type="time"
                      value={prefs.quietHoursEnd ?? "07:00"}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                      onChange={(e) =>
                        savePref({ quietHoursEnd: e.target.value })
                      }
                    />
                  </div>
                ) : null}
              </PrefsSection>
            </div>
          ) : null}
          {tab === "prefs" && !prefs ? (
            <p className="p-3 text-sm text-muted-foreground">{t("loading")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  function savePref(patch: Partial<NotificationPreferences>) {
    startTransition(async () => {
      const result = await saveNotificationPreferencesAction(patch);
      if (result.ok) {
        setPrefs(result.preferences);
        toast.success(t("prefsSaved"));
      } else toast.error(t("prefsError"));
    });
  }
}

function PrefsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 py-0.5">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function FeedRow(props: {
  title: string;
  body: string;
  priority: string;
  href: string | null;
  actionLabel: string | null;
  unread: boolean;
  isGroup?: boolean;
  onOpen: () => void;
  onDismiss: () => void;
  onAction: () => void;
}) {
  return (
    <article
      className={cn(
        "rounded-xl border px-3 py-2",
        priorityClass(props.priority),
        props.unread && "ring-1 ring-[var(--dalily-gold)]/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" className="min-w-0 text-start" onClick={props.onOpen}>
          <p className="text-sm font-medium">
            {props.isGroup ? "▾ " : ""}
            {props.title}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {props.body}
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {props.priority}
          </p>
        </button>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={props.onDismiss}
        >
          ×
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {props.href ? (
          <Button asChild size="sm" variant="secondary">
            <Link
              href={props.href}
              onClick={() => {
                props.onAction();
              }}
            >
              {props.actionLabel ?? "Open"}
            </Link>
          </Button>
        ) : null}
      </div>
    </article>
  );
}
