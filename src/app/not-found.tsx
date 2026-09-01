import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[#faf9f7]">
      <header className="border-b border-[#ebe8e3] bg-white px-6 py-5 md:px-10">
        <Link href="/" className="font-display text-2xl font-medium tracking-tight text-[#141414]">
          TFRC <span className="text-[#9c9690]">Vita Nova</span>
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#9c9690]">
          Page not found
        </p>
        <h1 className="mt-6 font-display text-[7rem] font-light leading-none text-[#141414] md:text-[9rem]">
          404
        </h1>
        <p className="mt-6 max-w-md text-base leading-relaxed text-[#6b6560]">
          This page does not exist or may have moved. Choose a catalogue from the home page.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-[#141414] px-8 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            All catalogues
          </Link>
          <Link
            href="/pawmart"
            className="rounded-full border border-[#d4cfc8] px-8 py-3.5 text-sm font-semibold text-[#141414] transition-colors hover:border-[#141414]"
          >
            PawMart
          </Link>
        </div>
      </main>
    </div>
  );
}
