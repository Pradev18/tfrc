"use client";

import { useEffect, useState } from "react";
import { getStoredContact, saveStoredContact } from "@/lib/customer-session";

/** Optional contact fields in cart — saved locally, sent with order records (admin only) */
export function CartContactFields() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const saved = getStoredContact();
    setName(saved.name);
    setPhone(saved.phone);
  }, []);

  function persist(next: { name: string; phone: string }) {
    saveStoredContact(next);
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div>
        <label htmlFor="cart-contact-name" className="text-[10px] font-medium text-text-muted">
          Your name (optional)
        </label>
        <input
          id="cart-contact-name"
          type="text"
          value={name}
          onChange={(e) => {
            const next = { name: e.target.value, phone };
            setName(next.name);
            persist(next);
          }}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-xs"
          placeholder="Name"
          autoComplete="name"
        />
      </div>
      <div>
        <label htmlFor="cart-contact-phone" className="text-[10px] font-medium text-text-muted">
          WhatsApp number (optional)
        </label>
        <input
          id="cart-contact-phone"
          type="tel"
          value={phone}
          onChange={(e) => {
            const next = { name, phone: e.target.value };
            setPhone(next.phone);
            persist(next);
          }}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-xs"
          placeholder="974XXXXXXXX"
          autoComplete="tel"
        />
      </div>
    </div>
  );
}
