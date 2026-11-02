import { useState, useMemo, useEffect, type ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Inbox, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => ReactNode;
}

export interface BaseTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  defaultPageSize?: number;
  disablePagination?: boolean;
}

export function BaseTable<T>({
  columns,
  data,
  keyExtractor,
  defaultPageSize = 10,
  disablePagination = false,
}: BaseTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Ordenamiento descendente por defecto (más recientes primero)
  const sortedData = useMemo(() => {
    return [...data].sort((a: any, b: any) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (dateA && dateB && dateA !== dateB) {
        return dateB - dateA;
      }
      
      const numA = Number(a.id || a.personId || 0);
      const numB = Number(b.id || b.personId || 0);
      if (numA && numB && numA !== numB) {
        return numB - numA;
      }
      return 0;
    });
  }, [data]);

  const totalItems = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Si los filtros reducen el número de páginas, reajustar a la última página válida
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const displayData = useMemo(() => {
    if (disablePagination) return sortedData;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, disablePagination, startIndex, pageSize]);

  // Generador de números de páginas con elipsis
  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }, [currentPage, totalPages]);

  return (
    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <Table className="w-full text-left">
          <TableHeader className="bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/80">
            <TableRow className="hover:bg-transparent border-none">
              {columns.map((col, index) => (
                <TableHead key={index} className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-4 px-5">
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
            {displayData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-12 text-center text-slate-400 dark:text-slate-500"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Inbox className="h-8 w-8 text-slate-300 dark:text-slate-600 stroke-[1.5]" />
                    <p className="text-sm font-medium">No se encontraron registros en esta etapa.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              displayData.map((item) => (
                <TableRow key={keyExtractor(item)} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors group border-b border-slate-100 dark:border-slate-800">
                  {columns.map((col, index) => (
                    <TableCell key={index} className="py-4 px-5 text-sm text-slate-700 dark:text-slate-200 font-medium">
                      {col.cell
                        ? col.cell(item)
                        : String(item[col.accessorKey as keyof T])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Barra de Paginación Inteligente */}
      {!disablePagination && totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          
          {/* Contador y Selector de Filas */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Mostrando <span className="font-bold text-slate-900 dark:text-white">{startIndex + 1}</span> a <span className="font-bold text-slate-900 dark:text-white">{endIndex}</span> de <span className="font-bold text-slate-900 dark:text-white">{totalItems}</span> registros
            </span>

            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-700">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">Filas:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer shadow-2xs"
              >
                <option value={10}>10 filas</option>
                <option value={15}>15 filas</option>
                <option value={20}>20 filas</option>
                <option value={50}>50 filas</option>
              </select>
            </div>
          </div>

          {/* Controles de Navegación de Páginas */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
                title="Primera página"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
                title="Página anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Botones numéricos */}
              <div className="flex items-center gap-1 mx-1">
                {pageNumbers.map((p, idx) => (
                  p === '...' ? (
                    <span key={`dots-${idx}`} className="px-1.5 text-slate-400 select-none">...</span>
                  ) : (
                    <button
                      key={`page-${p}`}
                      type="button"
                      onClick={() => setCurrentPage(Number(p))}
                      className={`h-7 min-w-7 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        currentPage === p
                          ? 'bg-teal-600 text-white shadow-xs font-bold'
                          : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {p}
                    </button>
                  )
                ))}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
                title="Página siguiente"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
                title="Última página"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
