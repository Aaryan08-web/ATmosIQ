import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-emerald-600/50 bg-[#174C34] text-emerald-100 hover:bg-[#1f6646]",
        secondary:
          "border-emerald-800/40 bg-[#101F18] text-[#9CAEA2] hover:bg-[#142920]",
        destructive:
          "border-red-900/40 bg-red-950/60 text-red-300 hover:bg-red-950/80",
        outline: "text-[#F2F5F2] border-emerald-900/60",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

