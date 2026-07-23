"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const BAR_COUNT = 20;

type Props = {
  level: number;
  className?: string;
};

/** Rolling bar visualization driven by a live 0-1 amplitude sample per frame. */
export function VoiceWaveform({ level, className }: Props) {
  const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(0.08));
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    setBars((prev) => {
      const next = prev.slice(1);
      next.push(Math.max(0.08, levelRef.current));
      return next;
    });
  }, [level]);

  return (
    <div className={cn("flex h-8 items-center gap-0.5", className)} aria-hidden>
      {bars.map((value, index) => (
        <span
          key={index}
          className="w-1 flex-1 rounded-full bg-[var(--dalily-gold)] transition-[height] duration-100"
          style={{ height: `${Math.round(value * 100)}%` }}
        />
      ))}
    </div>
  );
}
