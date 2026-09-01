"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface CartItem {
  id: string;
  productId: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  imageUrl?: string;
  environmentSlug: string;
  environmentName: string;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
  toggleItem: (item: CartItem) => void;
}

const STORAGE_KEY = "tfrc-vita-nova-cart";

const CartContext = createContext<CartContextValue | null>(null);

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(loadCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveCart(items);
  }, [items, hydrated]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      if (prev.some((i) => i.productId === item.productId)) return prev;
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const isInCart = useCallback(
    (productId: string) => items.some((i) => i.productId === productId),
    [items]
  );

  const toggleItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.productId === item.productId);
      if (exists) return prev.filter((i) => i.productId !== item.productId);
      return [...prev, item];
    });
  }, []);

  const value = useMemo(
    () => ({
      items,
      count: items.length,
      addItem,
      removeItem,
      clearCart,
      isInCart,
      toggleItem,
    }),
    [items, addItem, removeItem, clearCart, isInCart, toggleItem]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
