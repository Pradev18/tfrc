"use client";

import { useState } from "react";

const MAX_QUANTITY = 999;

function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(value)));
}

export function ProductQuantityOrder({
  whatsappPhone,
  messageIntro,
  messageOutro,
  unitPrice,
  currency,
}: {
  whatsappPhone: string;
  messageIntro: string;
  messageOutro: string;
  unitPrice: number;
  currency: string;
}) {
  const [quantity, setQuantity] = useState(1);
  const price = Number.isFinite(unitPrice) ? unitPrice : 0;
  const total = price * quantity;

  const message = [
    messageIntro,
    `Quantity: ${quantity}`,
    `Price: ${currency} ${price.toFixed(2)}${quantity > 1 ? ` × ${quantity} = ${currency} ${total.toFixed(2)}` : ""}`,
    messageOutro,
  ]
    .filter(Boolean)
    .join("\n");
  const href = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;

  return (
    <div className="mt-5">
      <p className="mb-2 text-sm font-semibold text-[#141414]">Quantity</p>
      <div className="flex items-center gap-4">
        <div className="inline-flex items-center rounded-full border border-[#d4cfc8] bg-white">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((q) => clampQuantity(q - 1))}
            disabled={quantity <= 1}
            className="flex h-11 w-11 items-center justify-center text-lg text-[#141414] disabled:opacity-40"
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_QUANTITY}
            value={quantity}
            onChange={(e) => setQuantity(clampQuantity(Number(e.target.value)))}
            aria-label="Quantity"
            className="h-11 w-14 border-x border-[#d4cfc8] bg-transparent text-center text-sm font-semibold tabular-nums text-[#141414] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((q) => clampQuantity(q + 1))}
            disabled={quantity >= MAX_QUANTITY}
            className="flex h-11 w-11 items-center justify-center text-lg text-[#141414] disabled:opacity-40"
          >
            +
          </button>
        </div>
        {quantity > 1 ? (
          <p className="text-sm text-[#6b6560]">
            Total:{" "}
            <span className="font-semibold tabular-nums text-[#141414]">
              {currency} {total.toFixed(2)}
            </span>
          </p>
        ) : null}
      </div>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex min-h-[48px] items-center justify-center rounded-full bg-[#128c47] px-6 text-sm font-semibold text-white"
      >
        Order on WhatsApp
      </a>
    </div>
  );
}
