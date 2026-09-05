type Variant = "green" | "red" | "orange" | "gray" | "blue";

type Props = {
  variant?: Variant;
  children: React.ReactNode;
};

const variantClass: Record<Variant, string> = {
  green: "bg-[#E8F5EF] dark:bg-[#0A3D3D] text-[#007A53] dark:text-[#4CAF50]",
  red: "bg-[#FFF0F0] dark:bg-[#3D1515] text-[#DA291C] dark:text-[#FF5C5C]",
  orange: "bg-[#FFF3E8] dark:bg-[#3D2A15] text-[#FF6720]",
  gray: "bg-[#F0F0F0] dark:bg-[#2A2A2A] text-[#777] dark:text-[#A0A0A0]",
  blue: "bg-[#EEF2FF] dark:bg-[#1A1A3D] text-[#4F46E5] dark:text-[#818CF8]",
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
