import { describe, expect, it } from "vitest";
import {
  classifyProductVariants,
  collapseSingletonVariantGroups,
  compareVariantLabels,
  deriveProductVariantIdentity,
  formatAvailableSizes,
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

  it("groups leading letter-dash sizes like L-Pet Harness", () => {
    const items = ["L-Pet Harness", "M-Pet Harness", "S-Pet Harness"].map((title, index) =>
      deriveProductVariantIdentity({ title, productId: `11001031${index}` })
    );
    expect(new Set(items.map((item) => item.groupKey))).toEqual(new Set(["pet-harness"]));
    expect(items.map((item) => item.label)).toEqual(["L", "M", "S"]);
    expect(items.map((item) => item.baseName)).toEqual([
      "Pet Harness",
      "Pet Harness",
      "Pet Harness",
    ]);
  });

  it("groups L-/M-/S- Pet Collar Mix Color with optional spaces", () => {
    const items = [
      "L-Pet Collar Mix Color",
      "L- Pet Collar Mix Color",
      "M-Pet Collar Mix Color",
      "S-Pet Collar Mix Color",
    ].map((title, index) =>
      deriveProductVariantIdentity({ title, productId: `11001029${index}` })
    );
    expect(new Set(items.map((item) => item.groupKey))).toEqual(
      new Set(["pet-collar-mix-color"])
    );
    expect(items.map((item) => item.label)).toEqual(["L", "L", "M", "S"]);
  });

  it("groups Medium/Small/Large word sizes", () => {
    const items = ["Medium Dog Leash", "Small Dog Leash", "Large Dog Leash"].map(
      (title, index) => deriveProductVariantIdentity({ title, productId: `11001031${index}` })
    );
    expect(new Set(items.map((item) => item.groupKey))).toEqual(new Set(["dog-leash"]));
    expect(items.map((item) => item.label)).toEqual(["M", "S", "L"]);
    expect(items[0].baseName).toBe("Dog Leash");
  });

  it("groups collar bandana leading sizes", () => {
    const items = ["M-Pet Collar W/Bandana", "S-Pet Collar W/Bandana"].map((title, index) =>
      deriveProductVariantIdentity({ title, productId: `11001029${index}` })
    );
    expect(items[0].groupKey).toBe("pet-collar-w-bandana");
    expect(items[1].groupKey).toBe("pet-collar-w-bandana");
    expect(items.map((item) => item.label)).toEqual(["M", "S"]);
  });

  it("groups concrete drill bit measurement variants", () => {
    const bits = [
      "Concrete Drill Bit 16150Mm",
      "Concrete Drill Bit 14150Mm",
      "Concrete Drill Bit 12150Mm",
    ].map((title, index) =>
      deriveProductVariantIdentity({
        title,
        productId: `11000914${index}`,
      })
    );

    expect(new Set(bits.map((bit) => bit.groupKey))).toEqual(new Set(["concrete-drill-bit"]));
    expect(bits.map((bit) => bit.label)).toEqual(["16150MM", "14150MM", "12150MM"]);
  });

  it("keeps unique products ungrouped", () => {
    const identity = deriveProductVariantIdentity({
      title: "Foldable Pet Carrier",
      productId: "110000001",
    });
    expect(identity.groupKey).toBeNull();
    expect(identity.label).toBeNull();
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

  it("classifies mixed pet size families together", () => {
    const classified = classifyProductVariants([
      { name: "L-Pet Harness 1", productId: "1" },
      { name: "M-Pet Harness 2", productId: "2" },
      { name: "S-Pet Harness 3", productId: "3" },
      { name: "Medium Dog Leash 4", productId: "4" },
      { name: "Small Dog Leash 5", productId: "5" },
      { name: "Unique Bowl 6", productId: "6" },
    ]);
    expect(classified[0].groupKey).toBe("pet-harness");
    expect(classified[1].groupKey).toBe("pet-harness");
    expect(classified[2].groupKey).toBe("pet-harness");
    expect(classified[3].groupKey).toBe("dog-leash");
    expect(classified[4].groupKey).toBe("dog-leash");
    expect(classified[5].groupKey).toBeNull();
    expect(formatAvailableSizes(["L", "S", "M"])).toBe("S · M · L");
  });
});
