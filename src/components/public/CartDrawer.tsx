"use client";

import Image from "next/image";
import { X, Trash2 } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useCart } from "@/context/CartContext";
import { cartItemsForWhatsApp } from "@/hooks/useCartWhatsApp";
import {
  buildCartWhatsAppCheckoutUrl,
  buildCartWhatsAppMessage,
  type WhatsAppSettings,
} from "@/lib/whatsapp";
import { CartCatalogLinks } from "@/components/public/CartCatalogLinks";
import { CartContactFields } from "@/components/public/CartContactFields";
import { WhatsAppOrderGate } from "@/components/public/WhatsAppOrderGate";
import {
  cartEstimatedTotal,
  cartItemsToInquiryItems,
  primaryEnvironmentFromCart,
} from "@/lib/inquiry-helpers";
import { resolveSiteUrl } from "@/lib/site-config";
import { trackMetaInitiateCheckout } from "@/components/analytics/MetaPixel";
import { formatCurrency } from "@/lib/utils";
import { UiSelect } from "@/components/ui/UiSelect";
import { MEDIA_BLUR_DATA_URL, MediaFallback } from "@/components/public/MediaFallback";
import { flushSync } from "react-dom";
import { calculateLineTotal } from "@/lib/money";
import { useT } from "@/context/LanguageContext";

const CART_QTY_OPTIONS = Array.from({ length: 20 }, (_, index) => ({
  value: String(index + 1),
  label: String(index + 1),
}));

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  whatsappSettings?: WhatsAppSettings;
  siteUrl?: string;
}

export function CartDrawer({
  open,
  onClose,
  whatsappSettings,
  siteUrl = "",
}: CartDrawerProps) {
  const t = useT();
  const { items, removeItem, clearCart, setItemQuantity } = useCart();

  const settings: WhatsAppSettings = whatsappSettings ?? {
    phoneNumber: "97455049229",
    defaultGreeting: "Hello, I would like to order from TFRC Wholesale Services",
    productTemplate: "",
  };

  const resolvedSiteUrl = resolveSiteUrl(siteUrl);
  const waItems = cartItemsForWhatsApp(items);
  const waHref =
    items.length > 0
      ? buildCartWhatsAppCheckoutUrl(settings, waItems, resolvedSiteUrl)
      : `https://wa.me/${settings.phoneNumber}`;

  const waMessage =
    items.length > 0
      ? buildCartWhatsAppMessage(settings, waItems, resolvedSiteUrl)
      : undefined;
  const env = primaryEnvironmentFromCart(items);
  const totalUnits = items.reduce(
    (sum, item) => sum + Math.max(1, item.quantity ?? 1),
    0
  );
  const estimatedTotal = cartEstimatedTotal(items);

  function handleRemoveItem(id: string) {
    const removingLastItem = items.length === 1;
    // Commit the cart update before the click finishes so no stale row or
    // portalled quantity menu can remain painted on screen.
    flushSync(() => removeItem(id));
    if (removingLastItem) onClose();
  }

  function handleClearCart() {
    flushSync(clearCart);
    onClose();
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col bg-surface shadow-2xl"
        role="dialog"
        aria-label={t("cart.title")}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-text">{t("cart.title")}</h2>
            <p className="text-xs text-text-muted">
              {items.length === 0
                ? t("cart.empty")
                : t("cart.itemsSelected", {
                    units: totalUnits,
                    variants: items.length,
                  })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-muted"
            aria-label={t("cart.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-text-muted">{t("cart.emptyHint")}</p>
              <p className="mt-1 font-semibold text-primary">{t("cart.emptyHint2")}</p>
              <p className="mt-4 text-sm text-text-subtle">{t("cart.emptyHint3")}</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-lg border border-border p-3"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-white">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        className="bg-white object-cover"
                        sizes="64px"
                        placeholder="blur"
                        blurDataURL={MEDIA_BLUR_DATA_URL}
                      />
                    ) : (
                      <MediaFallback />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-text-subtle">
                      {item.environmentName}
                    </p>
                    <p className="line-clamp-2 font-sans text-sm font-medium text-text">{item.name}</p>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {item.size ? t("cart.size", { size: item.size }) : ""}
                      {item.size && item.productId ? " · " : ""}
                      {item.productId ? t("cart.code", { code: item.productId }) : ""}
                    </p>
                    <div className="mt-2 flex max-w-28 items-center gap-2">
                      <span className="text-[11px] text-text-muted">{t("product.qty")}</span>
                      <UiSelect
                        value={item.quantity}
                        options={CART_QTY_OPTIONS}
                        onValueChange={(value) =>
                          setItemQuantity(item.productId, Number(value))
                        }
                        ariaLabel={`${t("product.qty")} ${item.name}${item.size ? ` ${item.size}` : ""}`}
                        className="min-h-[34px] px-3 text-xs"
                      />
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      {formatCurrency(item.price, item.currency)} × {Math.max(1, item.quantity ?? 1)}
                    </p>
                    <p className="text-sm font-semibold text-primary">
                      {t("cart.lineTotal")}{" "}
                      {formatCurrency(
                        calculateLineTotal(item.price, item.quantity),
                        item.currency
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="shrink-0 self-start p-1 text-text-subtle hover:text-error"
                    aria-label={`${t("cart.remove")} ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
              <div className="pt-2">
                <CartCatalogLinks items={items} phoneNumber={settings.phoneNumber} />
              </div>
            </ul>
          )}
        </div>

        <div className="border-t border-border p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] space-y-3">
          {items.length > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">{t("cart.estimatedTotal")}</span>
                <span className="text-lg font-semibold text-primary">
                  {formatCurrency(estimatedTotal, items[0]?.currency ?? "QAR")}
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearCart}
                className="w-full py-2 text-xs font-medium text-text-subtle hover:text-error"
              >
                {t("cart.clearAll")}
              </button>
              <p className="text-center text-[11px] text-text-muted">
                {totalUnits === 1
                  ? t("cart.orderHintSingular")
                  : t("cart.orderHintPlural", {
                      units: totalUnits,
                      variants: items.length,
                    })}
              </p>
              <CartContactFields />
            </>
          )}

          {items.length > 0 ? (
            <WhatsAppOrderGate
              href={waHref}
              inquiry={{
                eventType: "CART_CHECKOUT",
                ...env,
                itemCount: totalUnits,
                estimatedTotal,
                currency: items[0]?.currency ?? "QAR",
                whatsappMessage: waMessage,
                items: cartItemsToInquiryItems(items),
              }}
              onAfterNavigate={() => {
                trackMetaInitiateCheckout(
                  estimatedTotal,
                  items[0]?.currency ?? "QAR",
                  totalUnits
                );
                clearCart();
                onClose();
              }}
              className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-md bg-whatsapp py-3.5 text-sm font-semibold text-white transition-colors hover:bg-whatsapp-hover"
            >
              <WhatsAppIcon className="h-5 w-5" />
              {totalUnits === 1
                ? t("cart.sendOrder")
                : t("cart.sendOrderItems", { count: totalUnits })}
            </WhatsAppOrderGate>
          ) : (
            <span className="flex w-full min-h-[48px] cursor-not-allowed items-center justify-center gap-2 rounded-md bg-text-subtle py-3.5 text-sm font-semibold text-white opacity-60">
              <WhatsAppIcon className="h-5 w-5" />
              {t("cart.addProductsFirst")}
            </span>
          )}
        </div>
      </aside>
    </>
  );
}
