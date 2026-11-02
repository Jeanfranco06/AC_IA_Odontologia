import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from '../router';
import { ThemeProvider } from '@/shared/context/ThemeContext';
import { SidebarProvider } from '@/shared/context/SidebarContext';

declare global {
  interface Window {
    __fetchInterceptionInstalled?: boolean;
  }
}

// Interceptor para garantizar que las cargas de datos duren mínimo 1.5 segundos (1500ms)
if (typeof window !== 'undefined' && !window.__fetchInterceptionInstalled) {
  window.__fetchInterceptionInstalled = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const isGet = !args[1] || !args[1].method || args[1].method.toUpperCase() === 'GET';
    if (isGet) {
      const startTime = Date.now();
      try {
        const res = await originalFetch(...args);
        const elapsed = Date.now() - startTime;
        if (elapsed < 1500) {
          await new Promise((resolve) => setTimeout(resolve, 1500 - elapsed));
        }
        return res;
      } catch (err) {
        const elapsed = Date.now() - startTime;
        if (elapsed < 1500) {
          await new Promise((resolve) => setTimeout(resolve, 1500 - elapsed));
        }
        throw err;
      }
    }
    return originalFetch(...args);
  };
}

const queryClient = new QueryClient();

export function AppProviders() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}

