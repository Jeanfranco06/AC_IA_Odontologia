import { turnedUseCases, type TurnedWithDetails } from '@/application/use-cases/turned';
import type { NewRequestFormValues } from '../schemas/turnedSchema';

const useApi = import.meta.env.VITE_USE_API !== 'false';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const turnedService = {
  getAllTurneds: async (): Promise<TurnedWithDetails[]> => {
    if (!useApi) return turnedUseCases.getAllTurneds();
    const res = await fetch(API_URL + '/turned');
    if (!res.ok) throw new Error('Error al cargar turneds');
    return res.json();
  },

  getTurnedById: async (id: string): Promise<TurnedWithDetails | null> => {
    if (!useApi) return turnedUseCases.getTurnedById(id) as Promise<TurnedWithDetails | null>;
    const res = await fetch(API_URL + '/turned/' + id);
    if (!res.ok) throw new Error('Error al cargar turned');
    return res.json();
  },

  addFollowUp: async (id: string, data: import('../schemas/turnedSchema').FollowUpFormValues) => {
    if (!useApi) return turnedUseCases.addFollowUp(id, data);
    const res = await fetch(API_URL + '/turned/' + id + '/follow-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al guardar follow-up');
    return res.json();
  },

  updateTurnedDetails: async (id: string, data: Partial<import('@/domain/entities').TurnedRecord>) => {
    if (!useApi) return turnedUseCases.updateTurnedDetails(id, data);
    const res = await fetch(API_URL + '/turned/' + id + '/details', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al actualizar detalles');
    return res.json();
  },

  createNewRequest: async (id: string, data: NewRequestFormValues) => {
    if (!useApi) return turnedUseCases.createNewRequest(id, data);
    const res = await fetch(API_URL + '/turned/' + id + '/new-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al crear request');
    
    const parsedData = await res.json();
    return parsedData;
  }
};
