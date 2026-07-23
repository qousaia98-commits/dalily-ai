import { cn } from "@/lib/utils";

/** Server-safe wrapper so list cards can be targeted by Smart Map sync. */
export function ProviderCardMapAnchor({
  providerId,
  className,
  children,
}: {
  providerId: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-provider-card={providerId} className={cn("rounded-2xl", className)}>
      {children}
    </div>
  );
}
