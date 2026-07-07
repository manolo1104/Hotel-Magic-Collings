import { ChevronDown } from "lucide-react";
import { faqs, waLink } from "@/lib/site";
import { Reveal } from "@/components/motion/Reveal";

// FAQ con <details>/<summary> nativos: accesible por teclado sin JS, con el
// contenido SIEMPRE presente en el HTML servido (bien para SEO + coherente con
// el schema FAQPage). Reemplaza al acordeón anterior.
export function Faq() {
  return (
    <section className="bg-secondary/40">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 md:py-28">
        <Reveal>
          <h2 className="font-heading text-3xl font-semibold sm:text-4xl">
            Preguntas frecuentes
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Lo esencial antes de tu llegada. ¿Te queda alguna duda?{" "}
            <a
              href={waLink("Hola, tengo una duda sobre el hotel.")}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Escríbenos por WhatsApp
            </a>
            .
          </p>
        </Reveal>

        <Reveal className="mt-8">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {faqs.map((f, i) => (
              <details
                key={i}
                className="group border-border not-last:border-b [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-base font-medium outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card">
                  {f.q}
                  <ChevronDown
                    className="size-5 shrink-0 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="px-5 pb-5 text-[0.95rem] leading-relaxed text-muted-foreground">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
