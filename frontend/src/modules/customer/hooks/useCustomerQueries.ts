import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerService } from '../services/customer.service';
import { QUERY_KEYS } from '@/shared/constants';
import type { DentalAttentionFormValues } from '../schemas/customerSchema';
import { CustomerState } from '@/domain/enums';

export function useCustomers() {
  return useQuery({
    queryKey: [QUERY_KEYS.CUSTOMERS],
    queryFn: () => customerService.getAllCustomers(),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.CUSTOMERS, id],
    queryFn: () => customerService.getCustomerById(id),
    enabled: !!id,
  });
}

export function useChangeCustomerState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, state }: { id: string, state: CustomerState }) => 
      customerService.changeState(id, state),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, variables.id] });
    },
  });
}

export function useStartAttention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, time }: { id: string, time: string }) => 
      customerService.startAttention(id, time),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, variables.id] });
    },
  });
}

export function useFinishAttention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, time }: { id: string, time: string }) => 
      customerService.finishAttention(id, time),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, variables.id] });
    },
  });
}

export function useRegisterAttentionDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: DentalAttentionFormValues }) => 
      customerService.registerAttentionDetails(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, variables.id] });
    },
  });
}

export function useRegisterCustomerIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string, reason: string }) => 
      customerService.registerIncident(id, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, variables.id] });
    },
  });
}

export function useConvertCustomerToTurned() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: string | { id: string, data?: Partial<DentalAttentionFormValues> }) => {
      const id = typeof variables === 'string' ? variables : variables.id;
      const data = typeof variables === 'string' ? undefined : variables.data;
      return customerService.convertToTurned(id, data);
    },
    onSuccess: (_, variables) => {
      const id = typeof variables === 'string' ? variables : variables.id;
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOURNEYS] });
    },
  });
}
