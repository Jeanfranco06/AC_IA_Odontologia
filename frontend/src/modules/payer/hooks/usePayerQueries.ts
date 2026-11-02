import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payerUseCases } from '@/application/use-cases/payer';
import { QUERY_KEYS } from '@/shared/constants';
import type { PaymentFormValues } from '../schemas/payerSchema';

export function usePayers() {
  return useQuery({
    queryKey: [QUERY_KEYS.PAYERS],
    queryFn: () => payerUseCases.getAllPayers(),
  });
}

export function usePayer(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.PAYERS, id],
    queryFn: () => payerUseCases.getPayerById(id),
    enabled: !!id,
  });
}

export function useRegisterPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: PaymentFormValues }) => 
      payerUseCases.registerPayment(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS, variables.id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYMENTS] });
    },
  });
}

export function useValidatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payerUseCases.validatePayment(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS, id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOURNEYS] });
    },
  });
}

export function useRejectPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string, reason: string }) => 
      payerUseCases.rejectPayment(id, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS, variables.id] });
    },
  });
}

export function useRevertPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string, reason: string }) => 
      payerUseCases.revertPayment(id, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS, variables.id] });
    },
  });
}

export function useConvertPayerToCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payerUseCases.convertToCustomer(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS, id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOURNEYS] });
    },
  });
}
