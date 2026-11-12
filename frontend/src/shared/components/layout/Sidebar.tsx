import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSidebar } from '@/shared/context/SidebarContext';
import { QUERY_KEYS } from '@/shared/constants';
import { SIDEBAR_NAV_GROUPS, type NavItemConfig } from './navigationConfig';

function checkIsItemActive(item: NavItemConfig, pathname: string, search: string): boolean {
  const params = new URLSearchParams(search);

  // Coincidencia para /configuracion (dividido entre Sedes, Roles y Parámetros)
  if (item.matchPath === '/configuracion') {
    if (!pathname.startsWith('/configuracion')) return false;
    const tab = params.get('tab') || 'empresa';
    if (item.id === 'cfg-sedes') return tab === 'sedes';
    if (item.id === 'cfg-roles') return tab === 'usuarios';
    return tab !== 'sedes' && tab !== 'usuarios';
  }

  // Prevenir que /customer/agent active tanto 'Customer' como 'Copiloto Customer'
  if (item.matchPath === '/customer' && pathname.startsWith('/customer/agent')) {
    return false;
  }

  return pathname === item.matchPath || pathname.startsWith(`${item.matchPath}/`);
}

export function Sidebar({
  onClickItem,
  forceExpanded = false,
}: {
  onClickItem?: () => void;
  forceExpanded?: boolean;
}) {
  const { isCollapsed: contextCollapsed } = useSidebar();
  const isCollapsed = forceExpanded ? false : contextCollapsed;
  const location = useLocation();
  const queryClient = useQueryClient();

  // Contadores discretos de actividad pendiente desde caché o valores operativos base
  const badgeCounts = useMemo<Record<string, string | null>>(() => {
    const buyers = (queryClient.getQueryData([QUERY_KEYS.BUYERS]) as any[]) || [];
    const leads = (queryClient.getQueryData([QUERY_KEYS.LEADS]) as any[]) || [];
    const payers = (queryClient.getQueryData([QUERY_KEYS.PAYERS]) as any[]) || [];

    const newBuyersCount =
      buyers.length > 0
        ? buyers.filter((b: any) => String(b.state || '').toUpperCase().includes('NUEVO')).length
        : 3;

    const pendingLeadsCount =
      leads.length > 0
        ? leads.filter((l: any) => !String(l.state || '').toUpperCase().includes('CONVERT')).length
        : 0;

    const pendingPayersCount =
      payers.length > 0
        ? payers.filter((p: any) => String(p.state || '').toUpperCase().includes('PEND')).length
        : 2;

    return {
      buyers_pending: newBuyersCount > 0 ? `${newBuyersCount} pendientes` : null,
      leads_pending: pendingLeadsCount > 0 ? String(pendingLeadsCount) : null,
      payers_pending: pendingPayersCount > 0 ? String(pendingPayersCount) : null,
      appointments_today: '4 hoy',
    };
  }, [queryClient, location.pathname]);

  return (
    <div className="flex h-full flex-col justify-between select-none">
      <div className="space-y-5">
        {SIDEBAR_NAV_GROUPS.map((group) => (
          <div key={group.id} className="space-y-1">
            {!isCollapsed ? (
              <p className="pt-eyebrow px-3 pb-1 !text-[10.5px]">
                {group.label}
              </p>
            ) : (
              <div
                className="mx-auto my-1.5 h-px w-6 bg-[var(--pt-line)]"
                aria-hidden
              />
            )}

            <nav aria-label={group.label} className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = checkIsItemActive(item, location.pathname, location.search);
                const Icon = item.icon;
                const badgeText = item.badgeKey ? badgeCounts[item.badgeKey] : null;

                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    onClick={onClickItem}
                    title={isCollapsed ? `${group.label} · ${item.label}` : undefined}
                    className={`group relative flex items-center rounded-r-md text-[13.5px] transition-colors duration-150 ${
 isCollapsed ? 'justify-center py-2.5 px-2' : 'justify-between px-3 py-2'
 } ${
 isActive
 ? 'border-l-2 border-[color:var(--pt-accent)] bg-[var(--pt-accent-soft)] font-semibold text-[color:var(--pt-ink)] '
 : 'border-l-2 border-transparent font-normal text-[color:var(--pt-ink-2)] hover:bg-[var(--pt-sunken)] hover:text-[color:var(--pt-ink)] '
 }`}
                  >
                    <div
                      className={`flex items-center min-w-0 ${
 isCollapsed ? 'justify-center' : 'gap-2.5'
 }`}
                    >
                      <Icon
                        className={`h-[18px] w-[18px] shrink-0 transition-colors duration-150 ${
 isActive
 ? 'text-[color:var(--pt-accent)] '
 : 'text-[color:var(--pt-muted)] group-hover:text-[color:var(--pt-ink-2)] '
 }`}
                        strokeWidth={1.75}
                      />

                      {!isCollapsed && (
                        <span className="truncate leading-tight">{item.label}</span>
                      )}
                    </div>

                    {!isCollapsed && badgeText && (
                      <span
                        className={`ml-2 shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium leading-none transition-colors ${
 isActive
 ? 'bg-[var(--pt-accent-soft)] text-[color:var(--pt-accent)] '
 : 'bg-[var(--pt-sunken)] text-[color:var(--pt-ink-2)] '
 }`}
                      >
                        {badgeText}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
    </div>
  );
}
