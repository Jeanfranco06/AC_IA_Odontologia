import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { turnedService } from '../services/turned.service';
import { QUERY_KEYS } from '@/shared/constants';
import type { NewRequestFormValues } from '../schemas/turnedSchema';

export const useTurnedList = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.TURNED],
    queryFn: () => turnedService.getAllTurneds(),
  });
};

export const useTurneds = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.TURNED],
    queryFn: () => turnedService.getAllTurneds(),
  });
};

export const useTurnedById = (id: string) => {
  return useQuery({
    queryKey: [QUERY_KEYS.TURNED, id],
    queryFn: () => turnedService.getTurnedById(id),
    enabled: !!id,
  });
};

export const useAddFollowUp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: import('../schemas/turnedSchema').FollowUpFormValues }) => turnedService.addFollowUp(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED, id] });
    },
  });
};

export const useUpdateTurnedDetails = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<import('@/domain/entities').TurnedRecord> }) => turnedService.updateTurnedDetails(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED, id] });
    },
  });
};

export const useCreateNewRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: NewRequestFormValues }) => turnedService.createNewRequest(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED, id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOURNEYS] });
    },
  });
};
