"use client";

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
        <label htmlFor="sort-toolbar" className="text-sm text-[#6b6560]">
          Sort:
        </label>
        <select
          id="sort-toolbar"
          value={currentSort}
          onChange={(e) => {
            const params = new URLSearchParams(
              Object.entries(queryParams).filter(([, v]) => v != null) as [string, string][]
            );
            params.set("sort", e.target.value);
            params.delete("page");
            window.location.href = `${base}?${params.toString()}`;
          }}
          className="rounded-lg border border-[#ebe8e3] bg-white px-3 py-2 text-sm text-[#141414] focus:border-[#141414] focus:outline-none"
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
