import type { Buyer, Person, Lead } from '@/domain/entities';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export type BuyerWithPerson = Buyer & { person: Person };

export class BuyerUseCases {
  async getAllBuyers(): Promise<BuyerWithPerson[]> {
    const res = await fetch(`${API_URL}/buyer`);
    if (!res.ok) throw new Error('Error fetching buyers');
    return res.json();
  }

  async getBuyerById(id: string): Promise<BuyerWithPerson | null> {
    const res = await fetch(`${API_URL}/buyer`);
    if (!res.ok) throw new Error('Error fetching buyers');
    const buyers = await res.json();
    return buyers.find((b: any) => b.id === id || b.personId === id) || null;
  }

  async createBuyer(data: {
    firstName: string; lastName: string; documentType?: string; documentNumber?: string;
    email?: string; phone?: string; channel: string; attractionSource: string;
    serviceOfInterestId?: string; preferences?: string; contactAuthorization: boolean;
    concreteRequest?: string;
  }): Promise<BuyerWithPerson> {
    const res = await fetch(`${API_URL}/buyer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al crear BUYER');
    }
    return res.json();
  }

  async updateBuyer(id: string, data: Partial<Buyer> & { person?: Partial<Person> }): Promise<BuyerWithPerson> {
    const res = await fetch(`${API_URL}/buyer/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar BUYER');
    }
    return res.json();
  }

  async convertToLead(buyerId: string | number): Promise<Lead> {
    const res = await fetch(`${API_URL}/buyer/${buyerId}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al convertir a LEAD');
    }
    return res.json();
  }
}

export const buyerUseCases = new BuyerUseCases();
