import type { 
  Payer, Payment, PaymentIncident, Customer
} from '@/domain/entities';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export type ReservationHistoryItem = {
  id: string;
  reservationId: string;
  isCurrent: boolean;
  serviceName: string;
  amount: number;
  channel?: string;
  state: string;
  statusRaw?: string;
  createdAt?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  sede?: string;
  cancellationReason?: string;
};

export type PayerWithDetails = Payer & { 
  lead: any;
  buyer: any;
  person: any;
  reservation: any;
  payment?: Payment;
  originalPrice?: number;
  serviceName?: string;
  incidents: PaymentIncident[];
  reservationHistory?: ReservationHistoryItem[];
  preReservationsCount?: number;
  history?: PayerWithDetails[];
};

export class PayerUseCases {
  async getAllPayers(): Promise<PayerWithDetails[]> {
    const res = await fetch(`${API_URL}/payer`);
    if (!res.ok) throw new Error('Error fetching payers');
    return res.json();
  }

  async getPayerById(id: string): Promise<PayerWithDetails | null> {
    const res = await fetch(`${API_URL}/payer/${id}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Error fetching payer');
    }
    return res.json();
  }

  async registerPayment(payerId: string, data: any): Promise<Payment> {
    const res = await fetch(`${API_URL}/payer/${payerId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al registrar comprobante de pago');
    }
    const result = await res.json();
    return result.pago as Payment;
  }

  async validatePayment(payerId: string): Promise<Payer> {
    const res = await fetch(`${API_URL}/payer/${payerId}/validate`, { method: 'POST' });
    if (!res.ok) throw new Error('Error validating payment');
    const data = await res.json();
    return data.pago as any;
  }

  async rejectPayment(payerId: string, reason: string): Promise<Payer> {
    const res = await fetch(`${API_URL}/payer/${payerId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (!res.ok) throw new Error('Error rejecting payment');
    return res.json();
  }

  async revertPayment(payerId: string, reason: string): Promise<Payer> {
    const res = await fetch(`${API_URL}/payer/${payerId}/revert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (!res.ok) throw new Error('Error reverting payment');
    return res.json();
  }

  async convertToCustomer(payerId: string): Promise<Customer> {
    const res = await fetch(`${API_URL}/payer/${payerId}/convert-customer`, { method: 'POST' });
    if (!res.ok) throw new Error('Error converting to customer');
    return res.json();
  }
}

export const payerUseCases = new PayerUseCases();
