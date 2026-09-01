interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  action?: React.ReactNode;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  action,
}: SectionHeaderProps) {
  const centered = align === "center";

  return (
    <div
      className={`mb-12 md:mb-14 ${centered ? "text-center" : ""} ${action ? "flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between" : ""}`}
    >
      <div className={centered ? "mx-auto max-w-2xl" : ""}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className={`section-title ${eyebrow ? "mt-3" : ""}`}>{title}</h2>
        <div className={`section-rule ${centered ? "mx-auto" : ""}`} />
        {description && (
          <p className={`mt-5 text-base leading-relaxed text-text-muted ${centered ? "" : "max-w-xl"}`}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
