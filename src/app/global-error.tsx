"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BRAND } from "@/lib/brand/tokens";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-screen items-center justify-center bg-[#0B1526] px-4 text-white">
        <div className="max-w-md space-y-4 text-center">
          <p className="text-sm font-semibold tracking-wider text-[#C4A052] uppercase">{BRAND.name}</p>
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-sm text-white/70">
            We hit an unexpected error. Please try again or return to the home page.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={reset}
              className="min-h-12 rounded-xl bg-[#C4A052] px-6 text-sm font-semibold text-[#0B1526]"
            >
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-6 text-sm font-semibold"
            >
              Back to home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
