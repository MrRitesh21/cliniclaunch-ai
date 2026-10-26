/**
 * ClinicX Embeddable Booking Widget
 * https://clinicx.digiwil.com
 *
 * Easy 1-click appointment booking system for custom doctor websites.
 * Works seamlessly with WordPress, Webflow, Wix, Squarespace, and custom HTML/React websites.
 * Fully customizable: button text, colors, positions, sizes, shapes, animations, and form fields.
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

  // --- BUTTON CUSTOMIZATION ATTRIBUTES ---
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
  var textColor =
    (currentScript && currentScript.getAttribute("data-text-color")) ||
    window.CLINICX_TEXT_COLOR ||
    "#ffffff";
  var position =
    (currentScript && currentScript.getAttribute("data-position")) ||
    window.CLINICX_POSITION ||
    "bottom-right";
  var buttonSize =
    (currentScript && currentScript.getAttribute("data-size")) ||
    window.CLINICX_SIZE ||
    "md"; // "sm" | "md" | "lg"
  var buttonRadius =
    (currentScript && currentScript.getAttribute("data-radius")) ||
    window.CLINICX_RADIUS ||
    "pill"; // "pill" | "rounded" | "soft" | "sharp"
  var iconType =
    (currentScript && currentScript.getAttribute("data-icon")) ||
    window.CLINICX_ICON ||
    "calendar"; // "calendar" | "stethoscope" | "clock" | "message" | "sparkles" | "none"
  var animation =
    (currentScript && currentScript.getAttribute("data-animation")) ||
    window.CLINICX_ANIMATION ||
    "none"; // "none" | "pulse" | "bounce" | "glow"
  var mode =
    (currentScript && currentScript.getAttribute("data-mode")) ||
    window.CLINICX_MODE ||
    "popup"; // "popup" | "inline" | "all"

  // --- FORM / MODAL CUSTOMIZATION ATTRIBUTES ---
  var formTitle =
    (currentScript && currentScript.getAttribute("data-title")) ||
    window.CLINICX_TITLE ||
    "";
  var formSubtitle =
    (currentScript && currentScript.getAttribute("data-subtitle")) ||
    window.CLINICX_SUBTITLE ||
    "";
  var formColor =
    (currentScript && currentScript.getAttribute("data-form-color")) ||
    window.CLINICX_FORM_COLOR ||
    themeColor;
  var apptType =
    (currentScript && currentScript.getAttribute("data-type")) ||
    window.CLINICX_TYPE ||
    "both"; // "both" | "offline" | "online"
  var modalRadius =
    (currentScript && currentScript.getAttribute("data-form-radius")) ||
    window.CLINICX_FORM_RADIUS ||
    "20px";

  if (!clinicSlug) {
    console.warn(
      "[ClinicX Widget] Missing 'data-clinic' attribute on script tag. E.g.: <script src='...' data-clinic='your-clinic-slug'></script>"
    );
  }

  // Construct iframe booking URL with all customization query params
  var queryParts = [
    "embed=true",
    "source=website_widget"
  ];
  if (formTitle) queryParts.push("title=" + encodeURIComponent(formTitle));
  if (formSubtitle) queryParts.push("subtitle=" + encodeURIComponent(formSubtitle));
  if (formColor) queryParts.push("color=" + encodeURIComponent(formColor));
  if (apptType && apptType !== "both") queryParts.push("type=" + encodeURIComponent(apptType));

  var bookingUrl =
    origin +
    "/c/" +
    encodeURIComponent(clinicSlug) +
    "/book?" +
    queryParts.join("&");

  // Size style mappings
  var sizeStyles = {
    sm: { padding: "10px 16px", fontSize: "13px", iconSize: "15px", gap: "7px" },
    md: { padding: "13px 22px", fontSize: "15px", iconSize: "18px", gap: "9px" },
    lg: { padding: "16px 28px", fontSize: "16px", iconSize: "20px", gap: "10px" }
  };
  var currentSize = sizeStyles[buttonSize] || sizeStyles.md;

  // Radius mappings
  var radiusStyles = {
    pill: "9999px",
    rounded: "14px",
    soft: "8px",
    sharp: "0px"
  };
  var currentRadius = radiusStyles[buttonRadius] || radiusStyles.pill;

  // Position coordinates
  var posStyle = "";
  if (position === "bottom-left") {
    posStyle = "bottom: 24px; left: 24px;";
  } else if (position === "bottom-center") {
    posStyle = "bottom: 24px; left: 50%; transform: translateX(-50%);";
  } else if (position === "top-right") {
    posStyle = "top: 24px; right: 24px;";
  } else if (position === "top-left") {
    posStyle = "top: 24px; left: 24px;";
  } else {
    posStyle = "bottom: 24px; right: 24px;"; // default bottom-right
  }

  // Animation CSS
  var animationCss = "";
  if (animation === "pulse") {
    animationCss = "animation: clinicx-pulse 2.2s infinite ease-in-out;";
  } else if (animation === "bounce") {
    animationCss = "animation: clinicx-float 3s infinite ease-in-out;";
  } else if (animation === "glow") {
    animationCss = "animation: clinicx-glow 2s infinite ease-in-out;";
  }

  // Inject Styles
  var style = document.createElement("style");
  style.id = "clinicx-widget-styles";
  style.innerHTML = [
    "/* ClinicX Animations */",
    "@keyframes clinicx-pulse {",
    "  0%, 100% { transform: scale(1); }",
    "  50% { transform: scale(1.05); }",
    "}",
    "@keyframes clinicx-float {",
    "  0%, 100% { transform: translateY(0); }",
    "  50% { transform: translateY(-7px); }",
    "}",
    "@keyframes clinicx-glow {",
    "  0%, 100% { box-shadow: 0 0 10px " + themeColor + "66, 0 8px 20px rgba(0,0,0,0.15); }",
    "  50% { box-shadow: 0 0 25px " + themeColor + "bb, 0 12px 25px rgba(0,0,0,0.25); }",
    "}",
    "/* ClinicX Floating Button */",
    ".clinicx-fab {",
    "  position: fixed;",
    "  " + posStyle,
    "  z-index: 999990;",
    "  display: inline-flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  gap: " + currentSize.gap + ";",
    "  padding: " + currentSize.padding + ";",
    "  background-color: " + themeColor + ";",
    "  color: " + textColor + ";",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;",
    "  font-size: " + currentSize.fontSize + ";",
    "  font-weight: 600;",
    "  line-height: 1;",
    "  border: none;",
    "  border-radius: " + currentRadius + ";",
    "  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2);",
    "  cursor: pointer;",
    "  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, filter 0.2s ease;",
    "  text-decoration: none !important;",
    "  outline: none;",
    "  -webkit-tap-highlight-color: transparent;",
    "  " + animationCss,
    "}",
    ".clinicx-fab:hover {",
    "  filter: brightness(1.08);",
    "  transform: translateY(-2px) scale(1.02);",
    "  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);",
    "}",
    ".clinicx-fab:active {",
    "  transform: translateY(0) scale(0.98);",
    "}",
    ".clinicx-fab-icon {",
    "  width: " + currentSize.iconSize + ";",
    "  height: " + currentSize.iconSize + ";",
    "  fill: none;",
    "  stroke: currentColor;",
    "  stroke-width: 2;",
    "  stroke-linecap: round;",
    "  stroke-linejoin: round;",
    "  flex-shrink: 0;",
    "}",
    "/* Modal Backdrop & Container */",
    ".clinicx-modal-backdrop {",
    "  position: fixed;",
    "  inset: 0;",
    "  z-index: 999999;",
    "  background: rgba(15, 23, 42, 0.65);",
    "  backdrop-filter: blur(5px);",
    "  -webkit-backdrop-filter: blur(5px);",
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
    "  max-width: 600px;",
    "  height: 90vh;",
    "  max-height: 840px;",
    "  background: #ffffff;",
    "  border-radius: " + modalRadius + ";",
    "  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);",
    "  overflow: hidden;",
    "  display: flex;",
    "  flex-direction: column;",
    "  transform: scale(0.96) translateY(12px);",
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
    "  border-radius: " + modalRadius + ";",
    "  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);",
    "  background: #ffffff;",
    "}",
    "@media (max-width: 640px) {",
    "  .clinicx-fab {",
    "    bottom: 16px;",
    "    " + (position.includes("left") ? "left: 16px;" : position === "bottom-center" ? "left: 50%; transform: translateX(-50%);" : "right: 16px;"),
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
  var icons = {
    calendar:
      '<svg class="clinicx-fab-icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    stethoscope:
      '<svg class="clinicx-fab-icon" viewBox="0 0 24 24"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"></path><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"></path><circle cx="20" cy="10" r="2"></circle></svg>',
    clock:
      '<svg class="clinicx-fab-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    message:
      '<svg class="clinicx-fab-icon" viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path></svg>',
    sparkles:
      '<svg class="clinicx-fab-icon" viewBox="0 0 24 24"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>',
    none: ""
  };
  var chosenIconSvg = icons[iconType] !== undefined ? icons[iconType] : icons.calendar;

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
      ';"></span> ' +
      (formTitle || "Online Appointment Booking");

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
    iframeElement.setAttribute("title", formTitle || "ClinicX Appointment Booking");
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

  // Handle inline embed if target container exists
  var inlineContainer = document.getElementById("clinicx-booking-widget");
  if (inlineContainer || mode === "inline") {
    var target = inlineContainer || document.body;
    var inlineIframe = document.createElement("iframe");
    inlineIframe.className = "clinicx-inline-iframe";
    inlineIframe.src = bookingUrl;
    inlineIframe.setAttribute("title", formTitle || "ClinicX Appointment Booking");
    inlineIframe.setAttribute("allow", "payment; geolocation");
    target.appendChild(inlineIframe);
  }

  // If popup mode, render floating button
  if (mode === "popup" || mode === "all") {
    var fab = document.createElement("button");
    fab.className = "clinicx-fab";
    fab.setAttribute("aria-label", buttonText);
    fab.innerHTML = (chosenIconSvg ? chosenIconSvg : "") + "<span>" + buttonText + "</span>";
    fab.onclick = openModal;
    document.body.appendChild(fab);
  }

  // --- NATIVE CUSTOM FORM AUTO-BINDER (NO IFRAME) ---
  // Doctors can use their own custom website theme and design!
  // Any form with id="clinicx-booking-form", class="clinicx-form", or data-clinicx-form
  // will automatically submit leads and appointments to ClinicX via AJAX.
  function bindCustomForms() {
    var forms = document.querySelectorAll(
      "#clinicx-booking-form, form.clinicx-form, form[data-clinicx-form]"
    );
    forms.forEach(function (form) {
      if (form.getAttribute("data-clinicx-bound")) return;
      form.setAttribute("data-clinicx-bound", "true");

      form.addEventListener("submit", function (e) {
        e.preventDefault();

        var submitBtn = form.querySelector("button[type='submit'], input[type='submit']");
        var originalBtnText = submitBtn ? submitBtn.innerHTML : "";
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = "Submitting...";
        }

        var formData = new FormData(form);
        var data = {
          clinic: form.getAttribute("data-clinic") || clinicSlug,
        };
        formData.forEach(function (value, key) {
          data[key] = value;
        });

        fetch(origin + "/api/public/submit-booking", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(data),
        })
          .then(function (res) {
            return res.json();
          })
          .then(function (result) {
            if (result.success) {
              var redirect = form.getAttribute("data-redirect");
              if (redirect) {
                window.location.href = redirect;
                return;
              }

              var successMsg = document.createElement("div");
              successMsg.className = "clinicx-form-success";
              successMsg.style.cssText =
                "padding: 16px; border-radius: 12px; background: #ecfdf5; border: 1px solid #10b981; color: #065f46; font-size: 14px; text-align: center; margin-top: 14px; font-weight: 500; font-family: inherit;";
              successMsg.innerHTML =
                "✓ " +
                (form.getAttribute("data-success-message") ||
                  "Appointment request submitted successfully! Clinic will confirm shortly.");

              form.innerHTML = "";
              form.appendChild(successMsg);

              // Dispatch success event
              window.dispatchEvent(
                new CustomEvent("clinicx:booking_success", { detail: result })
              );
            } else {
              alert(result.error || "Failed to submit booking. Please try again.");
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
              }
            }
          })
          .catch(function () {
            alert("Network error: Could not reach ClinicX server.");
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = originalBtnText;
            }
          });
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindCustomForms);
  } else {
    bindCustomForms();
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
  window.ClinicX = {
    submit: function (data) {
      if (!data.clinic) data.clinic = clinicSlug;
      return fetch(origin + "/api/public/submit-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(data),
      }).then(function (r) {
        return r.json();
      });
    },
    open: openModal,
    close: closeModal,
  };

  window.ClinicXWidget = window.ClinicX;
})();
