const SIZE_TOKEN =
  "(?:XXXXL|XXXL|XXL|XL|L|M|S|XS|XXS|XXXS|ONE\\s*SIZE|FREE\\s*SIZE|\\d+(?:\\.\\d+)?)";

const PAREN_SIZE_RE = new RegExp(`\\s*\\(\\s*(${SIZE_TOKEN})\\s*\\)`, "i");
const LABELED_SIZE_RE = new RegExp(`\\s+(?:size\\s*[:\\-]?\\s*)(${SIZE_TOKEN})(?=\\s|$)`, "i");
const TRAILING_ID_RE = /\s+\d{5,}\s*$/;

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizeGroupKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface ProductVariantIdentity {
  groupKey: string | null;
  label: string | null;
  baseName: string;
}

/**
 * Infer size siblings from catalogue titles such as "Black Pet Hat (M) 110011574".
 * Explicit Meta size/item_group_id values take priority when supplied.
 */
export function deriveProductVariantIdentity(input: {
  title: string;
  productId?: string;
  size?: string | null;
  itemGroupId?: string | null;
}): ProductVariantIdentity {
  const titleWithoutId = input.title
    .replace(
      input.productId
        ? new RegExp(`\\s+${input.productId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`)
        : TRAILING_ID_RE,
      ""
    )
    .trim();

  const parenthesized = titleWithoutId.match(PAREN_SIZE_RE);
  const labeled = titleWithoutId.match(LABELED_SIZE_RE);
  const explicitSize = input.size?.trim();
  const label = explicitSize
    ? normalizeLabel(explicitSize)
    : parenthesized?.[1]
      ? normalizeLabel(parenthesized[1])
      : labeled?.[1]
        ? normalizeLabel(labeled[1])
        : null;

  let baseName = titleWithoutId;
  if (parenthesized) baseName = baseName.replace(PAREN_SIZE_RE, " ");
  else if (labeled) baseName = baseName.replace(LABELED_SIZE_RE, " ");
  baseName = baseName.replace(/\s+/g, " ").trim();

  const explicitGroup = input.itemGroupId?.trim();
  const groupKey = explicitGroup
    ? `meta-${normalizeGroupKey(explicitGroup)}`
    : label
      ? normalizeGroupKey(baseName)
      : null;

  return { groupKey, label, baseName };
}

const SIZE_ORDER = new Map(
  ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "ONE SIZE", "FREE SIZE"].map(
    (size, index) => [size, index]
  )
);

export function compareVariantLabels(a: string | null, b: string | null): number {
  const left = SIZE_ORDER.get(a ?? "") ?? 100;
  const right = SIZE_ORDER.get(b ?? "") ?? 100;
  if (left !== right) return left - right;
  return (a ?? "").localeCompare(b ?? "", undefined, { numeric: true });
}
