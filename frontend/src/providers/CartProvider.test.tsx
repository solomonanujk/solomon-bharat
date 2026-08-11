import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CartProvider, useCart } from './CartProvider';

function wrapper({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

const ITEM = {
  productId: 'p1',
  name: 'Brass Lamp',
  slug: 'brass-lamp',
  imageUrl: null,
  adminPrice: '20.00',
  moq: 10,
};

describe('CartProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts empty', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toEqual([]);
    expect(result.current.itemCount).toBe(0);
    expect(result.current.subtotal).toBe(0);
  });

  it('adds a new item with the given quantity', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(ITEM, 10));

    expect(result.current.items).toEqual([{ ...ITEM, quantity: 10 }]);
    expect(result.current.itemCount).toBe(10);
    expect(result.current.subtotal).toBe(200);
  });

  it('merges quantity when the same product is added again', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(ITEM, 10));
    act(() => result.current.addItem(ITEM, 5));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.quantity).toBe(15);
  });

  it('updates the quantity of an existing item', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(ITEM, 10));
    act(() => result.current.updateQuantity('p1', 25));

    expect(result.current.items[0]?.quantity).toBe(25);
  });

  it('removes an item', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(ITEM, 10));
    act(() => result.current.removeItem('p1'));

    expect(result.current.items).toEqual([]);
  });

  it('clears the cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(ITEM, 10));
    act(() => result.current.clear());

    expect(result.current.items).toEqual([]);
  });

  it('persists items to localStorage', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(ITEM, 10));

    const stored = JSON.parse(window.localStorage.getItem('solomon_cart') ?? '[]');
    expect(stored).toEqual([{ ...ITEM, quantity: 10 }]);
  });
});
