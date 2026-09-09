const CLOTHING_SIZE_TOKEN =
  "(?:XXXXL|XXXL|XXL|XL|L|M|S|XS|XXS|XXXS|ONE\\s*SIZE|FREE\\s*SIZE)";

const WORD_SIZE_TOKEN =
  "(?:XXXXL|XXXL|XXL|EXTRA\\s*EXTRA\\s*LARGE|EXTRA\\s*LARGE|LARGE|MEDIUM|SMALL|X-?LARGE|X-?SMALL)";

const MEASUREMENT_TOKEN =
  "(?:\\d+(?:[./x×*]\\d+)*\\s*(?:mm|cm|m|ml|l|inch|in|\"|')|\\d+(?:mm|cm|m|ml))";

const PAREN_SIZE_RE = new RegExp(
  `\\s*\\(\\s*(${CLOTHING_SIZE_TOKEN}|${MEASUREMENT_TOKEN}|${WORD_SIZE_TOKEN}|\\d+(?:\\.\\d+)?)\\s*\\)`,
  "i"
);
const LABELED_SIZE_RE = new RegExp(
  `\\s+(?:size\\s*[:\\-]?\\s*)(${CLOTHING_SIZE_TOKEN}|${MEASUREMENT_TOKEN}|${WORD_SIZE_TOKEN}|\\d+(?:\\.\\d+)?)(?=\\s|$)`,
  "i"
);
/** "L-Pet Harness", "M - Pet Collar", "S-Pet Collar Mix Color" */
const LEADING_LETTER_SIZE_RE = new RegExp(
  `^(${CLOTHING_SIZE_TOKEN})\\s*[-–—:/]\\s*(.+)$`,
  "i"
);
/** "Medium Dog Leash", "Small Dog Leash", "Large Dog Leash" */
const LEADING_WORD_SIZE_RE = new RegExp(`^(${WORD_SIZE_TOKEN})\\s+(.+)$`, "i");
const TRAILING_CLOTHING_SIZE_RE = new RegExp(`\\s+(${CLOTHING_SIZE_TOKEN})\\s*$`, "i");
const TRAILING_WORD_SIZE_RE = new RegExp(`\\s+(${WORD_SIZE_TOKEN})\\s*$`, "i");
const TRAILING_MEASUREMENT_RE = new RegExp(`\\s+(${MEASUREMENT_TOKEN})\\s*$`, "i");
const TRAILING_ID_RE = /\s+\d{5,}\s*$/;

function normalizeLabel(value: string): string {
  const upper = value.trim().replace(/\s+/g, " ").toUpperCase();
  if (/^EXTRA\s*EXTRA\s*LARGE$/i.test(upper) || upper === "XXXXL") return "XXXXL";
  if (/^EXTRA\s*LARGE$/i.test(upper) || /^X-?LARGE$/i.test(upper)) return "XL";
  if (/^X-?SMALL$/i.test(upper)) return "XS";
  if (upper === "LARGE") return "L";
  if (upper === "MEDIUM") return "M";
  if (upper === "SMALL") return "S";
  return upper;
}

function normalizeGroupKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/(\d+)\s*(pcs?|pc|pieces?)\b/g, "$1pcs")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripTrailingProductId(title: string, productId?: string): string {
  return title
    .replace(
      productId
        ? new RegExp(`\\s+${productId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`)
        : TRAILING_ID_RE,
      ""
    )
    .trim();
}

export interface ProductVariantIdentity {
  groupKey: string | null;
  label: string | null;
  baseName: string;
}

/**
 * Infer variant siblings from catalogue titles.
 * Handles:
 * - "Black Pet Hat (L)" / "size: M"
 * - "L-Pet Harness", "M-Pet Collar Mix Color"
 * - "Medium Dog Leash", "Small Dog Leash"
 * - "Concrete Drill Bit 16150Mm"
 */
