/**
 * ClinicX Embeddable Booking Widget
 * https://clinicx.digiwil.com
 *
 * Easy 1-click appointment booking system for custom doctor websites.
 * Works seamlessly with WordPress, Webflow, Wix, Squarespace, and custom HTML/React websites.
 */
(function () {
  "use strict";

  // Prevent duplicate initialization
  if (window.__CLINICX_WIDGET_LOADED__) return;
  window.__CLINICX_WIDGET_LOADED__ = true;

  // Find the executing script tag to read configuration attributes
  var scripts = document.getElementsByTagName("script");
  var currentScript = document.currentScript || scripts[scripts.length - 1];

  // Resolve base URL from script source or default
  var scriptSrc = currentScript && currentScript.src ? currentScript.src : "";
  var defaultOrigin = "https://clinics.digiwil.com";
  var origin = defaultOrigin;
  try {
    if (scriptSrc) {
      var url = new URL(scriptSrc);
      origin = url.origin;
    }
  } catch (e) {
    origin = defaultOrigin;
  }

  // Configuration options
  var clinicSlug =
    (currentScript && currentScript.getAttribute("data-clinic")) ||
    window.CLINICX_CLINIC_SLUG ||
    "";
  var buttonText =
    (currentScript && currentScript.getAttribute("data-text")) ||
    window.CLINICX_BUTTON_TEXT ||
    "Book Appointment";
  var themeColor =
    (currentScript && currentScript.getAttribute("data-color")) ||
    window.CLINICX_THEME_COLOR ||
    "#059669";
  var position =
    (currentScript && currentScript.getAttribute("data-position")) ||
    window.CLINICX_POSITION ||
    "bottom-right";
  var mode =
    (currentScript && currentScript.getAttribute("data-mode")) ||
    window.CLINICX_MODE ||
    "popup"; // "popup" | "inline"

  if (!clinicSlug) {
    console.warn(
      "[ClinicX Widget] Missing 'data-clinic' attribute on script tag. E.g.: <script src='...' data-clinic='your-clinic-slug'></script>"
    );
  }

  var bookingUrl =
    origin +
    "/c/" +
    encodeURIComponent(clinicSlug) +
    "/book?embed=true&source=website_widget";

  // Inject Styles
  var style = document.createElement("style");
  style.id = "clinicx-widget-styles";
  style.innerHTML = [
    "/* ClinicX Floating Button */",
    ".clinicx-fab {",
    "  position: fixed;",
    "  bottom: 24px;",
    "  " + (position === "bottom-left" ? "left: 24px;" : "right: 24px;"),
    "  z-index: 999990;",
    "  display: inline-flex;",
    "  align-items: center;",
    "  gap: 10px;",
    "  padding: 14px 22px;",
    "  background-color: " + themeColor + ";",
    "  color: #ffffff;",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;",
    "  font-size: 15px;",
    "  font-weight: 600;",
    "  line-height: 1;",
    "  border: none;",
    "  border-radius: 9999px;",
    "  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2);",
    "  cursor: pointer;",
    "  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, background-color 0.2s ease;",
    "  text-decoration: none !important;",
    "  outline: none;",
    "  -webkit-tap-highlight-color: transparent;",
    "}",
    ".clinicx-fab:hover {",
    "  transform: translateY(-2px) scale(1.02);",
    "  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);",
    "}",
    ".clinicx-fab:active {",
    "  transform: translateY(0) scale(0.98);",
    "}",
    ".clinicx-fab-icon {",
    "  width: 18px;",
    "  height: 18px;",
    "  fill: none;",
    "  stroke: currentColor;",
    "  stroke-width: 2;",
    "  stroke-linecap: round;",
    "  stroke-linejoin: round;",
    "}",
    "/* Modal Backdrop & Container */",
    ".clinicx-modal-backdrop {",
    "  position: fixed;",
    "  inset: 0;",
    "  z-index: 999999;",
    "  background: rgba(15, 23, 42, 0.6);",
    "  backdrop-filter: blur(4px);",
    "  -webkit-backdrop-filter: blur(4px);",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  padding: 16px;",
    "  opacity: 0;",
    "  visibility: hidden;",
    "  transition: opacity 0.25s ease, visibility 0.25s ease;",
    "}",
    ".clinicx-modal-backdrop.clinicx-open {",
    "  opacity: 1;",
    "  visibility: visible;",
    "}",
    ".clinicx-modal-card {",
    "  position: relative;",
    "  width: 100%;",
    "  max-width: 580px;",
    "  height: 90vh;",
    "  max-height: 820px;",
    "  background: #ffffff;",
    "  border-radius: 20px;",
    "  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);",
    "  overflow: hidden;",
    "  display: flex;",
    "  flex-direction: column;",
    "  transform: scale(0.95) translateY(10px);",
    "  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);",
    "}",
    ".clinicx-modal-backdrop.clinicx-open .clinicx-modal-card {",
    "  transform: scale(1) translateY(0);",
    "}",
    ".clinicx-modal-header {",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: space-between;",
    "  padding: 14px 20px;",
    "  background: #f8fafc;",
    "  border-bottom: 1px solid #e2e8f0;",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
    "}",
    ".clinicx-modal-title {",
    "  font-size: 14px;",
    "  font-weight: 600;",
    "  color: #0f172a;",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 8px;",
    "}",
    ".clinicx-modal-close {",
    "  width: 32px;",
    "  height: 32px;",
    "  border-radius: 8px;",
    "  border: none;",
    "  background: transparent;",
    "  color: #64748b;",
    "  cursor: pointer;",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  font-size: 18px;",
    "  transition: background-color 0.15s ease, color 0.15s ease;",
    "}",
    ".clinicx-modal-close:hover {",
    "  background: #e2e8f0;",
    "  color: #0f172a;",
    "}",
    ".clinicx-iframe {",
    "  width: 100%;",
    "  height: 100%;",
    "  border: none;",
    "  flex: 1;",
    "  background: #ffffff;",
    "}",
    "/* Inline Container Embed */",
    ".clinicx-inline-iframe {",
    "  width: 100%;",
    "  min-height: 720px;",
    "  border: 1px solid #e2e8f0;",
    "  border-radius: 16px;",
    "  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);",
    "  background: #ffffff;",
    "}",
    "@media (max-width: 640px) {",
    "  .clinicx-fab {",
    "    bottom: 16px;",
    "    " + (position === "bottom-left" ? "left: 16px;" : "right: 16px;"),
    "    padding: 12px 18px;",
    "    font-size: 14px;",
    "  }",
    "  .clinicx-modal-backdrop {",
    "    padding: 0;",
    "  }",
    "  .clinicx-modal-card {",
    "    max-width: 100%;",
    "    height: 100vh;",
    "    max-height: 100vh;",
    "    border-radius: 0;",
    "  }",
    "}",
  ].join("\n");
  document.head.appendChild(style);

  // SVG Icons
  var calendarIconSvg =
    '<svg class="clinicx-fab-icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';
  var closeIconSvg =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  // Function to build and mount popup modal
  var modalBackdrop = null;
  var iframeElement = null;

  function createModal() {
    if (modalBackdrop) return;

    modalBackdrop = document.createElement("div");
    modalBackdrop.className = "clinicx-modal-backdrop";
    modalBackdrop.setAttribute("role", "dialog");
    modalBackdrop.setAttribute("aria-modal", "true");

    var card = document.createElement("div");
    card.className = "clinicx-modal-card";

    // Header
    var header = document.createElement("div");
    header.className = "clinicx-modal-header";

    var title = document.createElement("div");
    title.className = "clinicx-modal-title";
    title.innerHTML =
      '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' +
      themeColor +
      ';"></span> Online Appointment Booking';

    var closeBtn = document.createElement("button");
    closeBtn.className = "clinicx-modal-close";
    closeBtn.setAttribute("aria-label", "Close booking window");
    closeBtn.innerHTML = closeIconSvg;
    closeBtn.onclick = closeModal;

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Iframe
    iframeElement = document.createElement("iframe");
    iframeElement.className = "clinicx-iframe";
    iframeElement.setAttribute("title", "ClinicX Appointment Booking");
    iframeElement.setAttribute("allow", "payment; geolocation");

    card.appendChild(header);
    card.appendChild(iframeElement);
    modalBackdrop.appendChild(card);

    // Close on backdrop click
    modalBackdrop.onclick = function (e) {
      if (e.target === modalBackdrop) {
        closeModal();
      }
    };

    // Close on Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modalBackdrop.classList.contains("clinicx-open")) {
        closeModal();
      }
    });

    document.body.appendChild(modalBackdrop);
  }

  function openModal() {
    if (!modalBackdrop) {
      createModal();
    }
    // Lazy-load iframe source only on first open
    if (iframeElement && !iframeElement.src) {
      iframeElement.src = bookingUrl;
    }
    modalBackdrop.classList.add("clinicx-open");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove("clinicx-open");
    document.body.style.overflow = "";
  }

  // Handle inline embed if target exists
  var inlineContainer = document.getElementById("clinicx-booking-widget");
  if (inlineContainer || mode === "inline") {
    var target = inlineContainer || document.body;
    var inlineIframe = document.createElement("iframe");
    inlineIframe.className = "clinicx-inline-iframe";
    inlineIframe.src = bookingUrl;
    inlineIframe.setAttribute("title", "ClinicX Appointment Booking");
    inlineIframe.setAttribute("allow", "payment; geolocation");
    target.appendChild(inlineIframe);
  }

  // If popup mode, render floating button
  if (mode === "popup" || mode === "all") {
    var fab = document.createElement("button");
    fab.className = "clinicx-fab";
    fab.setAttribute("aria-label", buttonText);
    fab.innerHTML = calendarIconSvg + "<span>" + buttonText + "</span>";
    fab.onclick = openModal;
    document.body.appendChild(fab);
  }

  // Conversion Event listener: Forward confirmation events to host window
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "CLINICX_BOOKING_SUCCESS") {
      // Dispatch standard DOM event for GTM/Analytics tracking on doctor's website
      var customEvent = new CustomEvent("clinicx:booking_success", {
        detail: e.data,
      });
      window.dispatchEvent(customEvent);

      // Support Google Tag Manager dataLayer if installed
      if (window.dataLayer && typeof window.dataLayer.push === "function") {
        window.dataLayer.push({
          event: "clinicx_booking_completed",
          appointmentId: e.data.appointmentId,
          appointmentType: e.data.appointmentType,
        });
      }
    }
  });

  // Expose global controller
  window.ClinicXWidget = {
    open: openModal,
    close: closeModal,
    setUrl: function (newUrl) {
      bookingUrl = newUrl;
      if (iframeElement) iframeElement.src = newUrl;
    },
  };
})();
