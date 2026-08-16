import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 sm:h-9 w-full min-w-0 rounded-lg neu-inset bg-[#E6ECF5] px-3 py-1.5 text-base sm:text-sm text-slate-800 transition-all outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-bold file:text-slate-700 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 border-0",
        className
      )}
      {...props}
    />
  )
}

export { Input }
