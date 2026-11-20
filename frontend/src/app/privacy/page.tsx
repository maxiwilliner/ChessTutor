import { pageMetadata } from "@/lib/i18n/metadata";
import PrivacyView from "@/views/PrivacyView";

export const metadata = pageMetadata("en", "privacy");

export default function PrivacyPage() {
  return <PrivacyView />;
}
