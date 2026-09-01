import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

async function updateWhatsApp(formData: FormData) {
  "use server";
  const session = await auth();
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
  const session = await auth();
  if (!session) redirect("/admin/login");

  const params = await searchParams;
  const settings = await prisma.whatsAppSetting.findFirst();

  return (
    <div>
      <h1 className="text-display text-3xl text-primary">WhatsApp Settings</h1>
      <p className="mt-2 text-text-muted">
        Configure the WhatsApp number and message template for product enquiries.
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
            defaultValue={settings?.defaultGreeting ?? "Hi PawMart Qatar 👋"}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Product Enquiry Template</label>
          <textarea
            name="productTemplate"
            rows={5}
            defaultValue={
              settings?.productTemplate ??
              "I'm interested in:\n\nProduct: {{name}} {{productId}}\nPrice: {{price}}\n\nPlease confirm availability and delivery."
            }
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-text-muted">
            Variables: {"{{name}}"}, {"{{productId}}"}, {"{{price}}"}, {"{{url}}"}
          </p>
        </div>
        <button type="submit" className="btn-primary text-sm">Save Settings</button>
      </form>
    </div>
  );
}
