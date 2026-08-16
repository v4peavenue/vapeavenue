import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg font-bold whitespace-nowrap transition-all outline-none select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer",
  {
    variants: {
      variant: {
        default: "neu-primary-btn text-white tracking-wide shadow-none",
        outline:
          "neu-btn text-slate-700 hover:text-blue-600 border-0 shadow-none",
        secondary:
          "neu-btn text-slate-700 hover:text-blue-600 border-0 shadow-none",
        ghost:
          "text-slate-600 hover:text-blue-600 hover:neu-flat-sm active:neu-inset-sm font-semibold border-0",
        destructive:
          "neu-btn text-rose-600 hover:text-rose-700 active:neu-inset-sm border-0 font-bold",
        link: "text-blue-600 underline-offset-4 hover:underline font-semibold",
      },
      size: {
        default:
          "h-9 gap-2 px-3 text-xs sm:text-sm rounded-lg",
        xs: "h-6 gap-1 rounded-md px-2 text-[11px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 rounded-md px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-4.5 text-sm sm:text-base rounded-xl",
        icon: "size-9 rounded-lg",
        "icon-xs":
          "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-md",
        "icon-lg": "size-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
