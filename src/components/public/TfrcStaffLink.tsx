import Link from "next/link";

/** Discrete staff-only link — no visible "Admin" label elsewhere on the site */
export function TfrcStaffLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/admin/login"
      className={`text-[10px] tracking-wide text-[#9c9690]/70 transition-colors hover:text-[#6b6560] ${className}`}
    >
      Are you part of TFRC?
    </Link>
  );
}
