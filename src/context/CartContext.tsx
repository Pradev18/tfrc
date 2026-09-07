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
  quantity: number;
  size?: string;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
  toggleItem: (item: CartItem) => void;
  setItemQuantity: (productId: string, quantity: number) => void;
}

const STORAGE_KEY = "tfrc-vita-nova-cart";

const CartContext = createContext<CartContextValue | null>(null);

function normalizeItem(raw: Partial<CartItem> & CartItem): CartItem {
  return {
    ...raw,
    quantity: Math.max(1, Number(raw.quantity) || 1),
    size: raw.size?.trim() || undefined,
  };
}

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as CartItem[];
    return Array.isArray(parsed) ? parsed.map(normalizeItem) : [];
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
    const next = normalizeItem(item);
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === next.productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === next.productId
            ? { ...i, quantity: Math.min(99, i.quantity + next.quantity) }
            : i
        );
      }
      return [...prev, next];
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
    const next = normalizeItem(item);
    setItems((prev) => {
      const exists = prev.some((i) => i.productId === next.productId);
      if (exists) return prev.filter((i) => i.productId !== next.productId);
      return [...prev, next];
    });
  }, []);

  const setItemQuantity = useCallback((productId: string, quantity: number) => {
    const qty = Math.max(1, Math.min(99, quantity));
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i))
    );
  }, []);

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((sum, i) => sum + i.quantity, 0),
      addItem,
      removeItem,
      clearCart,
      isInCart,
      toggleItem,
      setItemQuantity,
    }),
    [items, addItem, removeItem, clearCart, isInCart, toggleItem, setItemQuantity]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
