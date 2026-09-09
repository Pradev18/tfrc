export const ALL_PRODUCTS_CATEGORY_SLUG = "__all__";

let pendingTimers: number[] = [];

export const STORE_CATEGORY_FOCUS_EVENT = "store-category-focus";
export const STORE_SHOW_ALL_EVENT = "store-show-all-catalog";
export const STORE_ALL_PRODUCTS_EVENT = "store-all-products";

/**
 * Keep the selected heading anchored while lazy product sections above it
 * finish rendering and change the document height.
 */
export function scrollToStoreCategory(slug: string) {
  pendingTimers.forEach(window.clearTimeout);
  pendingTimers = [];

  window.history.replaceState(null, "", `#category-${slug}`);

  const align = (behavior: ScrollBehavior) => {
    document
      .getElementById(`category-${slug}`)
      ?.scrollIntoView({ behavior, block: "start" });
  };

  align("smooth");
  for (const delay of [80, 220, 500, 900, 1400]) {
    pendingTimers.push(window.setTimeout(() => align("auto"), delay));
  }
}

/** Focus one shop category everywhere (header, toolbar, mobile drawer). */
export function focusStoreCategory(slug: string) {
  window.history.replaceState(null, "", `#category-${slug}`);
  window.dispatchEvent(
    new CustomEvent(STORE_CATEGORY_FOCUS_EVENT, { detail: { slug } })
  );
}

/** Clear category focus and return to full catalogue browse. */
export function showAllStoreCategories() {
  window.dispatchEvent(new CustomEvent(STORE_SHOW_ALL_EVENT));
  window.history.replaceState(null, "", "#catalog");
  requestAnimationFrame(() => {
    document.getElementById("catalog")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

/** Show every product in one paginated grid. */
export function showAllStoreProducts() {
  window.history.replaceState(null, "", "#catalog");
  window.dispatchEvent(new CustomEvent(STORE_ALL_PRODUCTS_EVENT));
}

/** Keep sticky header/toolbar offsets accurate on mobile as content wraps. */
export function syncStoreStickyOffsets() {
  if (typeof document === "undefined") return;
  const header = document.querySelector(".store-site-header") as HTMLElement | null;
  const toolbar = document.querySelector(".store-sticky-toolbar") as HTMLElement | null;
  const headerH = header?.getBoundingClientRect().height ?? 104;
  const toolbarH = toolbar?.getBoundingClientRect().height ?? 120;
  document.documentElement.style.setProperty("--store-header-height", `${Math.ceil(headerH)}px`);
  document.documentElement.style.setProperty(
    "--store-toolbar-offset",
    `${Math.ceil(headerH + toolbarH + 8)}px`
  );
}
