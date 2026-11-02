import type { Lead, Payer, NegotiationAlternative } from '@/domain/entities';
import { LeadState } from '@/domain/enums';
export type LeadWithDetails = any;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export class LeadUseCases {
  async getAllLeads(): Promise<any[]> {
    const res = await fetch(`${API_URL}/lead`);
    if (!res.ok) throw new Error('Error fetching leads');
    return res.json();
  }

  async getLeadById(id: string): Promise<any | null> {
    const res = await fetch(`${API_URL}/lead/${id}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Error fetching lead');
    }
    return res.json();
  }

  async updateLead(id: string, data: Partial<Lead>): Promise<any> {
    const res = await fetch(`${API_URL}/lead/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error updating lead');
    return res.json();
  }

  async addAlternative(leadId: string, altData: Omit<NegotiationAlternative, 'id' | 'leadId'>): Promise<any> {
    const res = await fetch(`${API_URL}/lead/${leadId}/alternative`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(altData)
    });
    if (!res.ok) throw new Error('Error adding alternative');
    return res.json();
  }

  async updateAlternative(id_opcion: string, data: any): Promise<any> {
    const res = await fetch(`${API_URL}/lead/options/${id_opcion}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error updating alternative');
    return res.json();
  }

  async deleteAlternative(id_opcion: string): Promise<any> {
    const res = await fetch(`${API_URL}/lead/options/${id_opcion}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error deleting alternative');
    return res.json();
  }

  async selectAlternativeAndReserve(leadId: string, altId: string): Promise<any> {
    // Note: the backend route expects id_opcion and id_solicitud in the body
    const res = await fetch(`${API_URL}/lead/${leadId}/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_opcion: altId, id_solicitud: 1 }) // Assuming frontend passes correct values later or handles it in service
    });
    if (!res.ok) throw new Error('Error reserving alternative');
    return res.json();
  }

  async convertToPayer(leadId: string): Promise<Payer> {
    // This is handled by reserve in the backend, but if called separately:
    const res = await fetch(`${API_URL}/lead/${leadId}/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!res.ok) throw new Error('Error converting to payer');
    return res.json();
  }
}

export const leadUseCases = new LeadUseCases();
