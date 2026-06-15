"use client";

import { useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { iconInputClassName, iconSelectClassName } from "@/app/components/ui/form-styles";
import { IconEye, IconEyeSlash, IconLock } from "@/app/components/ui/icons";

const iconSlotClassName =
  "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400";

type IconInputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon: ReactNode;
  wrapperClassName?: string;
};

export function IconInput({
  icon,
  className = "",
  wrapperClassName = "",
  ...props
}: IconInputProps) {
  return (
    <div className={`relative ${wrapperClassName}`.trim()}>
      <span className={iconSlotClassName}>{icon}</span>
      <input
        {...props}
        className={`${iconInputClassName} pr-3 ${className}`.trim()}
      />
    </div>
  );
}

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  wrapperClassName?: string;
};

export function PasswordInput({
  className = "",
  wrapperClassName = "",
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={`relative ${wrapperClassName}`.trim()}>
      <IconLock className={iconSlotClassName} />
      <input
        {...props}
        type={showPassword ? "text" : "password"}
        className={`${iconInputClassName} pr-11 ${className}`.trim()}
      />
      <button
        type="button"
        className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
        onClick={() => setShowPassword((current) => !current)}
        aria-label={showPassword ? "Paslēpt paroli" : "Rādīt paroli"}
      >
        {showPassword ? <IconEyeSlash className="size-4" /> : <IconEye className="size-4" />}
      </button>
    </div>
  );
}

type IconSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  icon: ReactNode;
  wrapperClassName?: string;
};

export function IconSelect({
  icon,
  children,
  className = "",
  wrapperClassName = "",
  ...props
}: IconSelectProps) {
  return (
    <div className={`relative ${wrapperClassName}`.trim()}>
      <span className={iconSlotClassName}>{icon}</span>
      <select {...props} className={`${iconSelectClassName} ${className}`.trim()}>
        {children}
      </select>
    </div>
  );
}
