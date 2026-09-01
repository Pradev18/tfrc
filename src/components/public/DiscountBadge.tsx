interface DiscountBadgeProps {
  percent: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  accentColor?: string;
}

export function DiscountBadge({ percent, size = "md", className = "", accentColor }: DiscountBadgeProps) {
  const sizes = {
    sm: "px-1.5 py-0.5 text-[9px]",
    md: "px-2 py-0.5 text-[10px]",
    lg: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={`inline-flex items-center rounded font-bold uppercase tracking-wide text-white ${sizes[size]} ${className}`}
      style={{ backgroundColor: accentColor ?? "#dc2626" }}
    >
      {percent}% OFF
    </span>
  );
}
