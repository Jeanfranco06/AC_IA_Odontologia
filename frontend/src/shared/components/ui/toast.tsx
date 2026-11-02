import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info, 
  Sparkles, 
  Bot, 
  Calendar, 
  CreditCard, 
  Stethoscope, 
  X 
} from "lucide-react"

import { cn } from "@/shared/utils/index"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-4 right-4 z-[100] flex max-h-screen w-full max-w-[420px] flex-col gap-2.5 p-3 sm:top-5 sm:right-5 sm:p-0 pointer-events-none",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-2xl border shadow-xl transition-all " +
  "bg-white/95 dark:bg-slate-900/95 backdrop-blur-md " +
  "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none " +
  // Animación de entrada: deslizamiento suave desde arriba-derecha con fade-in
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-4 data-[state=open]:sm:slide-in-from-right-8 data-[state=open]:duration-300 data-[state=open]:ease-out " +
  // Animación de salida: deslizamiento hacia la derecha con fade-out
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-full data-[state=closed]:duration-200 data-[state=closed]:ease-in " +
  "data-[swipe=end]:animate-out",
  {
    variants: {
      variant: {
        default: "border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100",
        destructive: "border-rose-200/90 dark:border-rose-900/60 text-slate-900 dark:text-slate-100",
        warning: "border-amber-200/90 dark:border-amber-900/60 text-slate-900 dark:text-slate-100",
        success: "border-emerald-200/90 dark:border-emerald-900/60 text-slate-900 dark:text-slate-100",
        info: "border-sky-200/90 dark:border-sky-900/60 text-slate-900 dark:text-slate-100",
        copilot: "border-teal-200/90 dark:border-teal-900/60 text-slate-900 dark:text-slate-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export function cleanEmojiText(text: React.ReactNode): React.ReactNode {
  if (typeof text !== 'string') return text;
  return text
    .replace(/[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function resolveToastMeta(
  variant?: string | null,
  title?: React.ReactNode,
  description?: React.ReactNode,
  customIcon?: React.ReactNode
) {
  if (customIcon) {
    return {
      icon: customIcon,
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      progressClass: "bg-slate-500",
    };
  }

  const text = `${typeof title === 'string' ? title : ''} ${typeof description === 'string' ? description : ''}`.toLowerCase();

  // 1. Destructive / Error
  if (
    variant === 'destructive' ||
    text.includes('error') ||
    text.includes('fallo') ||
    text.includes('rechazad') ||
    text.includes('eliminad') ||
    text.includes('no se pudo')
  ) {
    return {
      icon: <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />,
      badgeClass: "bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 ring-2 ring-rose-100/70 dark:ring-rose-950/50",
      progressClass: "bg-rose-500",
    };
  }

  // 2. Warning / Alerta / Bloqueo
  if (
    variant === 'warning' ||
    text.includes('alerta') ||
    text.includes('advertencia') ||
    text.includes('tolerancia') ||
    text.includes('alt-c') ||
    text.includes('sobretiempo') ||
    text.includes('bloqueo') ||
    text.includes('atención') ||
    text.includes('atencion') ||
    text.includes('precio inválido') ||
    text.includes('precio invalido') ||
    text.includes('cancelad')
  ) {
    return {
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />,
      badgeClass: "bg-amber-50 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 ring-2 ring-amber-100/70 dark:ring-amber-950/50",
      progressClass: "bg-amber-500",
    };
  }

  // 3. Success
  if (
    variant === 'success' ||
    text.includes('éxito') ||
    text.includes('exito') ||
    text.includes('guardad') ||
    text.includes('actualizad') ||
    text.includes('registrad') ||
    text.includes('confirmad') ||
    text.includes('finalizad') ||
    text.includes('convertid') ||
    text.includes('transferid') ||
    text.includes('enviad') ||
    text.includes('aprobado') ||
    text.includes('pagado') ||
    text.includes('validado') ||
    text.includes('copiad') ||
    text.includes('seleccionada')
  ) {
    return {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      badgeClass: "bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-100/70 dark:ring-emerald-950/50",
      progressClass: "bg-emerald-500",
    };
  }

  // 4. Copilot / IA / Análisis
  if (
    variant === 'copilot' ||
    text.includes('copilot') ||
    text.includes('ia') ||
    text.includes('análisis') ||
    text.includes('analisis') ||
    text.includes('marketing') ||
    text.includes('inteligencia') ||
    text.includes('triaje') ||
    text.includes('score')
  ) {
    return {
      icon: <Bot className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />,
      badgeClass: "bg-teal-50 dark:bg-teal-950/70 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 ring-2 ring-teal-100/70 dark:ring-teal-950/50",
      progressClass: "bg-teal-500",
    };
  }

  // 5. Citas / Agenda
  if (text.includes('cita') || text.includes('reserva') || text.includes('asistencia') || text.includes('agenda')) {
    return {
      icon: <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />,
      badgeClass: "bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-100/70 dark:ring-indigo-950/50",
      progressClass: "bg-indigo-500",
    };
  }

  // 6. Default / Info
  return {
    icon: <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />,
    badgeClass: "bg-sky-50 dark:bg-sky-950/70 border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400 ring-2 ring-sky-100/70 dark:ring-sky-950/50",
    progressClass: "bg-sky-500",
  };
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants> & {
      icon?: React.ReactNode;
      duration?: number;
      title?: React.ReactNode;
      description?: React.ReactNode;
    }
>(({ className, variant, icon: customIcon, duration = 5000, title, description, children, ...props }, ref) => {
  const meta = resolveToastMeta(variant, title, description, customIcon);

  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      <div className="p-3.5 sm:p-4 flex items-start gap-3 w-full">
        {/* Badge con Ícono SVG de Framework */}
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-xs transition-transform duration-200 group-hover:scale-105",
          meta.badgeClass
        )}>
          {meta.icon}
        </div>

        {/* Contenido Textual */}
        <div className="flex-1 min-w-0 pr-6 space-y-0.5">
          {children}
        </div>
      </div>

      {/* Barra de Progreso de Tiempo de Notificación */}
      <div className="w-full h-1 bg-slate-100/80 dark:bg-slate-800/80 overflow-hidden shrink-0">
        <div 
          className={cn("h-full animate-toast-progress origin-left", meta.progressClass)}
          style={{
            ['--toast-duration' as any]: `${duration}ms`
          }}
        />
      </div>
    </ToastPrimitives.Root>
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-7 shrink-0 items-center justify-center rounded-lg border bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2.5 top-2.5 rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all focus:outline-none",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, children, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-xs sm:text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-tight", className)}
    {...props}
  >
    {cleanEmojiText(children)}
  </ToastPrimitives.Title>
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, children, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed", className)}
    {...props}
  >
    {cleanEmojiText(children)}
  </ToastPrimitives.Description>
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}

