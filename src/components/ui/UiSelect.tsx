"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface UiSelectProps {
  value: string | number;
  options: UiSelectOption[];
  onValueChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

export function UiSelect({
  value,
  options,
  onValueChange,
  ariaLabel,
  className,
  disabled = false,
}: UiSelectProps) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, maxHeight: 280 });
  const stringValue = String(value);
  const selected = options.find((option) => option.value === stringValue);

  useEffect(() => {
    if (!open) return;

    function placeMenu() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 8;
      const availableBelow = window.innerHeight - rect.bottom - margin;
      const availableAbove = rect.top - margin;
      const maxHeight = Math.max(120, Math.min(320, Math.max(availableBelow, availableAbove)));
      const opensAbove = availableBelow < 180 && availableAbove > availableBelow;
      setPosition({
        left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 160) - margin),
        top: opensAbove ? Math.max(margin, rect.top - maxHeight - margin) : rect.bottom + margin,
        width: Math.max(rect.width, 160),
        maxHeight,
      });
    }

    function closeOnOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    placeMenu();
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex min-h-[40px] w-full items-center justify-between gap-2 rounded-full border border-white/80 bg-white/85 px-3.5 text-left text-sm font-medium text-[#141414] backdrop-blur-sm transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#141414]/10 disabled:opacity-50",
          className
        )}
      >
        <span className="truncate">{selected?.label ?? "Select"}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-[#9c9690] transition-transform", open && "rotate-180")}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={`${id}-listbox`}
            role="listbox"
            aria-label={ariaLabel}
            className="glass-panel animate-dropdown fixed z-[100] overflow-y-auto p-2 shadow-xl"
            style={{
              left: Math.max(8, position.left),
              top: position.top,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
          >
            {options.map((option) => {
              const active = option.value === stringValue;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={option.disabled}
                  onClick={() => {
                    if (option.disabled) return;
                    onValueChange(option.value);
                    setOpen(false);
                    buttonRef.current?.focus();
                  }}
                  className={cn(
                    "flex min-h-[42px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    active
                      ? "bg-[#141414] font-semibold text-white"
                      : "text-[#292522] hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-40"
                  )}
                >
                  <span>{option.label}</span>
                  {active && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
