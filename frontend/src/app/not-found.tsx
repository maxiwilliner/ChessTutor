import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";

export const metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <Card className="mx-auto mt-8 max-w-lg animate-fade-up p-8 text-center sm:p-10">
      <div className="num font-display text-5xl font-semibold text-brass-300">404</div>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ivory">Esta casilla está vacía</h1>
      <p className="mx-auto mb-6 mt-2 max-w-sm text-sm text-ivory-muted">La página que buscas no existe o ha cambiado de sitio.</p>
      <Link href="/" className={buttonClasses("primary", "md")}>
        Volver al inicio
      </Link>
    </Card>
  );
}
