'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const CART_STORAGE_KEY = 'solomon_cart';

export interface CartItem {
  productId: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  adminPrice: string;
  moq: number;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, 'quantity'>, quantity: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export interface CartProviderProps {
  readonly children: React.ReactNode;
}

/**
 * There is no backend cart model — checkout takes a raw items array — so the cart lives entirely
 * client-side, persisted to localStorage so it survives reloads within the same browser.
 */
export function CartProvider({ children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      // corrupted or inaccessible storage — start with an empty cart
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items, isHydrated]);

  function addItem(item: Omit<CartItem, 'quantity'>, quantity: number) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId ? { ...i, quantity: i.quantity + quantity } : i,
        );
      }
      return [...prev, { ...item, quantity }];
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function clear() {
    setItems([]);
  }

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + Number(i.adminPrice) * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, itemCount, subtotal, addItem, updateQuantity, removeItem, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
