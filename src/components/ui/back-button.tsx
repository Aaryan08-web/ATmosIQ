import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BackButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}

export function BackButton({
  label = "Back",
  className,
  variant,
  size,
  onClick,
  ...props
}: BackButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden bg-[#174C34]/90 text-[#F2F5F2] hover:bg-[#2E8B57] border border-[#2E8B57]/60 cursor-pointer transition-all shadow-sm",
        className
      )}
      {...props}
    >
      <span className="w-20 translate-x-2 transition-opacity duration-500 group-hover:opacity-0 text-center font-medium">
        {label}
      </span>
      <i className="absolute inset-0 z-10 grid w-1/4 place-items-center bg-white/15 transition-all duration-500 group-hover:w-full not-italic">
        <ArrowLeft
          className="opacity-70 group-hover:opacity-100 transition-opacity"
          size={16}
          strokeWidth={2}
          aria-hidden="true"
        />
      </i>
    </Button>
  );
}

export default BackButton;
