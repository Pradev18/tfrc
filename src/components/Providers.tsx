"use client";

import { SessionProvider } from "next-auth/react";
import { CartProvider } from "@/context/CartContext";
import { LiveDataRefresh } from "@/components/LiveDataRefresh";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>
        <LiveDataRefresh />
        {children}
      </CartProvider>
    </SessionProvider>
  );
}
