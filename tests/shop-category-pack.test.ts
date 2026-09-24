import { describe, expect, it } from "vitest";
import {
  discoverShopCategoriesFromTaxonomy,
  estimateOtherRatio,
  resolveCatalogueShopCategoryPack,
  resolvePrimaryShopCategory,
} from "../src/lib/shop-categories";

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

  it("uses Excel taxonomy leaves for new catalogues with Google paths", () => {
    const products = Array.from({ length: 8 }, (_, i) => ({
      name: `Unique Item ${i}`,
      googleCategory: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Apparel",
    }));
    const pack = resolveCatalogueShopCategoryPack({
      slug: "brand-new-catalogue-xyz",
      name: "Brand New Catalogue",
      products,
    });
    // Upcoming catalogues follow Excel/Google leaf categories — never remap to PawMart packs.
    expect(pack.some((c) => c.slug === "dog-apparel")).toBe(true);
    expect(resolvePrimaryShopCategory(products[0]!, pack)?.slug).toBe("dog-apparel");
  });

  it("falls back to Excel taxonomy leaves when no pack fits", () => {
    const products = Array.from({ length: 6 }, (_, i) => ({
      name: `Sensor Module ${i}`,
      googleCategory: "Electronics > Components > Passive Components > Capacitors",
    }));
    const pack = resolveCatalogueShopCategoryPack({
      slug: "brand-new-electronics-xyz",
      name: "Electronics Lab",
      products,
    });
    expect(pack.some((c) => c.slug.includes("capacitor"))).toBe(true);
  });
});

describe("taxonomy discovery", () => {
  it("creates leaf categories from google paths", () => {
    const defs = discoverShopCategoriesFromTaxonomy([
      { name: "A", googleCategory: "Hardware > Tools > Tool Sets" },
      { name: "B", googleCategory: "Hardware > Tools > Tool Sets" },
      { name: "C", googleCategory: "Hardware > Tools > Power Tools" },
      { name: "D", googleCategory: "Hardware > Tools > Power Tools" },
    ]);
    expect(defs.some((d) => d.slug.includes("tool-sets"))).toBe(true);
    expect(defs.some((d) => d.slug.includes("power-tools"))).toBe(true);
  });
});

describe("resolvePrimaryShopCategory", () => {
  it("maps dog belt/lace into leashes", () => {
    const pack = resolveCatalogueShopCategoryPack({ slug: "pawmart" });
    expect(resolvePrimaryShopCategory({ name: "Leather Dog Belt 64Cm" }, pack)?.slug).toBe(
      "leashes-collars"
    );
    expect(resolvePrimaryShopCategory({ name: "Dog Lace 150Cm" }, pack)?.slug).toBe(
      "leashes-collars"
    );
  });

  it("estimateOtherRatio stays low for hardware pack on tool titles", () => {
    const pack = resolveCatalogueShopCategoryPack({ slug: "hardware" });
    const ratio = estimateOtherRatio(
      [
        { name: "Impact Drill 750W", googleCategory: "Hardware > Tools" },
        { name: "Socket Set 40Pcs", googleCategory: "Hardware > Tools" },
        { name: "116Pcs Household Tool Set", googleCategory: "Hardware > Tools > Tool Sets" },
      ],
      pack
    );
    expect(ratio).toBeLessThan(0.45);
  });
});
