import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, COMPANY } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/refund-policy")({
  component: RefundPage,
  head: () => ({
    meta: [
      { title: "Refund & Cancellation Policy — ClinicX" },
      { name: "description", content: "How subscription refunds and cancellations work on ClinicX." },
      { property: "og:title", content: "Refund & Cancellation Policy — ClinicX" },
      { property: "og:description", content: "How subscription refunds and cancellations work on ClinicX." },
      { property: "og:url", content: "/refund-policy" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/refund-policy" }],
  }),
});

function RefundPage() {
  return (
    <LegalPage title="Refund & Cancellation Policy" updated="July 5, 2026">
      <p>
        This policy explains how cancellations and refunds are handled for {COMPANY.name} subscription plans.
      </p>

      <h2>1. Cancellations</h2>
      <ul>
        <li>You can cancel your subscription anytime from <strong>Dashboard → Billing</strong>.</li>
        <li>Cancellation stops future auto-pay charges. Your plan remains active until the end of the current billing cycle.</li>
        <li>After the cycle ends, your account moves to the Free tier. Your data is preserved.</li>
      </ul>

      <h2>2. Refunds</h2>
      <ul>
        <li><strong>Monthly plans:</strong> non-refundable. You continue to have access until the end of the paid month.</li>
        <li><strong>Yearly plans:</strong> refundable on a pro-rata basis within the first 14 days of purchase, minus payment-gateway fees.</li>
        <li><strong>Add-ons and consumables</strong> (SMS credits, WhatsApp messages, storage top-ups): non-refundable once consumed.</li>
      </ul>

      <h2>3. When refunds are issued</h2>
      <p>We will issue a refund at our discretion when:</p>
      <ul>
        <li>You were charged in error due to a technical issue.</li>
        <li>A duplicate charge was made for the same billing cycle.</li>
        <li>A material feature was unavailable for a prolonged period and we cannot restore it in reasonable time.</li>
      </ul>

      <h2>4. Not eligible</h2>
      <p>Refunds are not available for:</p>
      <ul>
        <li>Change of mind after the 14-day yearly window.</li>
        <li>Failure to cancel before auto-pay renewed.</li>
        <li>Suspension due to violation of the Terms of Service.</li>
      </ul>

      <h2>5. How to request a refund</h2>
      <p>
        Email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> from the email address on your account with:
      </p>
      <ul>
        <li>Your clinic name.</li>
        <li>The transaction ID (visible on your invoice).</li>
        <li>The reason for the refund request.</li>
      </ul>
      <p>
        We respond within 3 business days. Approved refunds are issued to the original payment method within
        7–10 business days depending on your bank.
      </p>

      <h2>6. Chargebacks</h2>
      <p>
        If you dispute a charge with your bank without contacting us first, your account may be suspended while
        we investigate. Please email us before raising a chargeback — most issues can be resolved quickly.
      </p>

      <h2>7. Contact</h2>
      <p>
        For any billing question: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>
    </LegalPage>
  );
}