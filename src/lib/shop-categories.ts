export interface ShopCategoryDef {
  slug: string;
  name: string;
  keywords: string[];
  /** If any of these match, this category is disqualified for the product */
  excludeKeywords?: string[];
  sortOrder: number;
  /** When true, matches products that fit no other category */
  isFallback?: boolean;
}

export interface ShopCategoryProductInput {
  name: string;
  googleCategory?: string | null;
  fbCategory?: string | null;
}

/** Catch-all for products that don't match defined keywords */
export const OTHER_SHOP_CATEGORY: ShopCategoryDef = {
  slug: "other",
  name: "More to explore",
  keywords: [],
  sortOrder: 999,
  isFallback: true,
};

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "for", "with", "of", "in", "on", "to", "from",
  "set", "pcs", "pc", "piece", "pieces", "new", "premium", "quality", "size",
  "color", "black", "white", "red", "blue", "green", "large", "small", "medium",
  "qatar", "pack", "box", "kit", "item", "product", "brand", "pet", "dog", "dogs",
]);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-phrase match with word boundaries (avoids "cat" matching "education"). */
export function textIncludesKeyword(haystack: string, keyword: string): boolean {
  const key = keyword.trim().toLowerCase();
  if (!key) return false;
  const source = haystack.toLowerCase();
  if (key.includes(" ")) {
    return source.includes(key);
  }
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(key)}(?:[^a-z0-9]|$)`, "i");
  return pattern.test(source);
}

function buildMatchText(input: ShopCategoryProductInput | string): string {
  if (typeof input === "string") return input;
  return [input.name, input.googleCategory, input.fbCategory]
    .filter(Boolean)
    .join(" ");
}

function normalizeProductInput(
  input: ShopCategoryProductInput | string
): ShopCategoryProductInput {
  if (typeof input === "string") return { name: input };
  return input;
}

/** Shopper-friendly categories — exclusive keyword assignment from titles + Excel taxonomy */
export const SHOP_CATEGORIES: Record<string, ShopCategoryDef[]> = {
  pawmart: [
    {
      slug: "leashes-collars",
      name: "Leashes & Collars",
      keywords: [
        "leash",
        "leashes",
        "collar",
        "collars",
        "harness",
        "harnesses",
        "bandana",
        "muzzle",
        "choke chain",
        "dog belt",
        "belt",
        "lace",
        "lead",
        "dog lead",
      ],
      excludeKeywords: [
        "bag",
        "carrier",
        "crate",
        "bowl",
        "feeder",
        "toy",
        "food",
        "treat",
        "jacket",
        "shirt",
        "costume",
      ],
      sortOrder: 1,
    },
    {
      slug: "toys",
      name: "Toys",
      keywords: [
        "toy",
        "toys",
        "ball",
        "rope toy",
        "chew toy",
        "chew",
        "teether",
        "tug",
        "squeaky",
        "frisbee",
        "fetch",
      ],
      excludeKeywords: ["food", "treat", "bowl", "collar", "leash", "carrier", "bag"],
      sortOrder: 2,
    },
    {
      slug: "grooming",
      name: "Grooming",
      keywords: [
        "comb",
        "brush",
        "nail clipper",
        "clipper",
        "scissor",
        "trimmer",
        "trimer",
        "groom",
        "grooming",
        "shampoo",
        "deshed",
      ],
      excludeKeywords: ["toy", "food", "collar", "leash", "carrier"],
      sortOrder: 3,
    },
    {
      slug: "bowls-feeding",
      name: "Bowls & Feeding",
      keywords: [
        "bowl",
        "feeder",
        "feeding",
        "waterer",
        "nursing bottle",
        "medicine feed",
        "slow feed",
      ],
      excludeKeywords: ["toy", "collar", "leash", "carrier", "bag", "food pouch"],
      sortOrder: 4,
    },
    {
      slug: "food-treats",
      name: "Food & Treats",
      keywords: ["dog food", "cat food", "pet food", "treat", "treats", "snack", "kibble", "wet food"],
      excludeKeywords: ["toy", "bowl", "feeder", "collar", "leash"],
      sortOrder: 5,
    },
    {
      slug: "carriers-travel",
      name: "Carriers & Travel",
      keywords: [
        "carrier",
        "pet carrier",
        "travel bag",
        "pet bag",
        "bag",
        "crate",
        "kennel",
        "stroller",
        "backpack carrier",
      ],
      excludeKeywords: ["collar", "leash", "harness", "toy", "bowl", "food", "treat", "brush"],
      sortOrder: 6,
    },
    {
      slug: "cat-supplies",
      name: "Cat Supplies",
      keywords: [
        "cat litter",
        "litter box",
        "scratching",
        "scratcher",
        "cat tree",
        "kitten",
        "cat toy",
        "cat food",
      ],
      excludeKeywords: ["dog leash", "dog collar", "dog food"],
      sortOrder: 7,
    },
    {
      slug: "clothing-accessories",
      name: "Clothing & Accessories",
      keywords: [
        "shirt",
        "jacket",
        "costume",
        "dress",
        "raincoat",
        "apparel",
        "hoodie",
        "sweater",
        "pet hat",
        "shoes",
        "booties",
      ],
      excludeKeywords: ["collar", "leash", "harness", "carrier", "bag", "toy", "bowl"],
      sortOrder: 8,
    },
  ],
  hardware: [
    {
      slug: "wrenches-spanners",
      name: "Wrenches & Spanners",
      keywords: ["wrench", "spanner", "ratchet", "nut wrench", "flare nut"],
      excludeKeywords: ["plier", "screwdriver", "drill", "socket set"],
      sortOrder: 1,
    },
    {
      slug: "tool-sets",
      name: "Tool Sets & Kits",
      keywords: ["tool set", "tool kit", "pcs tool", "piece tool", "household tool", "tool sets"],
      sortOrder: 2,
    },
    {
      slug: "power-tools",
      name: "Power Tools",
      keywords: [
        "cordless",
        "drill",
        "impact driver",
        "angle grinder",
        "blower",
        "rotary",
        "charger",
      ],
      excludeKeywords: ["hand saw", "hand file", "household tool"],
      sortOrder: 3,
    },
    {
      slug: "pliers-cutters",
      name: "Pliers & Cutters",
      keywords: ["plier", "pliers", "cutter", "snip", "nipper", "crimp"],
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
      keywords: ["tape measure", "spirit level", "caliper", "ruler", "try square"],
      sortOrder: 6,
    },
    {
      slug: "hand-tools",
      name: "Hand Tools",
      keywords: ["hammer", "chisel", "hand saw", "mallet", "trowel", "clamp", "vice", "punch"],
      sortOrder: 7,
    },
    {
      slug: "sockets-bits",
      name: "Sockets & Bits",
      keywords: ["socket", "hex key", "allen key", "driver bit", "impact socket"],
      sortOrder: 8,
    },
    {
      slug: "sanding-abrasives",
      name: "Sanding & Abrasives",
      keywords: ["sandpaper", "abrasive", "grinding disc", "cutting disc", "flap disc"],
      sortOrder: 9,
    },
    {
      slug: "safety-workwear",
      name: "Safety & Workwear",
      keywords: ["glove", "goggle", "helmet", "safety mask", "workwear", "apron"],
      sortOrder: 10,
    },
  ],
  household: [
    {
      slug: "tea-sets",
      name: "Tea Sets",
      keywords: ["tea set", "teaware", "tea cup", "tea glass", "cawa", "teapot", "tea pot", "coffee & tea", "coffee and tea"],
      sortOrder: 1,
    },
    {
      slug: "cups-saucers",
      name: "Cups & Saucers",
      keywords: ["cup", "saucer", "mug", "coffee cup", "cups and plates", "cups & plates"],
      excludeKeywords: ["tea set", "teapot"],
      sortOrder: 2,
    },
    {
      slug: "plates-dinnerware",
      name: "Plates & Dinnerware",
      keywords: ["plate", "dinner set", "dinnerware", "dish set", "cups and plates", "cups & plates"],
      sortOrder: 3,
    },
    {
      slug: "serveware-sets",
      name: "Serveware & Sets",
      keywords: ["ceramic set", "serving tray", "serveware", "person set"],
      sortOrder: 4,
    },
    {
      slug: "kitchen-home",
      name: "Kitchen & Home",
      keywords: ["storage", "organizer", "cookware", "utensil", "container", "vase"],
      sortOrder: 5,
    },
    {
      slug: "glassware",
      name: "Glassware",
      keywords: ["tumbler", "decanter", "carafe", "wine glass", "drinkware"],
      sortOrder: 6,
    },
    {
      slug: "cutlery",
      name: "Cutlery",
      keywords: ["cutlery", "fork", "spoon", "flatware", "cutlery set", "knife set"],
      sortOrder: 7,
    },
  ],
};

export function getShopCategoryDefs(environmentSlug: string): ShopCategoryDef[] {
  return SHOP_CATEGORIES[environmentSlug] ?? [];
}

/**
 * Pick the best keyword pack for ANY catalogue (including newly created ones).
 * Never requires the catalogue slug to be pawmart/hardware/household.
 *
 * When Excel already has google_product_category filled for most products,
 * prefer those names on the shop — do not force a household/pet/tools pack
 * that makes the owner look like they miscategorised the file.
 */
export function resolveCatalogueShopCategoryPack(input: {
  slug?: string | null;
  name?: string | null;
  tagline?: string | null;
  departmentSource?: string | null;
  productNames?: string[];
  products?: ShopCategoryProductInput[];
}): ShopCategoryDef[] {
  const slug = (input.slug ?? "").toLowerCase().trim();
  const productInputs: ShopCategoryProductInput[] =
    input.products ??
    (input.productNames ?? []).map((name) => ({ name }));

  const curatedSlugs = new Set(["pawmart", "hardware", "household"]);
  const known = slug && SHOP_CATEGORIES[slug]?.length ? SHOP_CATEGORIES[slug]! : null;

  const withExcelCategory = productInputs.filter((product) =>
    Boolean((product.googleCategory || product.fbCategory || "").trim())
  ).length;
  const excelCoverage =
    productInputs.length > 0 ? withExcelCategory / productInputs.length : 0;
  const taxonomy = discoverShopCategoriesFromTaxonomy(productInputs, 24);

  // Excel taxonomy wins for custom catalogues (and for curated ones that fit poorly).
  if (taxonomy.length >= 2 && excelCoverage >= 0.5) {
    if (!known || !curatedSlugs.has(slug)) {
      return taxonomy;
    }
    const otherRatio = estimateOtherRatio(productInputs, known);
    if (otherRatio >= 0.45) return taxonomy;
  }

  if (known) {
    if (productInputs.length === 0) return known;
    const otherRatio = estimateOtherRatio(productInputs, known);
    if (otherRatio < 0.45) return known;
    if (taxonomy.length === 0) return known;
    // Keep known pack, append taxonomy buckets so Excel categories still surface.
    const seen = new Set(known.map((d) => d.slug));
    const merged = [...known];
    for (const def of taxonomy) {
      if (seen.has(def.slug)) continue;
      seen.add(def.slug);
      merged.push({ ...def, sortOrder: known.length + merged.length });
    }
    return merged;
  }

  const haystack = [
    slug,
    input.name,
    input.tagline,
    input.departmentSource,
    ...productInputs.slice(0, 80).flatMap((p) => [p.name, p.googleCategory, p.fbCategory]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const scorePack = (signals: string[]) =>
    signals.reduce((score, signal) => (haystack.includes(signal) ? score + 1 : score), 0);

  const petScore = scorePack([
    "pet",
    "paw",
    "dog",
    "cat",
    "leash",
    "collar",
    "harness",
    "litter",
    "groom",
    "animal",
    "puppy",
    "kitten",
  ]);
  const toolScore = scorePack([
    "tool",
    "hardware",
    "drill",
    "wrench",
    "spanner",
    "plier",
    "screwdriver",
    "socket",
  ]);
  const homeScore = scorePack([
    "home",
    "house",
    "kitchen",
    "household",
    "dinner",
    "plate",
    "cup",
    "teapot",
    "glassware",
    "cutlery",
  ]);

  let pack: ShopCategoryDef[] = [];
  if (petScore > 0 && petScore >= toolScore && petScore >= homeScore) {
    pack = SHOP_CATEGORIES.pawmart ?? [];
  } else if (toolScore > 0 && toolScore >= homeScore) {
    pack = SHOP_CATEGORIES.hardware ?? [];
  } else if (homeScore > 0) {
    pack = SHOP_CATEGORIES.household ?? [];
  }

  // If a keyword pack would dump most products into "More to explore",
  // prefer Excel taxonomy (google/fb category) discovery instead.
  if (pack.length > 0 && productInputs.length > 0) {
    const otherRatio = estimateOtherRatio(productInputs, pack);
    if (otherRatio >= 0.45) {
      if (taxonomy.length > 0) return taxonomy;
    }
    return pack;
  }

  if (taxonomy.length > 0) return taxonomy;

  if (productInputs.length > 0) {
    return discoverShopCategoriesFromProducts(productInputs.map((p) => p.name));
  }

  return [];
}

function slugifyCategoryLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function titleCaseLabel(label: string): string {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Build shop categories from Excel google_product_category / fb_product_category
 * leaf segments — the real taxonomy already present in Meta uploads.
 */
export function discoverShopCategoriesFromTaxonomy(
  products: ShopCategoryProductInput[],
  maxCategories = 12
): ShopCategoryDef[] {
  const freq = new Map<
    string,
    { count: number; label: string; keywords: Set<string> }
  >();

  for (const product of products) {
    const path = product.googleCategory || product.fbCategory || "";
    const segments = path
      .split(/>|\//)
      .map((part) => part.trim())
      .filter(Boolean);
    if (segments.length === 0) continue;

    const leaf = segments[segments.length - 1]!;
    const parent = segments.length > 1 ? segments[segments.length - 2] : null;
    const slug = slugifyCategoryLabel(leaf);
    if (!slug || slug.length < 3) continue;

    const entry = freq.get(slug) ?? {
      count: 0,
      label: leaf,
      keywords: new Set<string>(),
    };
    entry.count += 1;
    entry.keywords.add(leaf.toLowerCase());
    for (const token of leaf.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token.length >= 4 && !STOP_WORDS.has(token)) entry.keywords.add(token);
    }
    if (parent) {
      entry.keywords.add(parent.toLowerCase());
      for (const token of parent.toLowerCase().split(/[^a-z0-9]+/)) {
        if (token.length >= 4 && !STOP_WORDS.has(token)) entry.keywords.add(token);
      }
    }
    freq.set(slug, entry);
  }

  return [...freq.entries()]
    .filter(([, meta]) => meta.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, maxCategories)
    .map(([slug, meta], index) => ({
      slug,
      name: titleCaseLabel(meta.label),
      keywords: [...meta.keywords],
      sortOrder: index + 1,
    }));
}

export function estimateOtherRatio(
  products: ShopCategoryProductInput[],
  defs: ShopCategoryDef[]
): number {
  if (products.length === 0) return 1;
  let other = 0;
  for (const product of products) {
    if (!resolvePrimaryShopCategory(product, defs)) other += 1;
  }
  return other / products.length;
}

export function getShopCategoryDef(
  environmentSlug: string,
  shopSlug: string
): ShopCategoryDef | undefined {
  return getShopCategoryDefs(environmentSlug).find((c) => c.slug === shopSlug);
}

function categoryIsExcluded(text: string, def: ShopCategoryDef): boolean {
  return (def.excludeKeywords ?? []).some((kw) => textIncludesKeyword(text, kw));
}

function bestKeywordScore(text: string, def: ShopCategoryDef): number {
  if (def.isFallback || def.keywords.length === 0) return 0;
  if (categoryIsExcluded(text, def)) return 0;

  let best = 0;
  for (const kw of def.keywords) {
    if (!textIncludesKeyword(text, kw)) continue;
    const words = kw.trim().split(/\s+/).length;
    const score = kw.length * 10 + words * 40;
    if (score > best) best = score;
  }
  return best;
}

/** Case-insensitive keyword match against product name (legacy helper). */
export function productMatchesShopCategory(
  name: string,
  def: ShopCategoryDef
): boolean {
  if (def.isFallback || def.keywords.length === 0) return false;
  const text = name.toLowerCase();
  if (categoryIsExcluded(text, def)) return false;
  return def.keywords.some((kw) => textIncludesKeyword(text, kw));
}

/**
 * Best single category for a product.
 * Each product resolves to at most one category (or null → "More to explore").
 */
export function resolvePrimaryShopCategory(
  input: ShopCategoryProductInput | string,
  defs: ShopCategoryDef[]
): ShopCategoryDef | null {
  const product = normalizeProductInput(input);
  const text = buildMatchText(product).toLowerCase();
  let best: ShopCategoryDef | null = null;
  let bestScore = 0;

  for (const def of defs) {
    if (def.isFallback) continue;
    const score = bestKeywordScore(text, def);
    if (score <= 0) continue;
    // Prefer stronger keyword match; on ties prefer earlier sortOrder (more specific lists first)
    const ranked = score * 1000 - def.sortOrder;
    const bestRanked = bestScore * 1000 - (best?.sortOrder ?? 999);
    if (!best || ranked > bestRanked) {
      best = def;
      bestScore = score;
    }
  }

  return best;
}

export function productBelongsToShopCategory(
  input: ShopCategoryProductInput | string,
  def: ShopCategoryDef,
  defs: ShopCategoryDef[]
): boolean {
  if (def.isFallback || def.slug === OTHER_SHOP_CATEGORY.slug) {
    return resolvePrimaryShopCategory(input, defs) == null;
  }
  return resolvePrimaryShopCategory(input, defs)?.slug === def.slug;
}

/**
 * Auto-build shopper categories from product names when none are configured.
 * Used when a new catalogue is added without manual category defs / Excel taxonomy.
 */
export function discoverShopCategoriesFromProducts(
  productNames: string[],
  maxCategories = 8
): ShopCategoryDef[] {
  const freq = new Map<string, number>();

  for (const name of productNames) {
    const tokens = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));

    const seen = new Set<string>();
    for (const token of tokens) {
      if (seen.has(token)) continue;
      seen.add(token);
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
  }

  return [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCategories)
    .map(([token], i) => ({
      slug: token.replace(/\s+/g, "-"),
      name: token.charAt(0).toUpperCase() + token.slice(1),
      keywords: [token],
      sortOrder: i + 1,
    }));
}

export function getEffectiveShopCategoryDefs(
  environmentSlug: string,
  productNames: string[] = []
): ShopCategoryDef[] {
  return resolveCatalogueShopCategoryPack({
    slug: environmentSlug,
    productNames,
  });
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
