import { CustomerActivityTracker } from "@/components/analytics/CustomerActivityTracker";

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomerActivityTracker />
      {children}
    </>
  );
}
