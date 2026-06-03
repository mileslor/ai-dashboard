"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"button"> & {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "icon";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-3 disabled:opacity-50 disabled:pointer-events-none",
        {
          "bg-blue-600 text-white hover:bg-blue-700": variant === "default",
          "border border-input bg-background hover:bg-muted": variant === "outline",
          "hover:bg-muted": variant === "ghost",
          "bg-destructive/10 text-destructive hover:bg-destructive/20": variant === "destructive",
          "h-8 px-3 gap-2": size === "default",
          "h-7 px-2 text-xs": size === "sm",
          "size-8": size === "icon",
        },
        className
      )}
      {...props}
    />
  );
}
export { Button };
