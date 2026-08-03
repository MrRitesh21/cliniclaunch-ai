import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, COMPANY } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — ClinicX" },
      { name: "description", content: "How ClinicX collects, uses, and protects your personal and clinical data." },
      { property: "og:title", content: "Privacy Policy — ClinicX" },
      { property: "og:description", content: "How ClinicX collects, uses, and protects your personal and clinical data." },
      { property: "og:url", content: "/privacy" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="July 5, 2026">
      <p>
        {COMPANY.name} ("we", "us", "our") is committed to protecting the privacy of doctors, clinic staff, and
        patients who use our platform. This Privacy Policy explains what information we collect, how we use it,
        and the choices you have. It is written in plain language for clarity.
      </p>

      <h2>1. Who we are</h2>
      <p>
        This service is operated by <strong>{COMPANY.legalName}</strong>, with registered address at
        {" "}{COMPANY.address}. You can contact us at <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>

      <h2>2. Information we collect</h2>
      <ul>
        <li><strong>Account data:</strong> name, email, phone, clinic name, specialization, and password (hashed).</li>
        <li><strong>Clinic content:</strong> services, timings, gallery images, staff, and public profile you publish.</li>
        <li><strong>Patient records:</strong> patient contact details, appointments, prescriptions, lab orders, and invoices you create.</li>
        <li><strong>Payment data:</strong> subscription plan, transaction status, and coupon usage. Card and UPI details are handled directly by Razorpay and never stored on our servers.</li>
        <li><strong>Usage data:</strong> log-in times, IP address, browser, and pages visited for security and analytics.</li>
        <li><strong>Communications:</strong> messages you send us for support.</li>
      </ul>

      <h2>3. How we use your information</h2>
      <ul>
        <li>To provide, maintain, and improve the ClinicX platform.</li>
        <li>To operate appointment booking, WhatsApp reminders, reviews, and other modules you enable.</li>
        <li>To process subscription payments and issue invoices.</li>
        <li>To detect abuse, prevent fraud, and enforce our Terms.</li>
        <li>To send transactional emails (billing, security, and product notifications).</li>
      </ul>

      <h2>4. Sharing with third parties</h2>
      <p>We share limited data only with the service providers that make ClinicX work:</p>
      <ul>
        <li><strong>Supabase</strong> — database and authentication hosting.</li>
        <li><strong>Razorpay</strong> — payment processing.</li>
        <li><strong>Resend</strong> — transactional email delivery.</li>
        <li><strong>Google Maps</strong> — clinic location and reviews.</li>
        <li><strong>WhatsApp Business</strong> — appointment messaging when you connect the module.</li>
      </ul>
      <p>We do not sell your data or your patients' data to anyone.</p>

      <h2>5. Data retention</h2>
      <p>
        We keep account and clinic data for as long as your account is active. If you delete your account,
        we remove personal data within 30 days, except where retention is required by law
        (e.g. tax records, transaction history for up to 8 years as required in {COMPANY.jurisdiction}).
      </p>

      <h2>6. Your rights</h2>
      <p>You can, at any time:</p>
      <ul>
        <li>Access, correct, or export the data in your account.</li>
        <li>Ask us to delete your account and associated data.</li>
        <li>Withdraw consent for optional communications.</li>
      </ul>
      <p>To exercise these rights, email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.</p>

      <h2>7. Security</h2>
      <p>
        Data is encrypted in transit (HTTPS/TLS) and at rest. Access is protected by role-based permissions
        and row-level security. Passwords are hashed with industry-standard algorithms. We follow least-privilege
        principles for internal access.
      </p>

      <h2>8. Cookies</h2>
      <p>
        We use only strictly necessary cookies for authentication and session management. We do not use
        third-party advertising cookies.
      </p>

      <h2>9. Children</h2>
      <p>
        ClinicX is intended for licensed medical practitioners and their authorised staff. It is not intended
        for use by anyone under 18. Patient records created for minors are the responsibility of the treating clinic.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this policy. Material changes will be notified via email or an in-app banner at least
        7 days before they take effect.
      </p>

      <h2>11. Contact</h2>
      <p>
        For privacy-related questions, write to <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        {" "}or {COMPANY.address}.
      </p>
    </LegalPage>
  );
}