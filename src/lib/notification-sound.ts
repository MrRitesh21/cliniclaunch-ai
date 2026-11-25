/**
 * Shared Web Audio API notification sound synthesizer for ClinicX.
 * Zero external CDN dependencies, offline-capable, and respects user mute preference.
 */

const MUTE_STORAGE_KEY = "clinicx_notif_sound_muted";

export type NotificationSoundKind = "booking" | "queue" | "review" | "lead" | "payment" | "general";

let sharedCtx: AudioContext | null = null;
let unlockBound = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AudioCtx();
  }
  return sharedCtx;
}

/** Ensures the shared AudioContext unlocks on the first pointer/key gesture. */
export function bindNotificationAudioUnlock(): void {
  if (typeof window === "undefined" || unlockBound) return;
  unlockBound = true;
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => undefined);
    }
    if (!ctx || ctx.state === "running") {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    }
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

export function isNotificationSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setNotificationSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (muted) {
      window.localStorage.setItem(MUTE_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(MUTE_STORAGE_KEY);
    }
  } catch {
    /* ignore storage errors */
  }
}

export function soundKindFromCategory(category?: string | null): NotificationSoundKind {
  const c = (category || "").toLowerCase();
  if (c.includes("appoint") || c.includes("book")) return "booking";
  if (c.includes("queue") || c.includes("walkin") || c.includes("walk-in") || c.includes("token"))
    return "queue";
  if (c.includes("review") || c.includes("feedback")) return "review";
  if (c.includes("lead")) return "lead";
  if (c.includes("pay") || c.includes("bill") || c.includes("invoice")) return "payment";
  return "general";
}

interface ToneNote {
  freq: number;
  offset: number;
  duration: number;
  gain: number;
}

const SOUND_PATTERNS: Record<NotificationSoundKind, ToneNote[]> = {
  // Warm 3-note ascending medical chime (C5 -> E5 -> G5)
  booking: [
    { freq: 523.25, offset: 0, duration: 0.24, gain: 0.14 },
    { freq: 659.25, offset: 0.09, duration: 0.26, gain: 0.16 },
    { freq: 783.99, offset: 0.18, duration: 0.42, gain: 0.18 },
  ],
  // Crisp double-bell chime (G5 -> B5)
  queue: [
    { freq: 783.99, offset: 0, duration: 0.2, gain: 0.15 },
    { freq: 987.77, offset: 0.11, duration: 0.34, gain: 0.16 },
  ],
  // Bright major third (A5 -> C#6)
  payment: [
    { freq: 880, offset: 0, duration: 0.18, gain: 0.14 },
    { freq: 1108.73, offset: 0.09, duration: 0.36, gain: 0.15 },
  ],
  // Soft two-note chime (E5 -> A5)
  review: [
    { freq: 659.25, offset: 0, duration: 0.2, gain: 0.13 },
    { freq: 880, offset: 0.1, duration: 0.32, gain: 0.14 },
  ],
  // Subtle alert (D5 -> F#5)
  lead: [
    { freq: 587.33, offset: 0, duration: 0.2, gain: 0.13 },
    { freq: 739.99, offset: 0.1, duration: 0.32, gain: 0.14 },
  ],
  // Clean default chime (F5 -> A5)
  general: [
    { freq: 698.46, offset: 0, duration: 0.2, gain: 0.13 },
    { freq: 880, offset: 0.1, duration: 0.32, gain: 0.15 },
  ],
};

/** Plays a gentle Web Audio chime unless muted. Safe to call in SSR/headless environments. */
export function playNotificationChime(
  kind: NotificationSoundKind = "general",
  options?: { ignoreMute?: boolean },
): void {
  if (!options?.ignoreMute && isNotificationSoundMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => undefined);
    }

    const now = ctx.currentTime + 0.01;
    const notes = SOUND_PATTERNS[kind] || SOUND_PATTERNS.general;

    for (const note of notes) {
      const startAt = now + note.offset;
      const stopAt = startAt + note.duration;

      // Fundamental sine wave + subtle warm octave shimmer
      const osc = ctx.createOscillator();
      const harmonic = ctx.createOscillator();
      const gain = ctx.createGain();
      const harmonicGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, startAt);

      harmonic.type = "triangle";
      harmonic.frequency.setValueAtTime(note.freq * 2, startAt);

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(note.gain, startAt + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

      harmonicGain.gain.setValueAtTime(0.0001, startAt);
      harmonicGain.gain.linearRampToValueAtTime(note.gain * 0.18, startAt + 0.015);
      harmonicGain.gain.exponentialRampToValueAtTime(0.0001, stopAt * 0.9);

      osc.connect(gain);
      harmonic.connect(harmonicGain);
      gain.connect(ctx.destination);
      harmonicGain.connect(ctx.destination);

      osc.start(startAt);
      harmonic.start(startAt);
      osc.stop(stopAt + 0.02);
      harmonic.stop(stopAt + 0.02);
    }
  } catch {
    /* ignore Web Audio errors on restricted devices */
  }
}