export function deriveProductVariantIdentity(input: {
  title: string;
  productId?: string;
  size?: string | null;
  itemGroupId?: string | null;
}): ProductVariantIdentity {
  const titleWithoutId = stripTrailingProductId(input.title, input.productId);
  const explicitSize = input.size?.trim();
  const explicitGroup = input.itemGroupId?.trim();

  const parenthesized = titleWithoutId.match(PAREN_SIZE_RE);
  const labeled = titleWithoutId.match(LABELED_SIZE_RE);
  const leadingLetter = titleWithoutId.match(LEADING_LETTER_SIZE_RE);
  const leadingWord = titleWithoutId.match(LEADING_WORD_SIZE_RE);
  const trailingClothing = titleWithoutId.match(TRAILING_CLOTHING_SIZE_RE);
  const trailingWord = titleWithoutId.match(TRAILING_WORD_SIZE_RE);
  const trailingMeasurement = titleWithoutId.match(TRAILING_MEASUREMENT_RE);

  let label: string | null = null;
  let baseName = titleWithoutId;

  if (explicitSize) {
    label = normalizeLabel(explicitSize);
  } else if (parenthesized?.[1]) {
    label = normalizeLabel(parenthesized[1]);
    baseName = baseName.replace(PAREN_SIZE_RE, " ");
  } else if (labeled?.[1]) {
    label = normalizeLabel(labeled[1]);
    baseName = baseName.replace(LABELED_SIZE_RE, " ");
  } else if (leadingLetter?.[1] && leadingLetter[2]) {
    label = normalizeLabel(leadingLetter[1]);
    baseName = leadingLetter[2].trim();
  } else if (leadingWord?.[1] && leadingWord[2]) {
    label = normalizeLabel(leadingWord[1]);
    baseName = leadingWord[2].trim();
  } else if (trailingClothing?.[1]) {
    label = normalizeLabel(trailingClothing[1]);
    baseName = baseName.replace(TRAILING_CLOTHING_SIZE_RE, " ");
  } else if (trailingWord?.[1]) {
    label = normalizeLabel(trailingWord[1]);
    baseName = baseName.replace(TRAILING_WORD_SIZE_RE, " ");
  } else if (trailingMeasurement?.[1]) {
    label = normalizeLabel(trailingMeasurement[1]);
    baseName = baseName.replace(TRAILING_MEASUREMENT_RE, " ");
  }

  baseName = baseName.replace(/\s+/g, " ").trim() || titleWithoutId;

  const groupKey = explicitGroup
    ? `meta-${normalizeGroupKey(explicitGroup)}`
    : label
      ? normalizeGroupKey(baseName)
      : null;

  return { groupKey, label, baseName };
}

/**
 * Group products that share the same cleaned title (after stripping SKU / size tokens)
 * even when there is no measurement/size label — e.g. kitchen "6Pcs Cups And Plates".
 */
export function assignSharedBaseNameGroups<
  T extends {
    groupKey: string | null;
    label: string | null;
    baseName: string;
    productId?: string | null;
  },
