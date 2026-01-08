"use client";

import { useState, useRef, useEffect } from "react";

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<"top" | "bottom">("top");
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;

      // Show below if not enough space above (less than 60px)
      if (spaceAbove < 60 && spaceBelow > spaceAbove) {
        setPosition("bottom");
      } else {
        setPosition("top");
      }
    }
  }, [isVisible]);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center ml-1"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children || (
        <svg
          className="w-4 h-4 text-[var(--foreground-muted)] hover:text-[var(--foreground)] cursor-help transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 w-64 px-3 py-2 text-xs text-[var(--foreground)] bg-[var(--surface)] border border-[var(--border-color)] rounded-lg shadow-lg ${
            position === "top"
              ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
              : "top-full mt-2 left-1/2 -translate-x-1/2"
          }`}
        >
          {content}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--surface)] border-[var(--border-color)] rotate-45 ${
              position === "top"
                ? "top-full -mt-1 border-r border-b"
                : "bottom-full -mb-1 border-l border-t"
            }`}
          />
        </div>
      )}
    </span>
  );
}
