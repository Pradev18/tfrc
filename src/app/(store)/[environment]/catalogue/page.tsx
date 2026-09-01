import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ environment: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

/** Catalogue lives on the store home page — redirect with filters preserved */
export default async function EnvironmentCataloguePage({ params, searchParams }: PageProps) {
  const { environment: slug } = await params;
  const query = await searchParams;
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) qs.set(key, value);
  }

  const suffix = qs.toString();
  redirect(suffix ? `/${slug}?${suffix}#catalog` : `/${slug}#catalog`);
}
