import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { SiteClinic } from "./types";

type Props = { clinic: SiteClinic };

function faqFrom(clinic: SiteClinic) {
  const raw = (clinic as unknown as { faqs?: unknown }).faqs;
  if (Array.isArray(raw) && raw.length) return raw as { q: string; a: string }[];
  return [
    { q: "How do I book an appointment?", a: `You can book online via the booking page in under a minute. You'll receive instant confirmation.` },
    { q: "What is the consultation fee?", a: `The standard consultation fee at ${clinic.clinic_name} is ₹${clinic.consultation_fee}. Follow-ups may differ.` },
    { q: "Do you accept walk-ins?", a: "We prioritise booked appointments to minimise waiting. Walk-ins are accepted if a slot is available." },
    { q: "Is online consultation available?", a: "Yes, video consultations can be booked through the same booking flow." },
  ];
}

/** v1: Accordion */
export function FaqAccordion({ clinic }: Props) {
  const items = faqFrom(clinic);
  return (
    <section className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-primary font-medium">FAQ</p>
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl mt-2">Common questions</h2>
      </div>
      <Accordion type="single" collapsible className="mt-8">
        {items.map((f, i) => (
          <AccordionItem key={i} value={`i-${i}`}>
            <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

/** v2: Two-column list */
export function FaqColumns({ clinic }: Props) {
  const items = faqFrom(clinic);
  return (
    <section className="bg-surface border-y">
      <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl">Questions, answered</h2>
        <div className="mt-10 grid md:grid-cols-2 gap-x-10 gap-y-8">
          {items.map((f, i) => (
            <div key={i}>
              <h3 className="font-medium text-base">{f.q}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const FaqVariants = {
  accordion: FaqAccordion,
  columns: FaqColumns,
} as const;

export const FaqMeta = {
  key: "faq" as const,
  label: "FAQ section",
  defaultId: "accordion",
  options: [
    { id: "accordion", label: "Accordion", description: "Click to expand" },
    { id: "columns", label: "Two columns", description: "Editorial Q&A list" },
  ],
};
