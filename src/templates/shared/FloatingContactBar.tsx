import React from "react";
import { Phone, MessageCircle, Calendar, MapPin } from "lucide-react";
import type { SiteClinic } from "@/components/site/types";
import { getClinicPhone, getClinicWhatsAppUrl, getGoogleMapsUrl } from "./clinicDataHelpers";

interface FloatingContactBarProps {
  clinic: SiteClinic;
  onBookClick: () => void;
  primaryColor?: string;
}

export function FloatingContactBar({ clinic, onBookClick, primaryColor = "#2563eb" }: FloatingContactBarProps) {
  const phone = getClinicPhone(clinic);
  const waUrl = getClinicWhatsAppUrl(clinic);
  const mapsUrl = getGoogleMapsUrl(clinic);

  return (
    <div className="md:hidden fixed bottom-3 inset-x-3 z-40">
      <div className="bg-background/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-2xl p-2 flex items-center justify-between gap-1.5 ring-1 ring-black/5">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex-1 py-2 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl hover:bg-muted text-foreground transition-colors"
            aria-label="Call clinic"
          >
            <Phone className="size-4 text-primary" />
            <span className="text-[10px] font-medium">Call</span>
          </a>
        )}

        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl hover:bg-emerald-50 text-emerald-600 transition-colors"
            aria-label="Chat on WhatsApp"
          >
            <MessageCircle className="size-4" />
            <span className="text-[10px] font-medium">WhatsApp</span>
          </a>
        )}

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-2 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl hover:bg-muted text-foreground transition-colors"
          aria-label="Clinic Directions"
        >
          <MapPin className="size-4 text-rose-500" />
          <span className="text-[10px] font-medium">Directions</span>
        </a>

        <button
          type="button"
          onClick={onBookClick}
          className="flex-2 py-2.5 px-3 flex items-center justify-center gap-1.5 rounded-xl font-semibold text-xs text-white shadow-md active:scale-95 transition-all"
          style={{ backgroundColor: primaryColor }}
        >
          <Calendar className="size-3.5" />
          <span>Book Now</span>
        </button>
      </div>
    </div>
  );
}
