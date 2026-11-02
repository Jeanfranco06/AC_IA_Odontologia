import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import type { AlternativeFormValues, LeadUpdateFormValues } from '../schemas/leadSchema';

import { leadService } from '../services/lead.service';

export function useLeads() {
  return useQuery({
    queryKey: [QUERY_KEYS.LEADS],
    queryFn: () => leadService.getAllLeads(),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.LEADS, id],
    queryFn: () => leadService.getLeadDetails(id),
    enabled: !!id,
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: LeadUpdateFormValues }) => 
      leadService.updateLead(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS, variables.id] });
    },
  });
}

export function useAddAlternative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: AlternativeFormValues }) => 
      leadService.addAlternative(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS, variables.id] });
    },
  });
}

export function useSelectAlternative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, altId }: { leadId: string, altId: string }) => 
      // Alias this to reserve, since selectAlternativeAndReserve is not natively in the mock API mapping
      leadService.reserve(leadId, { id_solicitud: 1, id_disponibilidad: altId, precio_ofrecido: 0 }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS, variables.leadId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.RESERVATIONS] });
    },
  });
}

export function useConvertLeadToPayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leadService.convertToPayer(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS, id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOURNEYS] });
    },
  });
}
