import type { Customer } from '@/domain/entities';
import { CustomerState } from '@/domain/enums';
export type CustomerWithDetails = any;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export class CustomerUseCases {
  async getAllCustomers(): Promise<any[]> {
    const res = await fetch(`${API_URL}/customer`);
    if (!res.ok) throw new Error('Error fetching customers');
    return res.json();
  }

  async getCustomerById(id: string): Promise<any | null> {
    const res = await fetch(`${API_URL}/customer/${id}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Error fetching customer');
    }
    return res.json();
  }

  async changeState(customerId: string, newState: CustomerState): Promise<Customer> {
    const res = await fetch(`${API_URL}/customer/${customerId}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: newState })
    });
    if (!res.ok) throw new Error('Error updating customer state');
    return res.json();
  }

  async startAttention(customerId: string, time: string): Promise<Customer> {
    const res = await fetch(`${API_URL}/customer/${customerId}/start-attention`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Error starting attention');
    return res.json();
  }

  async finishAttention(customerId: string, time: string): Promise<Customer> {
    const res = await fetch(`${API_URL}/customer/${customerId}/finish-attention`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Error finishing attention');
    return res.json();
  }

  async registerAttentionDetails(customerId: string, details: Partial<any>): Promise<Customer> {
    const res = await fetch(`${API_URL}/customer/${customerId}/attention-details`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details)
    });
    if (!res.ok) throw new Error('Error updating attention details');
    return res.json();
  }

  async registerIncident(customerId: string, reason: string): Promise<any> {
    const res = await fetch(`${API_URL}/customer/${customerId}/incident`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (!res.ok) throw new Error('Error reporting incident');
    return res.json();
  }

  async convertToTurned(customerId: string): Promise<any> {
    const res = await fetch(`${API_URL}/customer/${customerId}/convert-turned`, {
      method: 'POST'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error converting to turned');
    }
    return res.json();
  }
}

export const customerUseCases = new CustomerUseCases();
