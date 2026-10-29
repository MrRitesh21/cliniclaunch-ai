import React, { useState, useEffect } from "react";
import {
  Menu,
  X,
  Home,
  User,
  Stethoscope,
  Calendar,
  MapPin,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { TemplatePage, TemplatePalette } from "./types";
import { DpdpNoticeModal } from "@/components/clinic/DpdpCompliance";
import { cn } from "@/lib/utils";

export const TEMPLATE_PAGES: Array<{
  id: TemplatePage;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "home", label: "Home", shortLabel: "Home", icon: Home },
  { id: "about", label: "About Us", shortLabel: "About", icon: User },
  { id: "services", label: "Services", shortLabel: "Services", icon: Stethoscope },
  { id: "book", label: "Book Appointment", shortLabel: "Book", icon: Calendar },
  { id: "contact", label: "Contact & Location", shortLabel: "Contact", icon: MapPin },
];

interface TemplateNavLinksProps {
  activePage: TemplatePage;
  onNavigate: (page: TemplatePage) => void;
  palette: TemplatePalette;
  className?: string;
  linkClassName?: string;
  showAll?: boolean;
}

export function TemplateNavLinks({
  activePage,
  onNavigate,
  palette,
  className = "hidden md:flex items-center gap-6 text-xs font-semibold uppercase tracking-wider",
  linkClassName = "py-1 transition-all relative group",
}: TemplateNavLinksProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on escape key and lock body scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };

    if (mobileMenuOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const handleMobileNavigate = (page: TemplatePage) => {
    setMobileMenuOpen(false);
    onNavigate(page);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <>
      {/* ─── DESKTOP NAVIGATION (>= 768px) ────────────────────────── */}
      <nav className={className}>
        {TEMPLATE_PAGES.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`${linkClassName} ${isActive ? "font-bold" : "opacity-80 hover:opacity-100"}`}
              style={{ color: isActive ? palette.primary : palette.text }}
            >
              <span>{item.label}</span>
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ backgroundColor: palette.accent || palette.primary }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* ─── MOBILE HAMBURGER BUTTON (< 768px) ────────────────────── */}
      <div className="flex md:hidden items-center order-last">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="size-10 rounded-xl flex items-center justify-center border shadow-xs transition-all active:scale-95 touch-manipulation"
          style={{
            borderColor: palette.border || "rgba(0,0,0,0.12)",
            backgroundColor: palette.surface || "#ffffff",
            color: palette.text || "#1e293b",
          }}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* ─── MOBILE DRAWER OVERLAY ─────────────────────────────────── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-200"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.55)", backdropFilter: "blur(4px)" }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="absolute top-0 right-0 w-[84vw] max-w-xs sm:max-w-sm h-full shadow-2xl flex flex-col justify-between p-5 sm:p-6 overflow-y-auto animate-in slide-in-from-right duration-250 border-l"
            style={{
              backgroundColor: palette.surface || "#ffffff",
              borderColor: palette.border || "rgba(0,0,0,0.1)",
              color: palette.text || "#1e293b",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Top Header */}
            <div
              className="flex items-center justify-between pb-4 border-b"
              style={{ borderColor: palette.border || "rgba(0,0,0,0.1)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: palette.primary }}
                />
                <span className="text-xs font-bold uppercase tracking-wider opacity-75">
                  Navigation
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="size-9 rounded-full border grid place-items-center opacity-80 hover:opacity-100 active:scale-95 transition-all touch-manipulation"
                style={{ borderColor: palette.border || "rgba(0,0,0,0.1)" }}
                aria-label="Close menu"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Navigation Links List */}
            <div className="py-5 space-y-1.5 flex-1">
              {TEMPLATE_PAGES.map((item) => {
                const isActive = activePage === item.id;
                const IconComp = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleMobileNavigate(item.id)}
                    className="w-full min-h-[46px] flex items-center justify-between p-3 rounded-2xl text-left font-medium text-sm transition-all active:scale-[0.98] touch-manipulation"
                    style={{
                      backgroundColor: isActive ? `${palette.primary}15` : "transparent",
                      color: isActive ? palette.primary : palette.text,
                      fontWeight: isActive ? 700 : 500,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="size-8 rounded-xl grid place-items-center text-xs transition-colors shrink-0"
                        style={{
                          backgroundColor: isActive ? palette.primary : `${palette.primary}12`,
                          color: isActive ? "#ffffff" : palette.primary,
                        }}
                      >
                        <IconComp className="size-4" />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>
                    {isActive ? (
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: palette.primary }}
                      />
                    ) : (
                      <ChevronRight className="size-4 opacity-40 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bottom Quick Action CTA */}
            <div
              className="pt-4 border-t space-y-2.5"
              style={{ borderColor: palette.border || "rgba(0,0,0,0.1)" }}
            >
              <button
                type="button"
                onClick={() => handleMobileNavigate("book")}
                className="w-full min-h-[46px] py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-md flex items-center justify-center gap-2 active:scale-98 transition-transform touch-manipulation"
                style={{ backgroundColor: palette.primary }}
              >
                <Calendar className="size-4" />
                <span>Book Appointment</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export interface TemplateFooterPagesProps {
  activePage: TemplatePage;
  onNavigate: (page: TemplatePage) => void;
  palette?: TemplatePalette;
  headingText?: string;
  layout?: "row" | "column" | "auto";
  dark?: boolean;
  className?: string;
}

export function TemplateFooterPages({
  activePage,
  onNavigate,
  palette,
  headingText,
  layout,
  dark = true,
  className,
}: TemplateFooterPagesProps) {
  const [showDpdp, setShowDpdp] = useState(false);
  const isColumn = layout === "column" || (layout !== "row" && Boolean(headingText));
  const isDark = dark ?? true;

  return (
    <>
      {isColumn ? (
        <div className={cn("space-y-3 text-left", className)}>
          {headingText && (
            <p
              className={cn(
                "text-xs font-bold uppercase tracking-wider",
                isDark ? "text-white/80" : "text-stone-800"
              )}
            >
              {headingText}
            </p>
          )}
          <ul className="space-y-1.5 text-xs">
            {TEMPLATE_PAGES.map((item) => {
              const isActive = activePage === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate(item.id);
                      if (typeof window !== "undefined") {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    className={cn(
                      "min-h-[32px] py-1 transition-colors text-left flex items-center touch-manipulation font-medium",
                      isDark
                        ? (isActive ? "text-white font-bold underline underline-offset-4 decoration-2" : "text-white/75 hover:text-white hover:underline")
                        : (isActive ? "text-stone-950 font-bold underline underline-offset-4 decoration-2" : "text-stone-600 hover:text-stone-900 hover:underline")
                    )}
                    style={{
                      color: isActive ? (palette?.accent || (isDark ? "#ffffff" : "#18181b")) : undefined,
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
            <li className={cn("pt-2 mt-2 border-t", isDark ? "border-white/10" : "border-stone-200")}>
              <button
                type="button"
                onClick={() => setShowDpdp(true)}
                className={cn(
                  "inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors py-1 touch-manipulation",
                  isDark ? "text-emerald-400 hover:text-emerald-300" : "text-emerald-700 hover:text-emerald-800"
                )}
              >
                <ShieldCheck className="size-3.5" />
                <span>DPDP Act 2023 Compliant</span>
              </button>
            </li>
          </ul>
        </div>
      ) : (
        <div
          className={cn(
            "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col sm:flex-row items-center justify-between gap-4 text-xs",
            className
          )}
        >
          <nav
            aria-label="Footer Page Navigation"
            className="flex flex-wrap items-center justify-center sm:justify-start gap-x-6 gap-y-2"
          >
            {TEMPLATE_PAGES.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    if (typeof window !== "undefined") {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  className={cn(
                    "min-h-[32px] py-1 transition-colors text-left inline-flex items-center touch-manipulation font-medium",
                    isDark
                      ? (isActive ? "text-white font-bold underline underline-offset-4 decoration-2" : "text-white/75 hover:text-white hover:underline")
                      : (isActive ? "text-stone-950 font-bold underline underline-offset-4 decoration-2" : "text-stone-600 hover:text-stone-900 hover:underline")
                  )}
                  style={{
                    color: isActive ? (palette?.accent || (isDark ? "#ffffff" : "#18181b")) : undefined,
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowDpdp(true)}
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-semibold transition-all py-1 px-3 rounded-full border touch-manipulation shadow-sm",
                isDark
                  ? "text-emerald-400 hover:text-emerald-300 border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-900/50"
                  : "text-emerald-700 hover:text-emerald-800 border-emerald-600/30 bg-emerald-50 hover:bg-emerald-100"
              )}
            >
              <ShieldCheck className="size-3.5" />
              <span>DPDP Act 2023 Compliant</span>
            </button>
          </div>
        </div>
      )}

      <DpdpNoticeModal isOpen={showDpdp} onClose={() => setShowDpdp(false)} />
    </>
  );
}