>(identities: T[]): T[] {
  const counts = new Map<string, number>();
  for (const identity of identities) {
    if (identity.groupKey) continue;
    const key = normalizeGroupKey(identity.baseName);
    if (key.length < 4) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return identities.map((identity) => {
    if (identity.groupKey) return identity;
    const key = normalizeGroupKey(identity.baseName);
    if (key.length < 4 || (counts.get(key) ?? 0) < 2) return identity;
    return {
      ...identity,
      groupKey: `name-${key}`,
      label:
        identity.label ??
        (identity.productId
          ? normalizeLabel(identity.productId)
          : normalizeLabel(identity.baseName)),
    };
  });
}

/** Full classify pipeline used by import + backfill. */
export function classifyProductVariants<
  T extends {
    title?: string;
    name?: string;
    productId?: string | null;
    size?: string | null;
    itemGroupId?: string | null;
  },
>(products: T[]): Array<T & ProductVariantIdentity> {
  const derived = products.map((product) => ({
    ...product,
    ...deriveProductVariantIdentity({
      title: product.title ?? product.name ?? "",
      productId: product.productId ?? undefined,
      size: product.size,
      itemGroupId: product.itemGroupId,
    }),
  }));
  return collapseSingletonVariantGroups(assignSharedBaseNameGroups(derived));
}

const SIZE_ORDER = new Map(
  [
    "XXXS",
    "XXS",
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "XXL",
    "XXXL",
    "XXXXL",
    "ONE SIZE",
    "FREE SIZE",
    "SMALL",
    "MEDIUM",
    "LARGE",
  ].map((size, index) => [size, index])
);

function measurementSortValue(label: string | null): number | null {
  if (!label) return null;
  const match = label.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return Number(match[1]);
}

export function compareVariantLabels(a: string | null, b: string | null): number {
  const leftOrder = SIZE_ORDER.get(a ?? "") ?? 100;
  const rightOrder = SIZE_ORDER.get(b ?? "") ?? 100;
  if (leftOrder !== 100 || rightOrder !== 100) {
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  }

  const leftMeasure = measurementSortValue(a);
  const rightMeasure = measurementSortValue(b);
  if (leftMeasure != null && rightMeasure != null && leftMeasure !== rightMeasure) {
    return leftMeasure - rightMeasure;
  }

  return (a ?? "").localeCompare(b ?? "", undefined, { numeric: true, sensitivity: "base" });
}

export function productDisplayTitle(name: string, productId?: string | null): string {
  return stripTrailingProductId(name, productId ?? undefined);
}

/** True for S/M/L, Medium, 16150MM — false for raw item codes used as fake labels. */
export function isHumanReadableSizeLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  const value = label.trim();
  if (!value) return false;
  if (/^\d{5,}$/.test(value)) return false;
  if (/^name-/i.test(value)) return false;
  return true;
}

/** Compact “S · M · L” / “360MM · 12150MM” line — skips item-code fake labels. */
export function formatAvailableSizes(labels: Array<string | null | undefined>): string {
  const unique = [
    ...new Set(
      labels
        .map((label) => label?.trim())
        .filter((label): label is string => isHumanReadableSizeLabel(label))
    ),
  ];
  unique.sort(compareVariantLabels);
  return unique.join(" · ");
}

/**
 * Dropdown label: prefer real size/measurement codes; never show bare item codes
 * as if they were sizes — use the cleaned product title instead.
 */
export function variantOptionLabel(
  variant: { name: string; productId: string; variantLabel?: string | null },
  siblings: Array<{ name: string; productId: string; variantLabel?: string | null }>
): string {
  const size = variant.variantLabel?.trim();
  if (size && isHumanReadableSizeLabel(size)) {
    const sameSizeCount = siblings.filter(
      (sibling) => (sibling.variantLabel?.trim() || "") === size
    ).length;
    if (sameSizeCount > 1) {
      return `${size} · ${variant.productId}`;
    }
    return size;
  }

  const title = productDisplayTitle(variant.name, variant.productId);
  const sameTitleCount = siblings.filter(
    (sibling) => productDisplayTitle(sibling.name, sibling.productId) === title
  ).length;
  if (sameTitleCount > 1 && variant.productId) {
    return `${title} · ${variant.productId}`;
  }
  return title;
}

/** Drop one-off "groups" so a lone product never forces a size dropdown. */
export function collapseSingletonVariantGroups<T extends { groupKey: string | null }>(
  identities: T[]
): T[] {
  const counts = new Map<string, number>();
  for (const identity of identities) {
    if (!identity.groupKey) continue;
    counts.set(identity.groupKey, (counts.get(identity.groupKey) ?? 0) + 1);
  }
  return identities.map((identity) => {
    if (!identity.groupKey || (counts.get(identity.groupKey) ?? 0) >= 2) return identity;
    return { ...identity, groupKey: null };
  });
}
