import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CornerDownLeft,
  Search,
  User,
  X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog';
import { QUERY_KEYS } from '@/shared/constants';
import { STATIC_COMMAND_ITEMS, type QuickCommandItem } from './navigationConfig';

interface CommandPaletteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPaletteModal({ open, onOpenChange }: CommandPaletteModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Construye ítems dinámicos de pacientes en caché (Buyers / Leads / Customers)
  const patientCommandItems = useMemo<QuickCommandItem[]>(() => {
    if (!open) return [];
    const results: QuickCommandItem[] = [];
    const seenNames = new Set<string>();

    const buyers = (queryClient.getQueryData([QUERY_KEYS.BUYERS]) as any[]) || [];
    for (const b of buyers.slice(0, 25)) {
      const fullName = `${b.person?.firstName || ''} ${b.person?.lastName || ''}`.trim();
      if (!fullName || seenNames.has(fullName.toLowerCase())) continue;
      seenNames.add(fullName.toLowerCase());
      const docOrPhone = b.person?.documentNumber || b.person?.phone || 'Sin documento';
      results.push({
        id: `patient-buyer-${b.id}`,
        title: fullName,
        subtitle: `Paciente (Buyer) · ${docOrPhone} · ${b.serviceOfInterest || 'Evaluación'}`,
        category: 'Navegación Clínica',
        to: `/buyer/${b.id}`,
        icon: User,
        keywords: `${fullName.toLowerCase()} ${docOrPhone.toLowerCase()} buyer paciente`,
      });
    }

    const customers = (queryClient.getQueryData([QUERY_KEYS.CUSTOMERS]) as any[]) || [];
    for (const c of customers.slice(0, 25)) {
      const fullName = `${c.person?.firstName || ''} ${c.person?.lastName || ''}`.trim();
      if (!fullName || seenNames.has(fullName.toLowerCase())) continue;
      seenNames.add(fullName.toLowerCase());
      const docOrPhone = c.person?.documentNumber || c.person?.phone || 'Historia activa';
      results.push({
        id: `patient-customer-${c.id}`,
        title: fullName,
        subtitle: `Expediente Clínico · ${docOrPhone}`,
        category: 'Navegación Clínica',
        to: `/customer/${c.id}`,
        icon: User,
        keywords: `${fullName.toLowerCase()} ${docOrPhone.toLowerCase()} customer historia clinica`,
      });
    }

    return results;
  }, [open, queryClient]);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return [...patientCommandItems.slice(0, 3), ...STATIC_COMMAND_ITEMS];
    }

    const all = [...patientCommandItems, ...STATIC_COMMAND_ITEMS];
    return all
      .filter(
        (item) =>
          item.title.toLowerCase().includes(term) ||
          item.subtitle.toLowerCase().includes(term) ||
          item.keywords.includes(term)
      )
      .slice(0, 12);
  }, [query, patientCommandItems]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const handleSelect = (item: QuickCommandItem) => {
    onOpenChange(false);
    setQuery('');
    navigate(item.to);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredItems.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredItems.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
      }
    } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredItems[selectedIndex]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl">
        <DialogTitle className="sr-only">Búsqueda rápida en NexoSalud</DialogTitle>

        {/* Barra de entrada Command-K */}
        <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800 px-4 py-3.5">
          <Search className="h-4 w-4 shrink-0 text-[#0f766e] dark:text-teal-400" strokeWidth={1.75} />
          <input
            ref={inputRef}
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Buscar paciente por nombre/DNI, cita, etapa o reporte matricial…"
            className="flex-1 bg-transparent text-[13px] font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 cursor-pointer"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Lista de resultados */}
        <div className="max-h-[360px] overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-xs font-medium text-slate-500">
                No se encontraron coincidencias para "{query}"
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Intenta buscando por etapa (Buyer, Lead, Payer), "Cohortes", "Odontogramas" o "Sedes".
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item, idx) => {
                const Icon = item.icon;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => handleSelect(item)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-100 cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50/70 dark:bg-teal-950/40 text-slate-900 dark:text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                          isSelected
                            ? 'border-teal-600/30 bg-white dark:bg-slate-900 text-[#0f766e] dark:text-teal-400'
                            : 'border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-500'
                        }`}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium leading-tight">
                          {item.title}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="hidden sm:inline-block rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        {item.category}
                      </span>
                      <ArrowRight
                        className={`h-3.5 w-3.5 transition-transform ${
                          isSelected
                            ? 'translate-x-0.5 text-[#0f766e] dark:text-teal-400'
                            : 'text-slate-300 dark:text-slate-600'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pie del Command Palette */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 px-4 py-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" /> Seleccionar
            </span>
            <span>↑↓ Navegar</span>
          </div>
          <span className="font-mono text-[10.5px]">NexoSalud Command</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
