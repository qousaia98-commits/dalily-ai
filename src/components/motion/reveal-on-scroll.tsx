"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type RevealOnScrollProps = {
  children: ReactNode;
  className?: string;
  /** Section-level only — keep threshold modest. */
  rootMargin?: string;
};

/**
 * Soft scroll reveal for section blocks.
 * Progressive: content stays visible until JS decides a below-fold reveal is safe.
 * prefers-reduced-motion → never hides, never observes.
 */
export function RevealOnScroll({
  children,
  className,
  rootMargin = "0px 0px -12% 0px",
}: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  /** idle = visible with no animation (SSR / above-fold / reduced motion) */
  const [phase, setPhase] = useState<"idle" | "pending" | "in">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) {
      return;
    }

    const top = el.getBoundingClientRect().top;
    const alreadyVisible = top < window.innerHeight * 0.88;
    if (alreadyVisible) {
      return;
    }

    setPhase("pending");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setPhase("in");
          observer.disconnect();
        }
      },
      { threshold: 0.14, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div
      ref={ref}
      className={cn(
        className,
        phase === "pending" && "reveal-pending",
        phase === "in" && "animate-reveal-in",
      )}
    >
      {children}
    </div>
  );
}
