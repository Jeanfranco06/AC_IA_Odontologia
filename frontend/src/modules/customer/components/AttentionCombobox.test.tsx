import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AttentionCombobox } from './AttentionCombobox';
import type { StaffAttentionItem } from '../services/customerAiAgentApi';
beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });
afterEach(cleanup);
it('distingue las sesiones de un mismo paciente por fecha, número y estado en hora de Lima', () => {
  const base = { id_tratamiento: 30, id_persona: 10, paciente: 'Paciente Simulada', servicio: 'Restauración', profesional: 'Profesional de prueba', sede: 'Centro', validaciones_count: 0, indicaciones_count: 0 };
  const items: StaffAttentionItem[] = [
    { ...base, id_atencion: 101, numero_sesion: 1, fecha_hora: '2026-11-11T20:00:00Z', estado: 'Finalizado', cierre_documental: 'Cerrada' },
    { ...base, id_atencion: 102, numero_sesion: 2, fecha_hora: '2026-11-18T20:00:00Z', estado: 'Programado', cierre_documental: 'Pendiente' }
  ];
  const select = vi.fn();
  render(<AttentionCombobox items={items} value="" onSelect={select} />);
  fireEvent.focus(screen.getByRole('combobox'));
  expect(screen.getByRole('option', { name: /Sesión 1.*11\/11\/2026.*15:00.*Finalizado.*Cerrada/ })).toBeInTheDocument();
  const future = screen.getByRole('option', { name: /Sesión 2.*18\/11\/2026.*15:00.*Programado.*Pendiente/ });
  fireEvent.click(future);
  expect(select).toHaveBeenCalledWith(102);
  fireEvent.focus(screen.getByRole('combobox'));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '18/11/2026' } });
  expect(screen.getAllByRole('option')).toHaveLength(1);
});
