import { Header } from "@/components/public/Header";
import { Footer } from "@/components/public/Footer";
import { CustomerActivityTracker } from "@/components/analytics/CustomerActivityTracker";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomerActivityTracker />
      <Header />
      <main className="min-h-[60vh]">{children}</main>
      <Footer />
    </>
  );
}
