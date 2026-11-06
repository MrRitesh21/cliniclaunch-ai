import React from "react";
import { Phone, MessageCircle, Calendar, MapPin } from "lucide-react";
import type { SiteClinic } from "@/components/site/types";
import { getClinicPhone, getClinicWhatsAppUrl, getGoogleMapsUrl } from "./clinicDataHelpers";

interface FloatingContactBarProps {
  clinic: SiteClinic;
  onBookClick?: () => void;
  onOpenBooking?: () => void;
  primaryColor?: string;
}

export function FloatingContactBar({ clinic, onBookClick, onOpenBooking, primaryColor = "#2563eb" }: FloatingContactBarProps) {
  const handleBook = onBookClick || onOpenBooking || (() => {});
  const phone = getClinicPhone(clinic);
  const waUrl = getClinicWhatsAppUrl(clinic);
  const mapsUrl = getGoogleMapsUrl(clinic);

  return (
    <div className="md:hidden fixed bottom-2 sm:bottom-3 inset-x-2 sm:inset-x-3 z-40 transform-gpu will-change-transform">
      <div
        className="bg-background/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-2xl p-1.5 sm:p-2 flex items-center justify-between gap-1 ring-1 ring-black/5"
        style={{
          paddingBottom: "max(0.45rem, env(safe-area-inset-bottom, 0.45rem))",
        }}
      >
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex-1 py-2 px-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl hover:bg-muted text-foreground transition-colors touch-manipulation"
            aria-label="Call clinic"
          >
            <Phone className="size-4" style={{ color: primaryColor }} />
            <span className="text-[10px] font-medium leading-none">Call</span>
          </a>
        )}

        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 px-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl hover:bg-emerald-50 text-emerald-600 transition-colors touch-manipulation"
            aria-label="Chat on WhatsApp"
          >
            <MessageCircle className="size-4" />
            <span className="text-[10px] font-medium leading-none">WhatsApp</span>
          </a>
        )}

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-2 px-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl hover:bg-muted text-foreground transition-colors touch-manipulation"
          aria-label="Clinic Directions"
        >
          <MapPin className="size-4 text-rose-500" />
          <span className="text-[10px] font-medium leading-none">Directions</span>
        </a>

        <button
          type="button"
          onClick={handleBook}
          className="flex-2 py-2 px-3 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl font-semibold text-xs text-white shadow-md active:scale-95 transition-all touch-manipulation"
          style={{ backgroundColor: primaryColor }}
        >
          <Calendar className="size-3.5 shrink-0" />
          <span className="truncate">Book Now</span>
        </button>
      </div>
    </div>
  );
}
