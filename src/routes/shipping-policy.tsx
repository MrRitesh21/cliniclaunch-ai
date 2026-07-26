import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, COMPANY } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/shipping-policy")({
  component: ShippingPage,
  head: () => ({
    meta: [
      { title: "Service Delivery Policy — ClinicX" },
      { name: "description", content: "How ClinicX delivers its digital subscription service." },
      { property: "og:title", content: "Service Delivery Policy — ClinicX" },
      {
        property: "og:description",
        content: "How ClinicX delivers its digital subscription service.",
      },
      { property: "og:url", content: "/shipping-policy" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/shipping-policy" }],
  }),
});

function ShippingPage() {
  return (
    <LegalPage title="Service Delivery Policy" updated="July 5, 2026">
      <p>
        {COMPANY.name} is a Software-as-a-Service platform. We do not ship any physical goods. This
        page exists to satisfy payment-gateway requirements and to describe how our digital service
        is delivered.
      </p>

      <h2>1. Digital delivery</h2>
      <ul>
        <li>
          Access to paid features is enabled <strong>immediately</strong> after your first
          successful payment.
        </li>
        <li>
          You will receive an email confirmation with the invoice within a few minutes of payment.
        </li>
        <li>
          If access is not enabled within 15 minutes, contact{" "}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> with your transaction ID.
        </li>
      </ul>

      <h2>2. Auto-pay renewals</h2>
      <p>
        Subscription plans renew automatically at the end of each billing cycle using the payment
        method you set up on Razorpay. You will receive an email reminder before each renewal.
      </p>

      <h2>3. No physical shipping</h2>
      <p>
        There are no shipping charges, delivery times, or shipping locations, because no physical
        goods are involved. All services are delivered over the internet to any location where{" "}
        {COMPANY.name} is available.
      </p>

      <h2>4. Availability</h2>
      <p>
        Our platform is available worldwide. However, payments are currently processed only in
        Indian Rupees (INR), and paid plans are available to customers with valid Indian payment
        instruments.
      </p>

      <h2>5. Contact</h2>
      <p>
        Questions about service delivery? Email{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>
    </LegalPage>
  );
}
