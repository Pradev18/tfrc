const SHORT_LABELS: Record<string, string> = {
  "Animals & Pet Supplies": "Pet Supplies",
  "Home & Garden": "Home & Garden",
  Hardware: "Tools & Hardware",
};

export function shortLabel(name: string): string {
  return SHORT_LABELS[name] ?? name;
}
