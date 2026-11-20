import { pageMetadata } from "@/lib/i18n/metadata";

export const metadata = pageMetadata("en", "dashboard");

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
