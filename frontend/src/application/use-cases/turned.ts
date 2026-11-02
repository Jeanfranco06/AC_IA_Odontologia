import type { TurnedRecord } from '@/domain/entities';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export type TurnedWithDetails = TurnedRecord & { 
  customer: any; 
  person: any;
  lead: any;
  reservation: any;
  attention: any;
  followUps: any[];
};

export class TurnedUseCases {
  async getAllTurneds(): Promise<TurnedWithDetails[]> {
    const res = await fetch(`${API_URL}/turned`);
    if (!res.ok) throw new Error('Error fetching turneds');
    return res.json();
  }

  async getTurnedById(id: string): Promise<TurnedWithDetails | null> {
    const res = await fetch(`${API_URL}/turned/${id}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Error fetching turned');
    }
    return res.json();
  }

  async addFollowUp(id: string, data: any): Promise<TurnedRecord> {
    const res = await fetch(`${API_URL}/turned/${id}/follow-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error adding follow-up');
    return res.json();
  }

  async updateTurnedDetails(id: string, data: Partial<TurnedRecord>): Promise<TurnedRecord> {
    const res = await fetch(`${API_URL}/turned/${id}/details`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error updating turned details');
    return res.json();
  }

  async createNewRequest(id: string, data: any): Promise<any> {
    const res = await fetch(`${API_URL}/turned/${id}/new-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error creating new request');
    return res.json();
  }
}

export const turnedUseCases = new TurnedUseCases();
