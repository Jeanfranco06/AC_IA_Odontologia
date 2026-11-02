import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Trash2, ShieldAlert } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  isLoading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar Eliminación',
  cancelText = 'Cancelar',
  variant = 'destructive',
  isLoading = false,
  children,
}: ConfirmationDialogProps) {
  const isDestructive = variant === 'destructive';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isLoading && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto no-scrollbar rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-4 ${
              isDestructive
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 ring-rose-50/70 dark:ring-rose-950/40 border border-rose-200/60 dark:border-rose-800/60'
                : 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 ring-teal-50/70 dark:ring-teal-950/40 border border-teal-200/60 dark:border-teal-800/60'
            }`}
          >
            {isDestructive ? (
              <Trash2 className="h-6 w-6 stroke-[1.8]" />
            ) : (
              <ShieldAlert className="h-6 w-6 stroke-[1.8]" />
            )}
          </div>
          <div className="space-y-1.5 flex-1">
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
              {description}
            </DialogDescription>
          </div>
        </div>

        {children && <div className="py-2 text-sm text-slate-700 dark:text-slate-300">{children}</div>}

        <DialogFooter className="mt-6 flex flex-row items-center justify-end gap-2.5 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white text-xs font-semibold px-4 py-2"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            disabled={isLoading}
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
            className={`rounded-xl text-xs font-semibold px-4 py-2 shadow-sm transition-all transform active:scale-95 ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20'
            }`}
          >
            {isLoading ? 'Procesando...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
