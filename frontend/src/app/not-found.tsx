import { MESSAGES } from "@/lib/i18n/messages";
import NotFoundView from "@/views/NotFoundView";

export const metadata = { title: MESSAGES.en.meta.notFoundTitle };

export default function NotFound() {
  return <NotFoundView />;
}
