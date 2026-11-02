import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import type { BuyerFormValues } from '../schemas/buyerSchema';
import type { Buyer } from '@/domain/entities';

import { buyerService } from '../services/buyer.service';

export function useBuyers() {
  return useQuery({
    queryKey: [QUERY_KEYS.BUYERS],
    queryFn: () => buyerService.getAllBuyers(),
  });
}

export function useBuyer(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.BUYERS, id],
    queryFn: () => buyerService.getAllBuyers().then((buyers: any) => buyers.find((b: any) => b.id === id) || null),
    enabled: !!id,
  });
}

export function useCreateBuyer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BuyerFormValues) => buyerService.createBuyer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
    },
  });
}

export function useUpdateBuyer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<Buyer> & { person?: Partial<import('@/domain/entities').Person> } }) => 
      buyerService.updateBuyer(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS, variables.id] });
    },
  });
}

export function useConvertBuyerToLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => buyerService.convertToLead(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS, id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOURNEYS] });
    },
  });
}
