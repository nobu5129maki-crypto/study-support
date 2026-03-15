"use client";

import { useEffect, useState } from "react";

const PETALS = ["🌸", "🌺", "🌷", "🌼", "💮", "🪷", "🌸", "🌺"];
const COUNT = 40;

export function FlowerConfetti({ onComplete }: { onComplete?: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 4000);
    return () => clearTimeout(t);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: COUNT }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-flower-fall"
          style={{
            left: `${(i * 97) % 100}%`,
            top: -20,
            animationDelay: `${(i * 0.08) % 2}s`,
            animationDuration: `${3 + (i % 3)}s`,
            fontSize: `${16 + (i % 24)}px`,
          }}
        >
          {PETALS[i % PETALS.length]}
        </div>
      ))}
    </div>
  );
}
