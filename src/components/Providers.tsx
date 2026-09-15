"use client";

import { SessionProvider } from "next-auth/react";
import { CartProvider } from "@/context/CartContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { LiveDataRefresh } from "@/components/LiveDataRefresh";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <CartProvider>
          <LiveDataRefresh />
          {children}
        </CartProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
