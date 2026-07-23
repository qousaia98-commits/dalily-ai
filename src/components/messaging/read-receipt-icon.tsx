"use client";

import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  status: "sent" | "delivered" | "read";
  className?: string;
};

export function ReadReceiptIcon({ status, className }: Props) {
  if (status === "sent") {
    return <Check className={cn("size-3.5 opacity-70", className)} aria-hidden />;
  }
  return (
    <CheckCheck
      className={cn(
        "size-3.5",
        status === "read" ? "text-sky-300" : "opacity-70",
        className,
      )}
      aria-hidden
    />
  );
}
