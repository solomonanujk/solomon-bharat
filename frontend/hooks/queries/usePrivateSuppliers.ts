import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { PrivateSupplier } from '@/types'

export function usePrivateSuppliers() {
  return useQuery<PrivateSupplier[]>({
    queryKey: ['private-suppliers'],
    queryFn: async () => (await api.get('/private-suppliers')).data.data,
  })
}
