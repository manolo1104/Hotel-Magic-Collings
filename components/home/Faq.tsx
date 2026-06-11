import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { faqs } from "@/lib/site";
import { Reveal } from "@/components/motion/Reveal";

export function Faq() {
  return (
    <section className="bg-secondary/40">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 md:py-28">
        <Reveal>
          <h2 className="font-heading text-3xl font-semibold sm:text-4xl">
            Preguntas frecuentes
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Lo esencial antes de tu llegada. ¿Te queda alguna duda? Escríbenos por
            WhatsApp.
          </p>
        </Reveal>

        <Reveal className="mt-8">
          <Accordion multiple={false} className="rounded-2xl border border-border bg-card px-5">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={i}>
                <AccordionTrigger className="py-5 text-base font-medium">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-[0.95rem] leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
