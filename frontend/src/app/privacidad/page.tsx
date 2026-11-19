import type { Metadata } from "next";
import Link from "next/link";
import { APP_MODE } from "@/lib/mode";
import { FEEDBACK_URL } from "@/lib/site";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Privacidad",
  description: "Qué datos usa ChessTutor, dónde se guardan y cómo borrarlos.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-xl font-semibold text-ivory">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-ivory-muted">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const demo = APP_MODE === "demo";
  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <h1 className="font-display text-3xl font-semibold text-ivory sm:text-4xl">Privacidad y datos</h1>
      <p className="mt-2 text-sm text-ivory-faint">Resumen claro, sin letra pequeña.</p>

      <Card className="mt-8 space-y-8 p-6 sm:p-8">
        <Section title="Qué datos usamos">
          <p>
            Solo el nombre de usuario de Chess.com que escribes y tus <strong className="text-ivory">partidas públicas</strong>, que
            descargamos de la API pública de Chess.com (jugadas, tiempos del reloj, aperturas y resultados). No pedimos email, contraseña
            ni ningún otro dato personal.
          </p>
        </Section>

        <Section title="Dónde se guardan">
          {demo ? (
            <>
              <p>
                En esta demo <strong className="text-ivory">no hay servidor ni cuentas</strong>. El análisis se hace en tu propio navegador
                y el resultado (diagnóstico, ejercicios y tu progreso) se guarda únicamente en el almacenamiento local de este navegador
                (IndexedDB). No sale de tu equipo y nosotros no podemos verlo.
              </p>
              <p>
                Tu navegador habla directamente con <code className="num text-ivory">api.chess.com</code> para descargar las partidas y con
                el servidor de imágenes de Chess.com para mostrar tu avatar.
              </p>
            </>
          ) : (
            <p>
              El análisis se hace en nuestro servidor. Guardamos los ejercicios generados a partir de tus errores y tu progreso de repaso,
              asociados a tu nombre de usuario de Chess.com, para que puedas continuar entre visitas.
            </p>
          )}
        </Section>

        <Section title="Cookies y estadísticas">
          <p>
            No usamos cookies de seguimiento ni publicidad. Podemos medir visitas de forma agregada y anónima con Cloudflare Web Analytics,
            que no usa cookies ni identifica a personas.
          </p>
          <p>
            Si algo falla (por ejemplo, el motor no arranca en tu navegador), podemos recibir un informe técnico anónimo con el error, el
            navegador y el número de núcleos del dispositivo, a través de Sentry. Antes de enviarlo borramos los nombres de usuario; no
            incluye tus partidas, cookies ni tu dirección IP.
          </p>
        </Section>

        <Section title="Cómo borrar tus datos">
          {demo ? (
            <p>
              Usa «Borrar mis datos de este navegador» al pie de cualquier página, o borra los datos del sitio desde la configuración de tu
              navegador. También puedes exportarlos antes en formato JSON.
            </p>
          ) : (
            <p>Escríbenos y eliminaremos los ejercicios y el progreso asociados a tu usuario.</p>
          )}
        </Section>

        <Section title="Terceros y licencias">
          <p>
            ChessTutor no está afiliado ni respaldado por Chess.com. El análisis usa el motor{" "}
            <a href="https://stockfishchess.org" target="_blank" rel="noreferrer" className="text-brass-300 hover:underline">
              Stockfish
            </a>
            , software libre bajo licencia GPL-3.0
            {demo && (
              <>
                {" "}(
                <a href="/engine/COPYING.txt" className="text-brass-300 hover:underline">
                  texto de la licencia
                </a>{" "}
                ·{" "}
                <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noreferrer" className="text-brass-300 hover:underline">
                  código fuente
                </a>
                )
              </>
            )}
            .
          </p>
        </Section>

        {FEEDBACK_URL && (
          <Section title="Contacto">
            <p>
              Dudas o sugerencias:{" "}
              <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" className="text-brass-300 hover:underline">
                formulario de opinión
              </a>
              .
            </p>
          </Section>
        )}
      </Card>

      <p className="mt-6 text-center text-sm">
        <Link href="/" className="text-brass-300 hover:underline">
          Volver al inicio
        </Link>
      </p>
    </div>
  );
}
