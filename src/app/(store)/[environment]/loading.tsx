export default function StoreRouteLoading() {
  return (
    <main className="min-h-[70vh] bg-[#faf9f7]" aria-label="Opening page">
      <div className="container-pawmart py-6 md:py-10">
        <div className="mb-6 h-4 w-32 animate-pulse rounded-full bg-black/[0.06]" />
        <div className="grid gap-6 md:grid-cols-2 md:gap-10">
          <div className="aspect-square animate-pulse rounded-3xl bg-white shadow-sm" />
          <div className="flex flex-col justify-center">
            <div className="h-3 w-24 animate-pulse rounded-full bg-black/[0.06]" />
            <div className="mt-4 h-8 w-4/5 animate-pulse rounded-xl bg-black/[0.07]" />
            <div className="mt-3 h-8 w-2/5 animate-pulse rounded-xl bg-black/[0.07]" />
            <div className="mt-6 h-5 w-28 animate-pulse rounded-lg bg-black/[0.06]" />
            <div className="mt-8 h-12 w-full max-w-sm animate-pulse rounded-full bg-black/[0.07]" />
          </div>
        </div>
      </div>
    </main>
  );
}
