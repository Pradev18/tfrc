import { getSiteSettings } from "@/services/settings.service";

export default async function AboutPage() {
  const settings = await getSiteSettings();
  return (
    <div className="container-pawmart section-padding">
        <h1 className="text-display text-4xl text-primary md:text-5xl">About PawMart Qatar</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-muted">
          {settings.site_description ??
            "PawMart Qatar is a premium online catalogue for pet supplies, home accessories, tools and more."}
        </p>
      </div>
  );
}
