import React, { createContext, useContext, useEffect, useState } from 'react';

export const CLINIC_BRANCH_OPTIONS = [
  { id: 'all', label: 'Todas las sedes', shortLabel: 'Sede Global · Trujillo' },
  { id: 'california', label: 'Sede California', shortLabel: 'Sede California' },
  { id: 'el-golf', label: 'Sede El Golf', shortLabel: 'Sede El Golf' },
  { id: 'centro', label: 'Sede Centro Historico', shortLabel: 'Sede Centro' },
] as const;

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setIsCollapsed: (collapsed: boolean) => void;
  activeBranch: string;
  setActiveBranch: (branch: string) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsedState] = useState<boolean>(() => {
    const saved = localStorage.getItem('nexosalud_sidebar_collapsed');
    return saved === 'true';
  });

  const [activeBranch, setActiveBranchState] = useState<string>(() => {
    return localStorage.getItem('nexosalud_active_branch') || 'Sede California';
  });

  const [commandOpen, setCommandOpen] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('nexosalud_sidebar_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    localStorage.setItem('nexosalud_active_branch', activeBranch);
  }, [activeBranch]);

  const toggleSidebar = () => {
    setIsCollapsedState((prev) => !prev);
  };

  const setIsCollapsed = (collapsed: boolean) => {
    setIsCollapsedState(collapsed);
  };

  const setActiveBranch = (branch: string) => {
    setActiveBranchState(branch);
  };

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        toggleSidebar,
        setIsCollapsed,
        activeBranch,
        setActiveBranch,
        commandOpen,
        setCommandOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
