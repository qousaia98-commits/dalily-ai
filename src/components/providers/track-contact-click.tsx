"use client";

import { trackProviderEngagementAction } from "@/actions/engagement.actions";

export function TrackContactClick({
  providerId,
  channel,
  children,
  href,
  className,
}: {
  providerId: string;
  channel: "phone" | "whatsapp";
  children: React.ReactNode;
  href: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={className}
      target={channel === "whatsapp" ? "_blank" : undefined}
      rel={channel === "whatsapp" ? "noopener noreferrer" : undefined}
      onClick={() => {
        void trackProviderEngagementAction({
          providerId,
          eventType: channel === "phone" ? "contact_phone" : "contact_whatsapp",
        });
      }}
    >
      {children}
    </a>
  );
}
