export default function StoreRouteLoading() {
  return (
    <main className="min-h-[40vh] bg-transparent" aria-label="Opening catalogue">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 h-5 w-40 animate-pulse rounded bg-black/[0.06]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl bg-white/70">
              <div className="aspect-square animate-pulse bg-black/[0.05]" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-3/4 animate-pulse rounded bg-black/[0.06]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-black/[0.05]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
