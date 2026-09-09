const CLOTHING_SIZE_TOKEN =
  "(?:XXXXL|XXXL|XXL|XL|L|M|S|XS|XXS|XXXS|ONE\\s*SIZE|FREE\\s*SIZE)";

const MEASUREMENT_TOKEN =
  "(?:\\d+(?:[./x×*]\\d+)*\\s*(?:mm|cm|m|ml|l|inch|in|\"|')|\\d+(?:mm|cm|m|ml))";

const PAREN_SIZE_RE = new RegExp(
  `\\s*\\(\\s*(${CLOTHING_SIZE_TOKEN}|${MEASUREMENT_TOKEN}|\\d+(?:\\.\\d+)?)\\s*\\)`,
  "i"
);
const LABELED_SIZE_RE = new RegExp(
  `\\s+(?:size\\s*[:\\-]?\\s*)(${CLOTHING_SIZE_TOKEN}|${MEASUREMENT_TOKEN}|\\d+(?:\\.\\d+)?)(?=\\s|$)`,
  "i"
);
const TRAILING_CLOTHING_SIZE_RE = new RegExp(`\\s+(${CLOTHING_SIZE_TOKEN})\\s*$`, "i");
const TRAILING_MEASUREMENT_RE = new RegExp(`\\s+(${MEASUREMENT_TOKEN})\\s*$`, "i");
const TRAILING_ID_RE = /\s+\d{5,}\s*$/;

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
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
 * Handles Meta size/item_group_id, clothing sizes, and measurement codes like:
 * "Concrete Drill Bit 16150Mm" → group "concrete-drill-bit", label "16150MM"
 */
export function deriveProductVariantIdentity(input: {
  title: string;
  productId?: string;
  size?: string | null;
  itemGroupId?: string | null;
}): ProductVariantIdentity {
  const titleWithoutId = stripTrailingProductId(input.title, input.productId);

  const parenthesized = titleWithoutId.match(PAREN_SIZE_RE);
  const labeled = titleWithoutId.match(LABELED_SIZE_RE);
  const trailingClothing = titleWithoutId.match(TRAILING_CLOTHING_SIZE_RE);
  const trailingMeasurement = titleWithoutId.match(TRAILING_MEASUREMENT_RE);
  const explicitSize = input.size?.trim();

  const label = explicitSize
    ? normalizeLabel(explicitSize)
    : parenthesized?.[1]
      ? normalizeLabel(parenthesized[1])
      : labeled?.[1]
        ? normalizeLabel(labeled[1])
        : trailingClothing?.[1]
          ? normalizeLabel(trailingClothing[1])
          : trailingMeasurement?.[1]
            ? normalizeLabel(trailingMeasurement[1])
            : null;

  let baseName = titleWithoutId;
  if (parenthesized) baseName = baseName.replace(PAREN_SIZE_RE, " ");
  else if (labeled) baseName = baseName.replace(LABELED_SIZE_RE, " ");
  else if (trailingClothing) baseName = baseName.replace(TRAILING_CLOTHING_SIZE_RE, " ");
  else if (trailingMeasurement) baseName = baseName.replace(TRAILING_MEASUREMENT_RE, " ");
  baseName = baseName.replace(/\s+/g, " ").trim() || titleWithoutId;

  const explicitGroup = input.itemGroupId?.trim();
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
 * Dropdowns still show each product's full display name.
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
  ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "ONE SIZE", "FREE SIZE"].map(
    (size, index) => [size, index]
  )
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

/** Dropdown label: full cleaned name, plus item code when siblings share that name. */
export function variantOptionLabel(
  variant: { name: string; productId: string },
  siblings: Array<{ name: string; productId: string }>
): string {
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
