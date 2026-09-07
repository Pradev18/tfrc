import { describe, it, expect } from "vitest";
import { getEffectivePrice, validatePrices } from "@/lib/pricing";
import {
  buildWhatsAppUrl,
  buildWhatsAppMessage,
  buildCartWhatsAppMessage,
  buildCartWhatsAppCheckoutUrl,
  DEFAULT_WHATSAPP_SETTINGS,
} from "@/lib/whatsapp";
import {
  buildWhatsAppCatalogProductUrl,
  buildWhatsAppCatalogStoreUrl,
} from "@/lib/whatsapp-catalog";
import { deriveProductVariantIdentity } from "@/lib/product-variants";
import { cartEstimatedTotal } from "@/lib/inquiry-helpers";
import type { CartItem } from "@/context/CartContext";
describe("pricing", () => {
  it("calculates discount correctly", () => {
    const price = getEffectivePrice({ regular: 10, sale: 6, currency: "QAR" });
    expect(price.isOnSale).toBe(true);
    expect(price.discountPercent).toBe(40);
    expect(price.displayPrice).toBe(6);
  });

  it("rejects sale >= regular", () => {
    expect(() => validatePrices(10, 10)).toThrow();
    expect(() => validatePrices(10, 12)).toThrow();
  });

  it("ignores invalid sale price in effective price", () => {
    const price = getEffectivePrice({ regular: 10, sale: 12 });
    expect(price.isOnSale).toBe(false);
    expect(price.displayPrice).toBe(10);
  });
});

describe("whatsapp", () => {
  it("generates correct wa.me URL", () => {
    const url = buildWhatsAppUrl("97455049229", "Hello");
    expect(url).toBe("https://wa.me/97455049229?text=Hello");
  });

  it("builds product message with price", () => {
    const msg = buildWhatsAppMessage(
      {
        phoneNumber: "97455049229",
        defaultGreeting: "Hi PawMart Qatar",
        productTemplate: DEFAULT_WHATSAPP_SETTINGS.productTemplate,
      },
      {
        name: "Pet Comb",
        productId: "110005860",
        regularPrice: 10,
        salePrice: 6,
        slug: "pet-comb-110005860",
        environmentSlug: "pawmart",
      },
      "https://example.com"
    );
    expect(msg).toContain("Hi PawMart Qatar");
    expect(msg).toContain("Pet Comb");
    expect(msg).toContain("Ref: 110005860");
    expect(msg).toContain("QAR 6.00");
    expect(msg).not.toContain("https://example.com");
    expect(msg).not.toContain("wa.me/p/");
  });

  it("applies the saved greeting and product format", () => {
    const msg = buildWhatsAppMessage(
      {
        phoneNumber: "97455049229",
        defaultGreeting: "Custom greeting",
        productTemplate: "{{name}} | {{price}} | SKU {{productId}}",
      },
      {
        name: "Pet Comb",
        productId: "110005860",
        regularPrice: 10,
        slug: "pet-comb",
      }
    );
    expect(msg).toContain("Custom greeting");
    expect(msg).toContain("Pet Comb | QAR 10.00 | SKU 110005860");
  });

  it("always includes selected size and quantity in an order", () => {
    const msg = buildWhatsAppMessage(
      {
        phoneNumber: "97455049229",
        defaultGreeting: "Hi",
        productTemplate: "{{name}} | {{price}} | SKU {{productId}}",
      },
      {
        name: "Black Pet Hat (L)",
        productId: "110011577",
        regularPrice: 15,
        slug: "black-pet-hat-l-110011577",
        size: "L",
        quantity: 3,
      }
    );
    expect(msg).toContain("Size: L");
    expect(msg).toContain("QAR 15.00 × 3 = QAR 45.00");
  });

  it("builds cart message with all products", () => {
    const msg = buildCartWhatsAppMessage(
      {
        phoneNumber: "97455049229",
        defaultGreeting: "Hi TFRC",
        productTemplate:
          "{{index}}. {{name}}{{catalogue}}\nRef: {{productId}}\nLink: {{link}}",
      },
      [
        {
          name: "Pet Comb",
          productId: "110005860",
          regularPrice: 10,
          slug: "pet-comb",
          displayPrice: 6,
          currency: "QAR",
          environmentSlug: "pawmart",
        },
        {
          name: "Dog Leash",
          productId: "110005861",
          regularPrice: 25,
          slug: "dog-leash",
          displayPrice: 25,
          currency: "QAR",
          environmentSlug: "pawmart",
        },
      ],
      "https://example.com"
    );
    expect(msg).toContain("1. Pet Comb");
    expect(msg).toContain("2. Dog Leash");
    expect(msg).toContain("Total: QAR 31.00");
    expect(msg).toContain("Ref: 110005860");
    expect(msg).toContain("Link: https://example.com/pawmart/product/pet-comb");
    expect(msg).toContain("Link: https://example.com/pawmart/product/dog-leash");
    expect(msg).not.toContain("WhatsApp Catalog");
  });

  it("builds correct links for hardware and household catalogues", () => {
    const msg = buildCartWhatsAppMessage(
      {
        phoneNumber: "97455049229",
        defaultGreeting: "Hi TFRC",
        productTemplate:
          "{{index}}. {{name}}{{catalogue}}\nRef: {{productId}}\nLink: {{link}}",
      },
      [
        {
          name: "Drill Set",
          productId: "220001",
          regularPrice: 120,
          slug: "drill-set",
          displayPrice: 120,
          currency: "QAR",
          environmentSlug: "hardware",
          environmentName: "Pro Tools",
        },
        {
          name: "Kitchen Mixer",
          productId: "330001",
          regularPrice: 85,
          slug: "kitchen-mixer",
          displayPrice: 85,
          currency: "QAR",
          environmentSlug: "household",
          environmentName: "Kitchen & Home",
        },
      ],
      "https://shop.example.com"
    );
    expect(msg).toContain("Pro Tools");
    expect(msg).toContain("Kitchen & Home");
    expect(msg).toContain("Link: https://shop.example.com/hardware/product/drill-set");
    expect(msg).toContain("Link: https://shop.example.com/household/product/kitchen-mixer");
  });

  it("builds catalog product and store URLs", () => {
    expect(buildWhatsAppCatalogProductUrl("97455049229", "110005860")).toBe(
      "https://wa.me/p/110005860/97455049229"
    );
    expect(buildWhatsAppCatalogStoreUrl("97455049229")).toBe(
      "https://wa.me/c/97455049229"
    );
  });

  it("single-item cart sends a concise order message", () => {
    const url = buildCartWhatsAppCheckoutUrl(
      {
        phoneNumber: "97455049229",
        defaultGreeting: "Hi",
        productTemplate: DEFAULT_WHATSAPP_SETTINGS.productTemplate,
      },
      [
        {
          name: "Pet Comb",
          productId: "110005860",
          regularPrice: 6,
          slug: "pet-comb",
          displayPrice: 6,
          environmentSlug: "pawmart",
        },
      ],
      "https://example.com"
    );
    expect(url).toContain("https://wa.me/97455049229?text=");
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("Pet Comb");
    expect(decoded).not.toContain("https://example.com");
  });

  it("multi-item cart sends a concise order message", () => {
    const url = buildCartWhatsAppCheckoutUrl(
      {
        phoneNumber: "97455049229",
        defaultGreeting: "Hi",
        productTemplate: DEFAULT_WHATSAPP_SETTINGS.productTemplate,
      },
      [
        {
          name: "Pet Comb",
          productId: "110005860",
          regularPrice: 6,
          slug: "pet-comb",
          displayPrice: 6,
          environmentSlug: "pawmart",
        },
        {
          name: "Dog Leash",
          productId: "110005861",
          regularPrice: 25,
          slug: "dog-leash",
          displayPrice: 25,
          environmentSlug: "pawmart",
        },
      ],
      "https://example.com"
    );
    expect(url).toContain("https://wa.me/97455049229?text=");
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("Pet Comb");
    expect(decoded).toContain("Dog Leash");
    expect(decoded).toContain("Total:");
    expect(decoded).not.toContain("https://example.com");
    expect(decoded).not.toContain("wa.me/p/");
  });
});

