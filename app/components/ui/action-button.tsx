import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  dangerButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui/form-styles";
import { IconSpinner } from "@/app/components/ui/icons";

export type ActionButtonVariant = "primary" | "secondary" | "danger";

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ActionButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
};

function variantClassName(variant: ActionButtonVariant): string {
  switch (variant) {
    case "secondary":
      return secondaryButtonClassName;
    case "danger":
      return dangerButtonClassName;
    default:
      return primaryButtonClassName;
  }
}

export function ActionButton({
  variant = "primary",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  type = "button",
  ...props
}: ActionButtonProps) {
  const isDisabled = Boolean(disabled) || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`${variantClassName(variant)} ${loading ? "!opacity-100" : ""} ${className}`.trim()}
      {...props}
    >
      {loading ? <IconSpinner /> : icon}
      {children}
    </button>
  );
}
