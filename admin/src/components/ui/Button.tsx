import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
};

const variantClass: Record<Variant, string> = {
  primary:
    "bg-[#007A53] hover:bg-[#056666] text-white border-transparent",
  secondary:
    "bg-white dark:bg-[#1E1E1E] hover:bg-gray-50 text-[#232323] dark:text-white border-[#E5E2DE] dark:border-[#2E2E2E]",
  danger:
    "bg-[#DA291C] hover:bg-[#b52116] text-white border-transparent",
  ghost:
    "bg-transparent hover:bg-gray-100 text-[#007A53] border-transparent",
};

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  disabled,
  className = "",
  ...rest
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center font-semibold rounded-xl border transition-colors cursor-pointer",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        variantClass[variant],
        sizeClass[size],
        className,
      ].join(" ")}
      {...rest}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
