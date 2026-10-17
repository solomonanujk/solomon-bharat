"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store/useAuthStore";

/** Prices and other role-specific data are cached per query; when the signed-in user
 *  changes (login, sign-up, logout) every cached query is refetched so a buyer never
 *  keeps seeing the guest (price-less) version of a page. */
export function AuthQuerySync() {
  const queryClient = useQueryClient();
  const userKey = useAuthStore((s) => (s.user ? `${s.user.id}:${s.user.role}` : "guest"));
  const hydrated = useAuthStore((s) => s._hasHydrated);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (previous.current !== null && previous.current !== userKey) {
      void queryClient.invalidateQueries();
    }
    previous.current = userKey;
  }, [userKey, hydrated, queryClient]);

  return null;
}
