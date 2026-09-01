"use client";

import { ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";

interface CartButtonProps {
  onClick: () => void;
  className?: string;
}

export function CartButton({ onClick, className = "" }: CartButtonProps) {
  const { count } = useCart();

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-surface-muted ${className}`}
      aria-label={`Open cart${count > 0 ? `, ${count} items` : ""}`}
    >
      <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}
