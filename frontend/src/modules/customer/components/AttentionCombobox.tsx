import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { StaffAttentionItem } from '../services/customerAiAgentApi';

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function highlight(text: string, terms: string[]) {
  if (terms.length === 0) return text;
  const plain = normalize(text);
  const marks: boolean[] = new Array(text.length).fill(false);
  for (const term of terms) {
    let from = 0;
    while (term && (from = plain.indexOf(term, from)) !== -1) {
      for (let i = from; i < from + term.length && i < marks.length; i++) marks[i] = true;
      from += term.length;
    }
  }
  const parts: { t: string; m: boolean }[] = [];
  [...text].forEach((ch, i) => {
    const last = parts[parts.length - 1];
    if (last && last.m === marks[i]) last.t += ch;
    else parts.push({ t: ch, m: marks[i] });
  });
  return parts.map((p, i) =>
    p.m ? <mark key={i} className="bg-transparent font-bold text-[color:var(--pt-accent)] underline decoration-[1.5px] underline-offset-2">{p.t}</mark> : <span key={i}>{p.t}</span>
  );
}

interface Props {
  items: StaffAttentionItem[];
  value: string;
  onSelect: (attentionId: number) => void;
  disabled?: boolean;
  labelledBy?: string;
}

/** Combobox con búsqueda por nombre, servicio, sede, profesional o n.º de atención. */
export function AttentionCombobox({ items, value, onSelect, disabled, labelledBy }: Props) {
  const uid = useId();
  const listId = `${uid}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const selected = items.find((item) => String(item.id_atencion) === value) || null;

  const terms = useMemo(() => normalize(query).split(/\s+/).filter(Boolean), [query]);
  const results = useMemo(() => {
    if (terms.length === 0) return items;
    return items.filter((item) => {
      const haystack = normalize(`${item.paciente} ${item.servicio} ${item.sede} ${item.profesional} ${item.id_atencion}`);
      return terms.every((term) => haystack.includes(term));
    });
  }, [items, terms]);

  useEffect(() => { setActive(0); }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) { setOpen(false); setQuery(''); }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${uid}-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, uid]);

  function choose(item: StaffAttentionItem) {
    onSelect(item.id_atencion);
    setOpen(false);
    setQuery('');
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); else setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open) { e.preventDefault(); if (results[active]) choose(results[active]); }
    else if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false); setQuery(''); }
    else if (e.key === 'Home' && open) { e.preventDefault(); setActive(0); }
    else if (e.key === 'End' && open) { e.preventDefault(); setActive(Math.max(results.length - 1, 0)); }
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--pt-muted)]" strokeWidth={1.75} />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-labelledby={labelledBy}
          aria-activedescendant={open && results[active] ? `${uid}-opt-${active}` : undefined}
          autoComplete="off"
          disabled={disabled}
          value={open ? query : selected ? `${selected.paciente}` : ''}
          placeholder={open && selected ? selected.paciente : 'Buscar paciente por nombre…'}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
          className="pt-input !pl-11 !pr-16"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {query && (
            <button type="button" aria-label="Borrar búsqueda" onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="grid h-7 w-7 place-items-center rounded text-[color:var(--pt-muted)] hover:text-[color:var(--pt-ink)]">
              <X className="h-4 w-4" />
            </button>
          )}
          <button type="button" tabIndex={-1} aria-label={open ? 'Cerrar lista' : 'Abrir lista'} onClick={() => { setOpen((o) => !o); inputRef.current?.focus(); }} className="grid h-7 w-7 place-items-center rounded text-[color:var(--pt-muted)] hover:text-[color:var(--pt-ink)]">
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {selected && !open && (
        <p className="mt-1.5 text-[12px] text-[color:var(--pt-muted)]">
          <span className="pt-num">#{selected.id_atencion}</span> · {selected.servicio} · {selected.sede}
        </p>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-md border border-[color:var(--pt-line-strong)] bg-[var(--pt-surface)] shadow-[0_24px_40px_-20px_rgba(0,0,0,0.45)] pt-rise" style={{ '--i': 0 } as React.CSSProperties}>
          <ul id={listId} role="listbox" aria-label="Pacientes asignados" className="max-h-[300px] overflow-y-auto py-1">
            {results.length === 0 ? (
              <li className="px-4 py-6 text-center text-[13px] text-[color:var(--pt-muted)]" role="option" aria-selected="false" aria-disabled="true">
                Ningún paciente coincide con “{query}”.
              </li>
            ) : results.map((item, index) => {
              const isActive = index === active;
              const isSelected = String(item.id_atencion) === value;
              return (
                <li
                  key={item.id_atencion}
                  id={`${uid}-opt-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(item)}
                  className={`flex cursor-pointer items-start justify-between gap-3 border-l-2 px-4 py-2.5 ${isActive ? 'border-[color:var(--pt-accent)] bg-[var(--pt-accent-soft)]' : 'border-transparent'}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[color:var(--pt-ink)]">{highlight(item.paciente, terms)}</p>
                    <p className="truncate text-[12px] text-[color:var(--pt-muted)]">{highlight(item.servicio, terms)} · {highlight(item.sede, terms)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pt-0.5">
                    <span className="pt-num text-[11px] text-[color:var(--pt-muted)]">#{highlight(String(item.id_atencion), terms)}</span>
                    {isSelected && <Check className="h-4 w-4 text-[color:var(--pt-accent)]" strokeWidth={2} />}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between border-t border-[color:var(--pt-line)] px-4 py-2 text-[11px] text-[color:var(--pt-muted)]">
            <span aria-live="polite">{results.length} de {items.length}</span>
            <span className="hidden sm:inline">↑↓ navegar · Enter elegir · Esc cerrar</span>
          </div>
        </div>
      )}
    </div>
  );
}