describe("product variants", () => {
  it("groups size-specific rows while preserving the selected label", () => {
    expect(
      deriveProductVariantIdentity({
        title: "Black Pet Hat (M) 110011574",
        productId: "110011574",
      })
    ).toEqual({
      groupKey: "black-pet-hat",
      label: "M",
      baseName: "Black Pet Hat",
    });
  });

  it("does not turn a normal product into a variant", () => {
    expect(
      deriveProductVariantIdentity({
        title: "Foldable Pet Carrier 110011585",
        productId: "110011585",
      }).groupKey
    ).toBeNull();
  });
});

describe("cart totals", () => {
  it("calculates separate size quantities using unit price", () => {
    const base = {
      currency: "QAR",
      environmentSlug: "pawmart",
      environmentName: "PawMart",
      imageUrl: undefined,
    };
    const items: CartItem[] = [
      {
        ...base,
        id: "orange-hat-m",
        productId: "110011576",
        slug: "orange-pet-hat-m",
        name: "Orange Pet Hat (M)",
        size: "M",
        price: 12.8,
        quantity: 2,
      },
      {
        ...base,
        id: "orange-hat-s",
        productId: "110011573",
        slug: "orange-pet-hat-s",
        name: "Orange Pet Hat (S)",
        size: "S",
        price: 12.8,
        quantity: 3,
      },
    ];

    expect(cartEstimatedTotal(items)).toBe(64);
    expect(items.reduce((sum, item) => sum + item.quantity, 0)).toBe(5);
  });
});