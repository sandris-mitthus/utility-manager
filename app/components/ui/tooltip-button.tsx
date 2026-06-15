"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  dangerButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui/form-styles";

type ButtonVariant = "primary" | "secondary" | "danger" | "none";
type TooltipPlacement = "top" | "bottom";

type TooltipButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tooltip: string;
  icon?: ReactNode;
  variant?: ButtonVariant;
  tooltipPlacement?: TooltipPlacement;
  fullWidth?: boolean;
  block?: boolean;
};

function variantClassName(variant: ButtonVariant): string {
  switch (variant) {
    case "primary":
      return primaryButtonClassName;
    case "secondary":
      return secondaryButtonClassName;
    case "danger":
      return dangerButtonClassName;
    default:
      return "inline-flex items-center justify-center gap-2";
  }
}

function iconOnlyClassName(variant: ButtonVariant, className: string): string {
  const compact = "!px-2.5 !py-2.5";
  switch (variant) {
    case "primary":
      return `${primaryButtonClassName} ${compact} ${className}`.trim();
    case "secondary":
      return `${secondaryButtonClassName} ${compact} ${className}`.trim();
    case "danger":
      return `${dangerButtonClassName} ${compact} ${className}`.trim();
    default:
      return `inline-flex items-center justify-center rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim();
  }
}

function tooltipClassName(placement: TooltipPlacement): string {
  const base =
    "pointer-events-none absolute left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100";

  return placement === "bottom" ? `${base} top-full mt-2` : `${base} bottom-full mb-2`;
}

export function TooltipButton({
  tooltip,
  icon,
  variant = "none",
  tooltipPlacement = "top",
  fullWidth = false,
  block = false,
  className = "",
  children,
  type = "button",
  ...props
}: TooltipButtonProps) {
  const classes = [
    variantClassName(variant),
    block || fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={`group relative ${block || fullWidth ? "flex w-full" : "inline-flex"} ${fullWidth ? "w-full" : ""}`}
    >
      <button
        type={type}
        className={classes}
        aria-label={props["aria-label"] ?? tooltip}
        {...props}
      >
        {icon}
        {children}
      </button>
      <span role="tooltip" className={tooltipClassName(tooltipPlacement)}>
        {tooltip}
      </span>
    </span>
  );
}

type TooltipIconButtonProps = Omit<TooltipButtonProps, "children" | "icon"> & {
  icon: ReactNode;
  variant?: ButtonVariant;
};

export function TooltipIconButton({
  tooltip,
  icon,
  variant = "secondary",
  tooltipPlacement = "top",
  className = "",
  type = "button",
  ...props
}: TooltipIconButtonProps) {
  const isFullWidth = className.includes("w-full");

  return (
    <span className={`group relative inline-flex ${isFullWidth ? "w-full" : ""}`}>
      <button
        type={type}
        className={iconOnlyClassName(variant, `${isFullWidth ? "w-full " : ""}${className}`)}
        aria-label={props["aria-label"] ?? tooltip}
        {...props}
      >
        {icon}
      </button>
      <span role="tooltip" className={tooltipClassName(tooltipPlacement)}>
        {tooltip}
      </span>
    </span>
  );
}
