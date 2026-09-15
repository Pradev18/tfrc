import { describe, expect, it } from "vitest";
import { resolveCatalogueShopCategoryPack } from "../src/lib/shop-categories";

describe("resolveCatalogueShopCategoryPack", () => {
  it("uses pawmart pack for pet-named catalogues even with custom slugs", () => {
    const pack = resolveCatalogueShopCategoryPack({
      slug: "pet-accessories",
      name: "Pet accessories",
      productNames: ["Dog Leash", "Pet Bed Tent", "Cat Litter"],
    });
    expect(pack.some((c) => c.slug === "leashes-collars")).toBe(true);
    expect(pack.some((c) => c.slug === "toys")).toBe(true);
    expect(pack.length).toBeGreaterThanOrEqual(5);
  });

  it("uses hardware pack for tool catalogues", () => {
    const pack = resolveCatalogueShopCategoryPack({
      slug: "pro-tools-qatar",
      name: "Pro Tools Qatar",
      productNames: ["Impact Drill 750W", "Socket Set"],
    });
    expect(pack.some((c) => c.slug === "drills-drivers" || c.keywords.includes("drill"))).toBe(
      true
    );
  });

  it("keeps exact slug packs when present", () => {
    const pack = resolveCatalogueShopCategoryPack({ slug: "pawmart", name: "Anything" });
    expect(pack.some((c) => c.slug === "leashes-collars")).toBe(true);
  });
});
