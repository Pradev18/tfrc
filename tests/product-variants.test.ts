import { describe, expect, it } from "vitest";
import {
  classifyProductVariants,
  collapseSingletonVariantGroups,
  compareVariantLabels,
  deriveProductVariantIdentity,
} from "../src/lib/product-variants";

describe("deriveProductVariantIdentity", () => {
  it("groups clothing sizes in parentheses", () => {
    const identity = deriveProductVariantIdentity({
      title: "Black Pet Hat (L) 110011577",
      productId: "110011577",
    });
    expect(identity.baseName).toBe("Black Pet Hat");
    expect(identity.label).toBe("L");
    expect(identity.groupKey).toBe("black-pet-hat");
  });

  it("groups concrete drill bit measurement variants", () => {
    const bits = [
      "Concrete Drill Bit 16150Mm",
      "Concrete Drill Bit 14150Mm",
      "Concrete Drill Bit 12150Mm",
      "Concrete Drill Bit 10120Mm",
      "Concrete Drill Bit 9120Mm",
      "Concrete Drill Bit 8120Mm",
      "Concrete Drill Bit 6100Mm",
      "Concrete Drill Bit 585Mm",
      "Concrete Drill Bit 475Mm",
      "Concrete Drill Bit 360Mm",
    ].map((title, index) =>
      deriveProductVariantIdentity({
        title,
        productId: `11000914${index}`,
      })
    );

    expect(new Set(bits.map((bit) => bit.groupKey))).toEqual(new Set(["concrete-drill-bit"]));
    expect(bits.map((bit) => bit.baseName)).toEqual(
      Array(bits.length).fill("Concrete Drill Bit")
    );
    expect(bits.map((bit) => bit.label)).toEqual([
      "16150MM",
      "14150MM",
      "12150MM",
      "10120MM",
      "9120MM",
      "8120MM",
      "6100MM",
      "585MM",
      "475MM",
      "360MM",
    ]);
  });

  it("keeps unique products ungrouped", () => {
    const identity = deriveProductVariantIdentity({
      title: "Foldable Pet Carrier",
      productId: "110000001",
    });
    expect(identity.groupKey).toBeNull();
    expect(identity.label).toBeNull();
    expect(identity.baseName).toBe("Foldable Pet Carrier");
  });

  it("collapses singleton measurement groups", () => {
    const collapsed = collapseSingletonVariantGroups([
      deriveProductVariantIdentity({ title: "Unique Bit 16150Mm", productId: "1" }),
      deriveProductVariantIdentity({ title: "Concrete Drill Bit 16150Mm", productId: "2" }),
      deriveProductVariantIdentity({ title: "Concrete Drill Bit 14150Mm", productId: "3" }),
    ]);
    expect(collapsed[0].groupKey).toBeNull();
    expect(collapsed[1].groupKey).toBe("concrete-drill-bit");
    expect(collapsed[2].groupKey).toBe("concrete-drill-bit");
  });

  it("sorts measurement labels numerically", () => {
    const labels = ["16150MM", "360MM", "9120MM", "585MM"];
    expect([...labels].sort(compareVariantLabels)).toEqual([
      "360MM",
      "585MM",
      "9120MM",
      "16150MM",
    ]);
  });

  it("groups kitchen products that share a cleaned base name", () => {
    const classified = classifyProductVariants([
      { name: "6Pcs Cups And Plates 88006709", productId: "88006709" },
      { name: "6Pcs Cups And Plates 88006711", productId: "88006711" },
      { name: "6 Pcs Tea Cup W Saucer 880008298", productId: "880008298" },
      { name: "6Pcs Tea Cup W Saucer 880008359", productId: "880008359" },
      { name: "Unique Bowl 880099999", productId: "880099999" },
    ]);

    expect(classified[0].groupKey).toBe("name-6pcs-cups-and-plates");
    expect(classified[1].groupKey).toBe("name-6pcs-cups-and-plates");
    expect(classified[2].groupKey).toBe("name-6pcs-tea-cup-w-saucer");
    expect(classified[3].groupKey).toBe("name-6pcs-tea-cup-w-saucer");
    expect(classified[4].groupKey).toBeNull();
  });
});
