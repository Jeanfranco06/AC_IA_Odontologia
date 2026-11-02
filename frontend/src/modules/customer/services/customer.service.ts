import { customerUseCases, type CustomerWithDetails } from '@/application/use-cases/customer';
import { CustomerState } from '@/domain/enums';
import type { DentalAttentionFormValues } from '../schemas/customerSchema';

const useApi = import.meta.env.VITE_USE_API !== 'false';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function apiError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return new Error(body.error || fallback);
  } catch {
    return new Error(fallback);
  }
}

export const customerService = {
  getAllCustomers: async (): Promise<CustomerWithDetails[]> => {
    if (!useApi) return customerUseCases.getAllCustomers();
    const res = await fetch(API_URL + '/customer');
    if (!res.ok) throw await apiError(res, 'Error al cargar customers');
    return res.json();
  },

  getCustomerById: async (id: string): Promise<CustomerWithDetails | null> => {
    if (!useApi) return customerUseCases.getCustomerById(id) as Promise<CustomerWithDetails | null>;
    const res = await fetch(API_URL + '/customer/' + id);
    if (!res.ok) throw await apiError(res, 'Error al cargar customer');
    return res.json();
  },

  changeState: async (id: string, state: CustomerState) => {
    if (!useApi) return customerUseCases.changeState(id, state);
    const res = await fetch(API_URL + '/customer/' + id + '/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state })
    });
    if (!res.ok) throw await apiError(res, 'Error al cambiar estado');
    return res.json();
  },

  startAttention: async (id: string, time: string) => {
    if (!useApi) return customerUseCases.startAttention(id, time);
    const res = await fetch(API_URL + '/customer/' + id + '/start-attention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time })
    });
    if (!res.ok) throw await apiError(res, 'Error al iniciar atención');
    return res.json();
  },

  finishAttention: async (id: string, time: string) => {
    if (!useApi) return customerUseCases.finishAttention(id, time);
    const res = await fetch(API_URL + '/customer/' + id + '/finish-attention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time })
    });
    if (!res.ok) throw await apiError(res, 'Error al finalizar atención');
    return res.json();
  },

  registerAttentionDetails: async (id: string, data: DentalAttentionFormValues) => {
    if (!useApi) return customerUseCases.registerAttentionDetails(id, data);
    const res = await fetch(API_URL + '/customer/' + id + '/attention-details', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw await apiError(res, 'Error al registrar detalles');
    return res.json();
  },

  registerIncident: async (id: string, reason: string) => {
    if (!useApi) return customerUseCases.registerIncident(id, reason);
    const res = await fetch(API_URL + '/customer/' + id + '/incident', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (!res.ok) throw await apiError(res, 'Error al registrar incidencia');
    return res.json();
  },

  convertToTurned: async (id: string, data?: Partial<DentalAttentionFormValues>) => {
    if (!useApi) return customerUseCases.convertToTurned(id);
    const res = await fetch(API_URL + '/customer/' + id + '/convert-turned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {})
    });
    if (!res.ok) throw await apiError(res, 'Error al convertir a TURNED');
    return res.json();
  }
};
