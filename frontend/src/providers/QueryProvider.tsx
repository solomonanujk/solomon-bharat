'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/lib/queryClient';

export interface QueryProviderProps {
  readonly children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(() => makeQueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}