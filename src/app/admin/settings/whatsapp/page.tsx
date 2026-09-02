import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getVerifiedAdminSession } from "@/lib/admin-auth";

async function updateWhatsApp(formData: FormData) {
  "use server";
  const session = await getVerifiedAdminSession();
  if (!session) redirect("/admin/login");

  const phoneNumber = String(formData.get("phoneNumber") ?? "").replace(/\D/g, "");
  const defaultGreeting = String(formData.get("defaultGreeting") ?? "");
  const productTemplate = String(formData.get("productTemplate") ?? "");

  const existing = await prisma.whatsAppSetting.findFirst();
  if (existing) {
    await prisma.whatsAppSetting.update({
      where: { id: existing.id },
      data: { phoneNumber, defaultGreeting, productTemplate },
    });
  } else {
    await prisma.whatsAppSetting.create({
      data: { phoneNumber, defaultGreeting, productTemplate, isActive: true },
    });
  }

  revalidatePath("/");
  redirect("/admin/settings/whatsapp?saved=1");
}

export default async function WhatsAppSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await getVerifiedAdminSession();
  if (!session) redirect("/admin/login");

  const params = await searchParams;
  const settings = await prisma.whatsAppSetting.findFirst();

  return (
    <div>
      <h1 className="text-display text-3xl text-primary">WhatsApp Settings</h1>
      <p className="mt-2 text-text-muted">
        Configure your WhatsApp number and the greeting customers see at the start of each order
        message.
      </p>

      {params.saved && (
        <p className="mt-4 rounded-md bg-success/10 px-4 py-2 text-sm text-success">
          Settings saved successfully.
        </p>
      )}

      <form action={updateWhatsApp} className="mt-8 max-w-xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">WhatsApp Number</label>
          <input
            name="phoneNumber"
            defaultValue={settings?.phoneNumber ?? "97455049229"}
            placeholder="97455049229"
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            required
          />
          <p className="mt-1 text-xs text-text-muted">Country code included, no + sign</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Default Greeting</label>
          <input
            name="defaultGreeting"
            defaultValue={settings?.defaultGreeting ?? "Hi PawMart Qatar"}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-text-muted">
          <p className="font-medium text-text">How order messages look</p>
          <p className="mt-1">
            Cart and product messages are formatted automatically in plain language — product
            name, price, reference number, and order total. Your team can read them easily without
            technical links or spreadsheet-style details.
          </p>
          <pre className="mt-3 whitespace-pre-wrap rounded-md bg-white p-3 text-xs text-text">
{`Hi PawMart Qatar

I would like to order 2 items from your website:

1. Foldable Pet Carrier
   Price: QAR 68.80
   Ref: 110011585
   Link: https://yourdomain.com/pawmart/product/...

2. Pet Bath Brush
   Price: QAR 12.00
   Ref: 110011584
   Link: https://yourdomain.com/pawmart/product/...

Order total: QAR 80.80

Please confirm all items are available, the total price, and delivery in Qatar.

Thank you!`}
          </pre>
        </div>
        <input type="hidden" name="productTemplate" value={settings?.productTemplate ?? ""} />
        <button type="submit" className="btn-primary text-sm">Save Settings</button>
      </form>
    </div>
  );
}
