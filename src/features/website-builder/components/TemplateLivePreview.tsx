import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Live mini preview of the clinic's public website rendered with a specific
 * template preset (`?tpl=` + `?tc=`), scaled down to fit the card.
 *
 * The iframe only mounts once the card scrolls into view so a 40-template
 * marketplace doesn't spawn 40 simultaneous document loads.
 */
export function TemplateLivePreview({
  slug,
  templateId,
  themeColor,
  designWidth = 1280,
  designHeight = 1600,
  interactive = false,
  className = "",
}: {
  slug: string | null | undefined;
  templateId: string;
  themeColor: string;
  designWidth?: number;
  designHeight?: number;
  interactive?: boolean;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [scale, setScale] = useState(0.25);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / designWidth);
    });
    ro.observe(el);
    setScale(el.clientWidth / designWidth || 0.25);

    return () => {
      io.disconnect();
      ro.disconnect();
    };
  }, [designWidth]);

  const src = slug
    ? `/c/${slug}?tpl=${encodeURIComponent(templateId)}&tc=${encodeURIComponent(themeColor)}`
    : null;

  return (
    <div ref={hostRef} className={`relative overflow-hidden bg-muted/40 ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      )}

      {visible && src && (
        <iframe
          src={src}
          title={`Preview of ${templateId}`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          tabIndex={-1}
          sandbox="allow-same-origin allow-scripts"
          className="border-0 origin-top-left"
          style={{
            width: designWidth,
            height: designHeight,
            transform: `scale(${scale})`,
            pointerEvents: interactive ? "auto" : "none",
          }}
        />
      )}

      {!slug && (
        <div className="absolute inset-0 grid place-items-center text-[10px] text-muted-foreground px-3 text-center">
          Publish your clinic profile to see live previews
        </div>
      )}
    </div>
  );
}
