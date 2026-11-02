import { type ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function MetricCard({ title, value, icon, trend }: MetricCardProps) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col">
      <div className="flex items-center justify-between space-y-0 pb-2">
        <h3 className="tracking-tight text-sm font-medium text-muted-foreground">
          {title}
        </h3>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className="text-xs text-muted-foreground">
            <span
              className={
                trend.isPositive ? 'text-secondary' : 'text-destructive'
              }
            >
              {trend.isPositive ? '+' : '-'}
              {Math.abs(trend.value)}%
            </span>{' '}
            desde el mes pasado
          </p>
        )}
      </div>
    </div>
  );
}
