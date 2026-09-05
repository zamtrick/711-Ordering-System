type Variant = "green" | "red" | "orange" | "gray" | "blue";

type Props = {
  variant?: Variant;
  children: React.ReactNode;
};

const variantClass: Record<Variant, string> = {
  green: "bg-[#E8F5EF] text-[#007A53]",
  red: "bg-[#FFF0F0] text-[#DA291C]",
  orange: "bg-[#FFF3E8] text-[#FF6720]",
  gray: "bg-[#F0F0F0] text-[#777] dark:text-[#A0A0A0]",
  blue: "bg-[#EEF2FF] text-[#4F46E5]",
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
