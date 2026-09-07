"use client";

import { UiSelect } from "@/components/ui/UiSelect";

interface CatalogueToolbarProps {
  totalItems: number;
  currentSort: string;
  environmentSlug: string;
  queryParams: Record<string, string | undefined>;
}

const SORT_LABELS: Record<string, string> = {
  newest: "Newest",
  featured: "Featured",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low",
  discount: "Biggest Discount",
  name: "Name A–Z",
};

export function CatalogueToolbar({
  totalItems,
  currentSort,
  environmentSlug,
  queryParams,
}: CatalogueToolbarProps) {
  const base = `/${environmentSlug}/catalogue`;

  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-[#ebe8e3] pb-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[#6b6560]">
        <span className="font-semibold text-[#141414]">{totalItems}</span> products
      </p>

      <div className="flex items-center gap-2">
        <span className="text-sm text-[#6b6560]">Sort:</span>
        <UiSelect
          value={currentSort}
          onValueChange={(value) => {
            const params = new URLSearchParams(
              Object.entries(queryParams).filter(([, v]) => v != null) as [string, string][]
            );
            params.set("sort", value);
            params.delete("page");
            window.location.href = `${base}?${params.toString()}`;
          }}
          ariaLabel="Sort products"
          options={Object.entries(SORT_LABELS).map(([value, label]) => ({ value, label }))}
          className="min-w-44 rounded-lg border-[#ebe8e3] bg-white"
        />
      </div>
    </div>
  );
}
