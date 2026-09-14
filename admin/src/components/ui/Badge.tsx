type Variant = "green" | "red" | "orange" | "gray" | "blue";

type Props = {
  variant?: Variant;
  children: React.ReactNode;
};

const variantClass: Record<Variant, string> = {
  green: "bg-accent-soft text-accent",
  red: "bg-danger-soft text-danger",
  orange: "bg-warning-soft text-warning",
  gray: "bg-sunken text-muted",
  blue: "bg-info-soft text-info",
};

export default function Badge({ variant = "gray", children }: Props) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
        variantClass[variant],
      ].join(" ")}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
      {children}
    </span>
  );
}
