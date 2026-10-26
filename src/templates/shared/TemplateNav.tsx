import React from "react";
import type { TemplatePage, TemplatePalette } from "./types";

export const TEMPLATE_PAGES: Array<{ id: TemplatePage; label: string; shortLabel: string }> = [
  { id: "home", label: "Home", shortLabel: "Home" },
  { id: "about", label: "About Us", shortLabel: "About" },
  { id: "services", label: "Services", shortLabel: "Services" },
  { id: "book", label: "Book Appointment", shortLabel: "Book" },
  { id: "contact", label: "Contact & Location", shortLabel: "Contact" },
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
  return (
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
  );
}

interface TemplateFooterPagesProps {
  activePage: TemplatePage;
  onNavigate: (page: TemplatePage) => void;
  palette: TemplatePalette;
  headingText?: string;
}

export function TemplateFooterPages({
  activePage,
  onNavigate,
  palette,
  headingText = "Navigation",
}: TemplateFooterPagesProps) {
  return (
    <div className="space-y-3 text-left">
      <p className="text-xs font-bold uppercase tracking-wider opacity-60" style={{ color: palette.text }}>
        {headingText}
      </p>
      <ul className="space-y-2 text-xs">
        {TEMPLATE_PAGES.map((item) => {
          const isActive = activePage === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onNavigate(item.id)}
                className="hover:underline transition-all text-left"
                style={{
                  color: isActive ? palette.accent : palette.mutedText,
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
