import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { gsap } from "gsap";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  CreditCard,
  LayoutDashboard,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReducedMotion } from "@/components/landing/LandingMotion";

type DemoProject = {
  id: string;
  title: string;
  detail: string;
  status: string;
  icon: LucideIcon;
  tone: "blue" | "emerald";
};

const STARTER_PROJECTS: DemoProject[] = [
  {
    id: "clinic-profile",
    title: "Clinic profile",
    detail: "Hours, services & contact details",
    status: "Sample project",
    icon: Building2,
    tone: "blue",
  },
  {
    id: "online-booking",
    title: "Patient booking page",
    detail: "Appointments, ready to configure",
    status: "Sample project",
    icon: CalendarDays,
    tone: "emerald",
  },
];

const DEMO_PROJECT_NAME = "My clinic website";

function getTargetPoint(target: HTMLElement | null, root: HTMLElement | null, offset = 0) {
  if (!target || !root) return { x: 0, y: 0 };
  const targetRect = target.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  return {
    x: targetRect.left - rootRect.left + targetRect.width / 2 - offset,
    y: targetRect.top - rootRect.top + targetRect.height / 2 - offset,
  };
}

export function HeroProductDemo() {
  const reducedMotion = useReducedMotion();
  const dialogTitleId = `clinic-site-dialog-${useId().replace(/:/g, "")}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const newProjectRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<SVGSVGElement>(null);
  const rippleRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const autoplayRunningRef = useRef(false);
  const automatedActionRef = useRef(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [createdProject, setCreatedProject] = useState<DemoProject | null>(null);
  const [activeNav, setActiveNav] = useState("Clinic sites");
  const [isPaused, setIsPaused] = useState(true);

  const stopAutoplay = useCallback(() => {
    autoplayRunningRef.current = false;
    timelineRef.current?.kill();
    timelineRef.current = null;
    setIsPaused(true);
  }, []);

  const openDialog = useCallback(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDraftName("");
    setIsDialogOpen(true);
    if (modalRef.current) {
      gsap.set(modalRef.current, { display: "grid", autoAlpha: 0, scale: 0.97 });
      gsap.to(modalRef.current, {
        autoAlpha: 1,
        scale: 1,
        duration: reducedMotion ? 0 : 0.22,
        ease: "power2.out",
      });
    }
    automatedActionRef.current = true;
    inputRef.current?.focus({ preventScroll: true });
    automatedActionRef.current = false;
  }, [reducedMotion]);

  const closeDialog = useCallback(
    (restoreFocus = true) => {
      setIsDialogOpen(false);
      const modal = modalRef.current;
      const hide = () => {
        if (modal) gsap.set(modal, { display: "none", autoAlpha: 0, scale: 0.98 });
        if (restoreFocus) {
          const target = previousFocusRef.current ?? ctaRef.current;
          target?.focus({ preventScroll: true });
        }
      };
      if (modal && !reducedMotion) {
        gsap.to(modal, {
          autoAlpha: 0,
          scale: 0.98,
          duration: 0.16,
          ease: "power1.in",
          onComplete: hide,
        });
      } else {
        hide();
      }
    },
    [reducedMotion],
  );

  const handleCreate = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const isAutoplayAction = autoplayRunningRef.current && automatedActionRef.current;
      if (event.nativeEvent.isTrusted && !automatedActionRef.current && autoplayRunningRef.current)
        stopAutoplay();
      const title = inputRef.current?.value.trim() || DEMO_PROJECT_NAME;
      setCreatedProject({
        id: `clinic-site-${Date.now()}`,
        title,
        detail: "Your clinic site is ready to customize",
        status: "New sample project",
        icon: Building2,
        tone: "blue",
      });
      if (!isAutoplayAction && !reducedMotion) {
        requestAnimationFrame(() => {
          const card = newProjectRef.current;
          if (card)
            gsap.fromTo(
              card,
              { autoAlpha: 0, scale: 0.84, y: 12 },
              { autoAlpha: 1, scale: 1, y: 0, duration: 0.58, ease: "back.out(1.7)" },
            );
        });
      }
      closeDialog();
    },
    [closeDialog, reducedMotion, stopAutoplay],
  );

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isTrusted && !automatedActionRef.current && autoplayRunningRef.current)
      stopAutoplay();
    setDraftName(event.target.value);
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !modalRef.current) return;
    const focusable = Array.from(
      modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleUserClick = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    if (event.nativeEvent.isTrusted && !automatedActionRef.current && autoplayRunningRef.current)
      stopAutoplay();
    action();
  };

  const resetDemo = useCallback(() => {
    setDraftName("");
    setIsDialogOpen(false);
    setCreatedProject(null);
    if (modalRef.current)
      gsap.set(modalRef.current, { display: "none", autoAlpha: 0, scale: 0.98 });
    if (newProjectRef.current)
      gsap.set(newProjectRef.current, { display: "none", autoAlpha: 0, scale: 0.84, y: 10 });
    if (rippleRef.current) gsap.set(rippleRef.current, { autoAlpha: 0, scale: 0.25 });
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const cursor = cursorRef.current;
    const ripple = rippleRef.current;
    const modal = modalRef.current;
    const newProject = newProjectRef.current;
    const prefersReducedMotion =
      reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!root || !cursor || !ripple || !modal || !newProject || prefersReducedMotion) {
      if (cursor) gsap.set(cursor, { autoAlpha: 0 });
      if (ripple) gsap.set(ripple, { autoAlpha: 0 });
      if (modal) gsap.set(modal, { display: "none", autoAlpha: 0 });
      return;
    }

    const pointFor = (target: HTMLElement | null, offset = 0) =>
      getTargetPoint(target, root, offset);
    const typing = { value: 0 };
    const timeline = gsap.timeline({
      paused: true,
      repeat: -1,
      repeatDelay: 1.5,
      repeatRefresh: true,
      onRepeat: resetDemo,
    });

    timeline.call(resetDemo, [], 0);
    timeline.set(
      cursor,
      {
        autoAlpha: 0,
        x: () => Math.max(12, root.clientWidth - 30),
        y: () => Math.max(12, root.clientHeight - 30),
      },
      0,
    );
    timeline.set(ripple, { autoAlpha: 0, scale: 0.25 }, 0);
    timeline.to(cursor, { autoAlpha: 1, duration: 0.16 }, 0.08);
    timeline.to(
      cursor,
      {
        x: () => pointFor(ctaRef.current, 2).x,
        y: () => pointFor(ctaRef.current, 1).y,
        duration: 0.82,
        ease: "power2.inOut",
      },
      0.22,
    );
    timeline.fromTo(
      ripple,
      {
        x: () => pointFor(ctaRef.current, 18).x,
        y: () => pointFor(ctaRef.current, 18).y,
        autoAlpha: 0.85,
        scale: 0.25,
      },
      { autoAlpha: 0, scale: 1.7, duration: 0.38, ease: "power2.out" },
      ">",
    );
    timeline.call(() => {
      automatedActionRef.current = true;
      ctaRef.current?.click();
      automatedActionRef.current = false;
    });
    timeline.to({}, { duration: 0.3 });
    timeline.to(cursor, {
      x: () => pointFor(inputRef.current, 2).x,
      y: () => pointFor(inputRef.current, 1).y,
      duration: 0.5,
      ease: "power2.inOut",
    });
    timeline.call(() => {
      typing.value = 0;
      setDraftName("");
      automatedActionRef.current = true;
      inputRef.current?.focus({ preventScroll: true });
      automatedActionRef.current = false;
    });
    timeline.to(typing, {
      value: DEMO_PROJECT_NAME.length,
      duration: 0.86,
      ease: "none",
      onUpdate: () => setDraftName(DEMO_PROJECT_NAME.slice(0, Math.floor(typing.value))),
    });
    timeline.to(cursor, {
      x: () => pointFor(createRef.current, 2).x,
      y: () => pointFor(createRef.current, 1).y,
      duration: 0.52,
      ease: "power2.inOut",
    });
    timeline.fromTo(
      ripple,
      {
        x: () => pointFor(createRef.current, 18).x,
        y: () => pointFor(createRef.current, 18).y,
        autoAlpha: 0.85,
        scale: 0.25,
      },
      { autoAlpha: 0, scale: 1.7, duration: 0.38, ease: "power2.out" },
      ">",
    );
    timeline.call(() => {
      automatedActionRef.current = true;
      createRef.current?.click();
      automatedActionRef.current = false;
    });
    timeline.to({}, { duration: 0.14 });
    timeline.fromTo(
      newProject,
      { display: "grid", autoAlpha: 0, scale: 0.82, y: 12 },
      { autoAlpha: 1, scale: 1, y: 0, duration: 0.58, ease: "back.out(1.7)" },
    );
    timeline.to(cursor, { autoAlpha: 0, duration: 0.18 }, "<+0.12");

    timelineRef.current = timeline;
    autoplayRunningRef.current = true;
    setIsPaused(false);
    timeline.play(0);

    const handleResize = () => {
      if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        if (!autoplayRunningRef.current || !timelineRef.current) return;
        resetDemo();
        timelineRef.current.invalidate().restart();
      });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current);
      autoplayRunningRef.current = false;
      timeline.kill();
      if (timelineRef.current === timeline) timelineRef.current = null;
    };
  }, [reducedMotion, resetDemo]);

  useEffect(() => {
    if (!isDialogOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (autoplayRunningRef.current) stopAutoplay();
      closeDialog();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeDialog, isDialogOpen, stopAutoplay]);

  useEffect(() => {
    if (!isDialogOpen || !inputRef.current) return;
    const frame = requestAnimationFrame(() => {
      automatedActionRef.current = true;
      inputRef.current?.focus({ preventScroll: true });
      automatedActionRef.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [isDialogOpen]);

  const togglePlayback = () => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    if (timeline.paused()) {
      timeline.play();
      autoplayRunningRef.current = true;
      setIsPaused(false);
    } else {
      timeline.pause();
      setIsPaused(true);
    }
  };

  const navItems = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Clinic sites", icon: Building2 },
    { label: "Appointments", icon: CalendarDays },
    { label: "WhatsApp", icon: MessageCircle },
    { label: "Billing", icon: CreditCard },
  ];

  const visibleProjects = createdProject ? [...STARTER_PROJECTS, createdProject] : STARTER_PROJECTS;

  return (
    <div
      ref={rootRef}
      className="relative isolate w-full overflow-hidden rounded-2xl border border-border/80 bg-card text-left shadow-2xl shadow-primary/10 sm:rounded-3xl"
      data-testid="hero-product-demo"
      onFocusCapture={(event) => {
        if (event.target instanceof HTMLElement && event.target.closest("[data-demo-playback]"))
          return;
        if (
          event.nativeEvent.isTrusted &&
          !automatedActionRef.current &&
          autoplayRunningRef.current
        )
          stopAutoplay();
      }}
    >
      <div className="flex min-h-[360px] sm:min-h-[410px]">
        <aside
          className="flex w-12 shrink-0 flex-col border-r border-border/70 bg-muted/20 px-1.5 py-3 sm:w-14 sm:px-2 lg:w-36 lg:px-3"
          aria-label="Demo workspace navigation"
        >
          <div className="mb-5 flex items-center justify-center gap-2 lg:justify-start">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <span className="hidden text-sm font-bold tracking-tight text-foreground lg:inline">
              ClinicX
            </span>
          </div>
          <p className="mb-2 hidden px-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:block">
            Workspace
          </p>
          <nav className="space-y-1" aria-label="Workspace pages">
            {navItems.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                aria-current={activeNav === label ? "page" : undefined}
                aria-label={label}
                title={label}
                onClick={() => setActiveNav(label)}
                className={`flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:justify-start lg:px-2 ${
                  activeNav === label
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="hidden truncate lg:inline">{label}</span>
              </button>
            ))}
          </nav>
          <div className="mt-auto hidden rounded-xl border border-border/70 bg-background p-2.5 lg:block">
            <p className="text-[10px] font-semibold text-foreground">Sample workspace</p>
            <p className="mt-0.5 text-[9px] leading-relaxed text-muted-foreground">
              Preview content only
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex min-h-14 items-center justify-between gap-2 border-b border-border/70 px-3 sm:px-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-bold text-foreground sm:text-base">
                  Clinic sites
                </span>
                <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium text-muted-foreground sm:inline-flex">
                  Demo
                </span>
              </div>
              <p className="hidden truncate text-[10px] text-muted-foreground sm:block">
                Build a simple home for your practice
              </p>
            </div>
            <Button
              ref={ctaRef}
              type="button"
              size="sm"
              onClick={(event) => handleUserClick(event, openDialog)}
              className="h-9 shrink-0 gap-1.5 rounded-xl px-2.5 text-[11px] font-semibold shadow-sm sm:px-3 sm:text-xs"
              aria-haspopup="dialog"
              aria-expanded={isDialogOpen}
              data-testid="create-site-trigger"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>New site</span>
            </Button>
          </div>

          <section className="min-w-0 px-3 py-3 sm:px-4 sm:py-4" aria-label="Clinic sites preview">
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground">Your workspace</p>
                <h3 className="text-sm font-bold text-foreground sm:text-base">Clinic projects</h3>
              </div>
              <span className="rounded-full border border-border/70 bg-background px-2 py-1 text-[9px] text-muted-foreground">
                {visibleProjects.length} samples
              </span>
            </div>

            <div
              className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3"
              aria-live="polite"
              aria-relevant="additions"
            >
              {STARTER_PROJECTS.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
              <div
                ref={newProjectRef}
                className="min-w-0"
                style={{
                  display: createdProject ? "grid" : "none",
                  opacity: reducedMotion && createdProject ? 1 : 0,
                  transform:
                    reducedMotion && createdProject ? "none" : "scale(.84) translateY(10px)",
                  visibility: reducedMotion ? (createdProject ? "visible" : "hidden") : undefined,
                }}
                aria-hidden={!createdProject}
              >
                {createdProject && <ProjectCard project={createdProject} isNew />}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
              <p className="text-[9px] leading-relaxed text-muted-foreground">
                Sample workspace — no clinic data is connected.
              </p>
              {!reducedMotion && timelineRef.current && (
                <button
                  type="button"
                  onClick={togglePlayback}
                  aria-label={isPaused ? "Resume the product demo" : "Pause the product demo"}
                  aria-pressed={isPaused}
                  disabled={!timelineRef.current}
                  data-demo-playback
                  className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                >
                  {isPaused ? (
                    <Play className="size-3" aria-hidden="true" />
                  ) : (
                    <Pause className="size-3" aria-hidden="true" />
                  )}
                  <span>{isPaused ? "Resume" : "Pause"}</span>
                </button>
              )}
            </div>
          </section>
        </div>
      </div>

      <div
        ref={modalRef}
        role="dialog"
        aria-modal={isDialogOpen || undefined}
        aria-labelledby={dialogTitleId}
        aria-hidden={!isDialogOpen}
        onKeyDown={handleDialogKeyDown}
        onMouseDown={(event) => {
          if (
            event.nativeEvent.isTrusted &&
            !automatedActionRef.current &&
            autoplayRunningRef.current
          )
            stopAutoplay();
          if (event.target === event.currentTarget) closeDialog();
        }}
        className="absolute inset-0 z-40 hidden place-items-center rounded-[inherit] bg-foreground/20 p-3 backdrop-blur-[2px]"
        data-testid="create-site-dialog"
      >
        <form
          onSubmit={handleCreate}
          className="w-full max-w-[300px] rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-5"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <span className="mb-2 inline-flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-4" aria-hidden="true" />
              </span>
              <h3 id={dialogTitleId} className="text-base font-bold text-foreground">
                Create a clinic site
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Start with a name. You can customize the details later.
              </p>
            </div>
            <button
              type="button"
              onClick={(event) => handleUserClick(event, () => closeDialog())}
              aria-label="Close dialog"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${dialogTitleId}-name`} className="text-xs font-semibold">
              Site name
            </Label>
            <Input
              ref={inputRef}
              id={`${dialogTitleId}-name`}
              value={draftName}
              onChange={handleInputChange}
              onFocus={() => {
                if (!autoplayRunningRef.current && timelineRef.current) stopAutoplay();
              }}
              placeholder="e.g. My clinic website"
              autoComplete="off"
              className="h-10 text-sm"
              data-testid="create-site-name"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(event) => handleUserClick(event, () => closeDialog())}
            >
              Cancel
            </Button>
            <Button
              ref={createRef}
              type="submit"
              size="sm"
              className="gap-1.5"
              data-testid="create-site-submit"
            >
              <Plus className="size-3.5" aria-hidden="true" /> Create site
            </Button>
          </div>
        </form>
      </div>

      <div
        ref={rippleRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-50 size-9 rounded-full border-2 border-primary bg-primary/15"
      />
      <svg
        ref={cursorRef}
        aria-hidden="true"
        viewBox="0 0 24 28"
        className="pointer-events-none absolute left-0 top-0 z-[60] size-7 text-primary drop-shadow-md"
      >
        <path
          d="M2.5 1.5v21.2l5.7-5.3 3.9 8.1 3.5-1.7-3.9-8.1 7.8-.2L2.5 1.5Z"
          fill="currentColor"
          stroke="hsl(var(--background))"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

function ProjectCard({ project, isNew = false }: { project: DemoProject; isNew?: boolean }) {
  const Icon = project.icon;
  const isBlue = project.tone === "blue";
  return (
    <article
      className={`min-w-0 overflow-hidden rounded-xl border bg-background shadow-sm ${isNew ? "border-primary/40 ring-1 ring-primary/15" : "border-border/70"}`}
    >
      <div
        className={`relative flex h-20 items-center justify-center overflow-hidden border-b border-border/60 ${isBlue ? "bg-primary/5" : "bg-emerald-500/5"}`}
      >
        <div className="absolute inset-x-4 top-3 h-2 rounded-full bg-background/90" />
        <div className="absolute inset-x-4 top-7 flex gap-2">
          <span
            className={`grid size-8 place-items-center rounded-lg ${isBlue ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-600"}`}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <span className="mt-1.5 h-2 w-1/2 rounded-full bg-foreground/10" />
        </div>
        <div className="absolute inset-x-4 bottom-3 flex gap-1.5">
          <span className="h-1.5 w-1/3 rounded-full bg-foreground/10" />
          <span className="h-1.5 w-1/4 rounded-full bg-foreground/5" />
        </div>
        {isNew && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-semibold text-primary-foreground">
            <Check className="size-2.5" /> Just created
          </span>
        )}
      </div>
      <div className="p-2.5 sm:p-3">
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0">
            <h4 className="truncate text-[11px] font-bold text-foreground sm:text-xs">
              {project.title}
            </h4>
            <p className="mt-1 line-clamp-2 min-h-7 text-[9px] leading-relaxed text-muted-foreground">
              {project.detail}
            </p>
          </div>
          <span
            aria-hidden="true"
            className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground"
          >
            <ArrowUpRight className="size-3.5" />
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-1 border-t border-border/60 pt-2">
          <span className="truncate text-[8px] font-medium text-muted-foreground">
            {project.status}
          </span>
          <span
            className={`size-1.5 shrink-0 rounded-full ${isBlue ? "bg-primary" : "bg-emerald-500"}`}
            aria-hidden="true"
          />
        </div>
      </div>
    </article>
  );
}
