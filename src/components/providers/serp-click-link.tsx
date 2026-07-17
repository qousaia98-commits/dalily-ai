"use client";

import { Link } from "@/lib/i18n/routing";
import { trackProviderEngagementAction } from "@/actions/engagement.actions";
import { cn } from "@/lib/utils";

/** Wraps provider card link to record SERP clicks. */
export function SerpClickLink({
  providerId,
  position,
  href,
  className,
  style,
  children,
}: {
  providerId: string;
  position?: number;
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(className)}
      style={style}
      onClick={() => {
        void trackProviderEngagementAction({
          providerId,
          eventType: "serp_click",
          position,
        });
      }}
    >
      {children}
    </Link>
  );
}
