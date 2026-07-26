import { strList, type SiteClinic } from "./types";

type Props = { clinic: SiteClinic };

/** Uniform grid */
export function GalleryGrid({ clinic }: Props) {
  const gallery = strList(clinic.gallery);
  if (gallery.length === 0) return null;
  return (
    <section className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
      <div className="text-center mb-10">
        <p className="text-xs uppercase tracking-[0.18em] text-primary font-medium">Inside the clinic</p>
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl mt-2">A space designed for healing</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {gallery.slice(0, 6).map((url, i) => (
          <div key={url} className="aspect-square rounded-2xl overflow-hidden bg-muted">
            <img src={url} alt={`Clinic ${i + 1}`} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition duration-700" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Masonry-ish hero + grid */
export function GalleryMasonry({ clinic }: Props) {
  const gallery = strList(clinic.gallery);
  if (gallery.length === 0) return null;
  return (
    <section className="bg-surface border-y">
      <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
        <div className="grid grid-cols-12 gap-3">
          {gallery.slice(0, 5).map((url, i) => (
            <div key={url} className={`overflow-hidden rounded-2xl ${[
              "col-span-12 md:col-span-7 aspect-[4/3]",
              "col-span-6 md:col-span-5 aspect-square",
              "col-span-6 md:col-span-4 aspect-square",
              "col-span-12 md:col-span-4 aspect-[4/3]",
              "col-span-12 md:col-span-4 aspect-[4/3]",
            ][i] || "col-span-6 aspect-square"}`}>
              <img src={url} alt={`Clinic ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Horizontal scrolling row */
export function GalleryCarousel({ clinic }: Props) {
  const gallery = strList(clinic.gallery);
  if (gallery.length === 0) return null;
  return (
    <section className="py-12 sm:py-16">
      <div className="max-w-6xl mx-auto px-4 mb-8">
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl">Our clinic</h2>
      </div>
      <div className="overflow-x-auto scroll-smooth snap-x snap-mandatory">
        <div className="flex gap-4 px-4 pb-4 max-w-full">
          {gallery.map((url, i) => (
            <div key={url} className="shrink-0 w-[78vw] sm:w-[280px] md:w-[420px] aspect-[4/3] rounded-2xl overflow-hidden bg-muted snap-start">
              <img src={url} alt={`Clinic ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const GalleryVariants = {
  grid: GalleryGrid,
  masonry: GalleryMasonry,
  carousel: GalleryCarousel,
} as const;

export const GalleryMeta = {
  key: "gallery" as const,
  label: "Gallery",
  defaultId: "grid",
  options: [
    { id: "grid", label: "Uniform grid", description: "Equal square tiles" },
    { id: "masonry", label: "Mosaic", description: "Asymmetric featured layout" },
    { id: "carousel", label: "Carousel", description: "Horizontal scroll row" },
  ],
};
