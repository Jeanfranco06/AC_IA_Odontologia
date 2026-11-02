import { FileSearch } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  title = 'No hay datos disponibles',
  message = 'Aún no se han registrado elementos para esta sección.',
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg border-dashed bg-card/50">
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <FileSearch className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm mb-6">
        {message}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
