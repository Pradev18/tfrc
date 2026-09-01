export interface ShopCategoryDef {
  slug: string;
  name: string;
  keywords: string[];
  sortOrder: number;
}

/** Shopper-friendly categories — mapped from product titles, not Excel/Google taxonomy */
export const SHOP_CATEGORIES: Record<string, ShopCategoryDef[]> = {
  pawmart: [
    {
      slug: "leashes-collars",
      name: "Leashes & Collars",
      keywords: ["leash", "collar", "harness", "belt", "lace", "lash", "bandana", "muzzle"],
      sortOrder: 1,
    },
    {
      slug: "toys",
      name: "Toys",
      keywords: ["toy", "ball", "rope", "chew", "teether", "tug", "spiral", "boll", "bone", "feather"],
      sortOrder: 2,
    },
    {
      slug: "grooming",
      name: "Grooming",
      keywords: ["comb", "nail", "clipper", "scissor", "trim", "trimer", "mouth protection", "groom"],
      sortOrder: 3,
    },
    {
      slug: "bowls-feeding",
      name: "Bowls & Feeding",
      keywords: ["bowl", "feeder", "bottle", "nursing", "medicine feed"],
      sortOrder: 4,
    },
    {
      slug: "food-treats",
      name: "Food & Treats",
      keywords: ["food", "treat", "snack", "kibble", "meal"],
      sortOrder: 5,
    },
    {
      slug: "carriers-travel",
      name: "Carriers & Travel",
      keywords: ["carry", "carrier", "bag", "case", "crate"],
      sortOrder: 6,
    },
    {
      slug: "cat-supplies",
      name: "Cat Supplies",
      keywords: ["cat", "scratching", "kitten"],
      sortOrder: 7,
    },
    {
      slug: "clothing-accessories",
      name: "Clothing & Accessories",
      keywords: ["cloth", "shirt", "jacket", "costume", "dress", "raincoat", "apparel", "wear"],
      sortOrder: 8,
    },
  ],
  hardware: [
    {
      slug: "wrenches-spanners",
      name: "Wrenches & Spanners",
      keywords: ["wrench", "spanner", "ratchet", "nut wrench", "flare nut"],
      sortOrder: 1,
    },
    {
      slug: "tool-sets",
      name: "Tool Sets & Kits",
      keywords: ["tool set", "pcs tool", "piece tool", "tool kit", "household tool"],
      sortOrder: 2,
    },
    {
      slug: "power-tools",
      name: "Power Tools",
      keywords: ["cordless", "liion", "battery", "drill", "hammer", "blower", "shear", "charger", "rotary"],
      sortOrder: 3,
    },
    {
      slug: "pliers-cutters",
      name: "Pliers & Cutters",
      keywords: ["plier", "cutter", "snip", "nipper", "crimp"],
      sortOrder: 4,
    },
    {
      slug: "screwdrivers",
      name: "Screwdrivers",
      keywords: ["screwdriver", "screw driver", "bits set"],
      sortOrder: 5,
    },
    {
      slug: "measuring-tools",
      name: "Measuring Tools",
      keywords: ["tape measure", "level", "ruler", "caliper", "measure", "square"],
      sortOrder: 6,
    },
    {
      slug: "hand-tools",
      name: "Hand Tools",
      keywords: ["hammer", "chisel", "file", "saw", "knife", "trowel", "clamp", "vice"],
      sortOrder: 7,
    },
  ],
  household: [
    {
      slug: "tea-sets",
      name: "Tea Sets",
      keywords: ["tea set", "teaware", "tea cup", "tea glass", "cawa", "teapot", "tea pot"],
      sortOrder: 1,
    },
    {
      slug: "cups-saucers",
      name: "Cups & Saucers",
      keywords: ["cup", "saucer", "mug", "coffee cup"],
      sortOrder: 2,
    },
    {
      slug: "plates-dinnerware",
      name: "Plates & Dinnerware",
      keywords: ["plate", "dinner", "dish", "bowl"],
      sortOrder: 3,
    },
    {
      slug: "serveware-sets",
      name: "Serveware & Sets",
      keywords: ["ceramic set", "glass set", "tray", "serve", "pcs set", "person set"],
      sortOrder: 4,
    },
    {
      slug: "kitchen-home",
      name: "Kitchen & Home",
      keywords: ["kitchen", "home", "storage", "organizer", "decor", "vase", "container"],
      sortOrder: 5,
    },
  ],
};

export function getShopCategoryDefs(environmentSlug: string): ShopCategoryDef[] {
  return SHOP_CATEGORIES[environmentSlug] ?? [];
}

export function getShopCategoryDef(
  environmentSlug: string,
  shopSlug: string
): ShopCategoryDef | undefined {
  return getShopCategoryDefs(environmentSlug).find((c) => c.slug === shopSlug);
}

/** Case-insensitive keyword match against product name */
export function productMatchesShopCategory(name: string, def: ShopCategoryDef): boolean {
  const lower = name.toLowerCase();
  return def.keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

export function buildShopCategoryNameFilter(
  defs: ShopCategoryDef[]
): Array<{ name: { contains: string } }> {
  const seen = new Set<string>();
  const or: Array<{ name: { contains: string } }> = [];

  for (const def of defs) {
    for (const kw of def.keywords) {
      const key = kw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      or.push({ name: { contains: kw } });
    }
  }

  return or;
}
