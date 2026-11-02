import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
}

export function ErrorState({
  title = 'Ha ocurrido un error',
  message = 'No pudimos cargar la información solicitada.',
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-destructive/10 rounded-lg border border-destructive/20">
      <AlertCircle className="h-10 w-10 text-destructive mb-4" />
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2">{message}</p>
    </div>
  );
}
