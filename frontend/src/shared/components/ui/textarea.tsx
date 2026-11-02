import * as React from "react"
import { cn } from "@/shared/utils/index"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[64px] w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:border-teal-500 disabled:cursor-not-allowed disabled:opacity-80 disabled:bg-slate-100/60 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white dark:placeholder:text-slate-500 dark:focus-visible:ring-teal-400/40 dark:disabled:bg-slate-950/70 dark:disabled:text-slate-200 transition-all resize-none",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }

