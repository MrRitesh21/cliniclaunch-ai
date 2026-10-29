import React, { useState, useEffect } from "react";
import { Phone, MessageCircle, X, ChevronUp, Sparkles } from "lucide-react";
import type { SiteClinic } from "./types";
import { getClinicPhone, getClinicWhatsAppUrl, getClinicName } from "@/templates/shared/clinicDataHelpers";

interface UniversalFloatingContactProps {
  clinic: SiteClinic;
  themeColor?: string;
  customMessage?: string;
  showWhatsApp?: boolean;
  showCall?: boolean;
  hasStickyBar?: boolean;
  hideMobile?: boolean;
  className?: string;
}

export function UniversalFloatingContact({
  clinic,
  themeColor = "#2563eb",
  customMessage,
  showWhatsApp = true,
  showCall = true,
  hasStickyBar = false,
  hideMobile = false,
  className = "",
}: UniversalFloatingContactProps) {
  const [currentColor, setCurrentColor] = useState(themeColor);
  const [waVisible, setWaVisible] = useState(showWhatsApp);
  const [callVisible, setCallVisible] = useState(showCall);
  const [activeMessage, setActiveMessage] = useState(
    customMessage || `Hello ${getClinicName(clinic)}, I would like to inquire about booking an appointment.`
  );
  const [hoveredButton, setHoveredButton] = useState<"wa" | "call" | null>(null);

  useEffect(() => {
    setCurrentColor(themeColor);
  }, [themeColor]);

  // Sync with localStorage & customizer live events
  useEffect(() => {
    if (typeof window === "undefined" || !clinic?.slug) return;

    const loadSettings = () => {
      try {
        const storedColor = localStorage.getItem(`clinic_custom_color_${clinic.slug}`);
        if (storedColor) setCurrentColor(storedColor);

        const storedSettings = localStorage.getItem(`clinic_custom_settings_${clinic.slug}`);
        if (storedSettings) {
          const parsed = JSON.parse(storedSettings);
          if (typeof parsed.showWhatsApp === "boolean") setWaVisible(parsed.showWhatsApp);
          if (typeof parsed.showCall === "boolean") setCallVisible(parsed.showCall);
          if (parsed.whatsappMessage) setActiveMessage(parsed.whatsappMessage);
        }
      } catch {}
    };

    loadSettings();

    const handleCustomChange = (e: any) => {
      if (e?.detail) {
        if (e.detail.color) setCurrentColor(e.detail.color);
        if (typeof e.detail.showWhatsApp === "boolean") setWaVisible(e.detail.showWhatsApp);
        if (typeof e.detail.showCall === "boolean") setCallVisible(e.detail.showCall);
        if (e.detail.whatsappMessage) setActiveMessage(e.detail.whatsappMessage);
      }
    };

    window.addEventListener("clinic-customization-changed", handleCustomChange);
    return () => window.removeEventListener("clinic-customization-changed", handleCustomChange);
  }, [clinic?.slug]);

  const phone = getClinicPhone(clinic);
  const waUrl = getClinicWhatsAppUrl(clinic, activeMessage);

  const canShowCall = callVisible && Boolean(phone);
  const canShowWa = waVisible && Boolean(waUrl);

  // If no contact option is active or available, don't render
  if (!canShowCall && !canShowWa) return null;

  return (
    <div
      className={`z-40 pointer-events-none ${className}`}
      aria-label="Instant Contact Options"
    >
      {/* ─── DESKTOP FLOATING BUTTONS (>= 768px) ─────────────────────── */}
      <div className="hidden md:flex fixed bottom-6 right-6 flex-col items-end gap-3 pointer-events-auto">
        {/* Call Floating Action Button */}
        {canShowCall && (
          <div className="relative flex items-center group">
            {/* Hover Tooltip / Pill */}
            <div
              className={`absolute right-14 mr-2 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xl border border-white/10 whitespace-nowrap transition-all duration-200 pointer-events-none flex items-center gap-1.5 ${
                hoveredButton === "call" ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"
              }`}
            >
              <Phone className="size-3 text-sky-400" />
              <span>Call Clinic: {phone}</span>
            </div>

            <a
              href={`tel:${phone}`}
              onMouseEnter={() => setHoveredButton("call")}
              onMouseLeave={() => setHoveredButton(null)}
              className="size-12 rounded-full shadow-xl flex items-center justify-center text-white transition-all duration-300 hover:scale-110 active:scale-95 border-2 border-white/20"
              style={{ backgroundColor: currentColor }}
              aria-label={`Call ${clinic.doctor_name || "Clinic"}`}
              title={`Call ${phone}`}
            >
              <Phone className="size-5" />
            </a>
          </div>
        )}

        {/* WhatsApp Floating Action Button */}
        {canShowWa && (
          <div className="relative flex items-center group">
            {/* Live Status Badge */}
            <span className="absolute -top-1 -right-1 z-10 size-3.5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
              <span className="size-2 rounded-full bg-white animate-ping" />
            </span>

            {/* Hover Tooltip / Pill */}
            <div
              className={`absolute right-16 mr-2 px-3.5 py-2 rounded-2xl bg-[#075e54] text-white text-xs font-semibold shadow-2xl border border-emerald-400/30 whitespace-nowrap transition-all duration-200 pointer-events-none flex flex-col items-start ${
                hoveredButton === "wa" ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-400" />
                <span className="font-bold">Chat on WhatsApp</span>
              </div>
              <span className="text-[10px] text-emerald-200/90 font-normal">
                Online now · Quick appointment desk
              </span>
            </div>

            <a
              href={waUrl!}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={() => setHoveredButton("wa")}
              onMouseLeave={() => setHoveredButton(null)}
              className="size-14 rounded-full bg-[#25D366] hover:bg-[#20ba59] shadow-2xl flex items-center justify-center text-white transition-all duration-300 hover:scale-110 active:scale-95 border-2 border-white/30"
              aria-label="Chat with clinic on WhatsApp"
              title="Chat with clinic on WhatsApp"
            >
              {/* Official WhatsApp SVG Logo */}
              <svg
                viewBox="0 0 24 24"
                className="size-7 fill-white"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
            </a>
          </div>
        )}
      </div>

      {/* ─── MOBILE FLOATING BUTTONS (< 768px) ───────────────────────── */}
      {/* Positioned right above the bottom bar so it never blocks navigation */}
      {!hideMobile && (
        <div className={`md:hidden fixed ${hasStickyBar ? "bottom-20" : "bottom-6"} right-3.5 flex flex-col items-end gap-2.5 pointer-events-auto transform-gpu`}>
          {canShowCall && (
            <a
              href={`tel:${phone}`}
              className="size-11 rounded-full shadow-xl flex items-center justify-center text-white border-2 border-white/40 active:scale-95 transition-transform touch-manipulation"
              style={{ backgroundColor: currentColor }}
              aria-label="Call clinic"
            >
              <Phone className="size-5" />
            </a>
          )}
          {canShowWa && (
            <a
              href={waUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="size-12 rounded-full bg-[#25D366] active:bg-[#20ba59] shadow-xl flex items-center justify-center text-white border-2 border-white/40 active:scale-95 transition-transform touch-manipulation"
              aria-label="WhatsApp clinic"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-6 fill-white"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
