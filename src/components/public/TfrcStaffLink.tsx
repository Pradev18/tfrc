/** Discrete staff-only link — no visible "Admin" label elsewhere on the site */
export function TfrcStaffLink({ className = "" }: { className?: string }) {
  return (
    <a
      href="/admin/login"
      className={`inline-flex min-h-[44px] items-center px-3 text-[11px] tracking-wide text-[#9c9690]/70 transition-colors hover:text-[#6b6560] ${className}`}
    >
      Are you part of TFRC?
    </a>
  );
}
