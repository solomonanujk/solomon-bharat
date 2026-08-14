"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { AppInitialiser } from "@/components/shared/AppInitialiser";
import { AuthModal } from "@/components/shared/AuthModal";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,        // 1 minute
            gcTime: 5 * 60 * 1000,       // 5 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AppInitialiser />
      {children}
      <AuthModal />
      <Toaster position="top-right" richColors closeButton />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}