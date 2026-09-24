import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Copy,
  Loader2,
  ScreenShare,
  ScreenShareOff,
  MessageSquare,
  Send,
  X,
  ArrowLeft,
  MoreVertical,
  Volume2,
  Camera,
  User,
} from "lucide-react";
import { getConsultAppointment } from "@/lib/clinic.functions";

export const Route = createFileRoute("/consult/$appointmentId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Video consultation — ClinicX" },
      { name: "robots", content: "noindex" },
      { name: "theme-color", content: "#075E54" },
    ],
  }),
  component: ConsultRoom,
});

type ChatMsg = { id: string; from: string; author: string; text: string; ts: number };

type Signal =
  | { kind: "ready"; from: string }
  | { kind: "offer"; from: string; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; from: string; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; from: string; candidate: RTCIceCandidateInit }
  | { kind: "chat"; from: string; author: string; text: string; ts: number }
  | { kind: "bye"; from: string };

type Appt = {
  id: string;
  patient_name: string;
  scheduled_at: string;
  clinics: { doctor_name: string; clinic_name: string } | null;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function ConsultRoom() {
  const { appointmentId } = Route.useParams();
  const [appt, setAppt] = useState<Appt | null>(null);
  const [status, setStatus] = useState<
    "idle" | "waiting" | "connecting" | "connected" | "ended" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [unread, setUnread] = useState(0);
  const [joined, setJoined] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [callSeconds, setCallSeconds] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const camTrackRef = useRef<MediaStreamTrack | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const myIdRef = useRef<string>(Math.random().toString(36).slice(2));
  const remoteIdRef = useRef<string | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const makingOfferRef = useRef(false);
  const politeRef = useRef(false);
  const hideTimerRef = useRef<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getConsultAppointment({ data: { id: appointmentId } });
        if (!data) {
          setErrorMsg("Appointment not found.");
          setStatus("error");
          return;
        }
        setAppt(data as unknown as Appt);
      } catch {
        setErrorMsg("Appointment not found.");
        setStatus("error");
      }
    })();
  }, [appointmentId]);

  // Call duration ticker
  useEffect(() => {
    if (status !== "connected") return;
    const id = window.setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  // Auto-hide controls after 4s of inactivity while connected
  useEffect(() => {
    if (status !== "connected") {
      setControlsVisible(true);
      return;
    }
    const reset = () => {
      setControlsVisible(true);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 4000);
    };
    reset();
    window.addEventListener("pointermove", reset);
    window.addEventListener("touchstart", reset);
    return () => {
      window.removeEventListener("pointermove", reset);
      window.removeEventListener("touchstart", reset);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [status]);

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  const cleanup = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const send = useCallback((msg: Signal) => {
    channelRef.current?.send({ type: "broadcast", event: "signal", payload: msg });
  }, []);

  const ensurePeer = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    pc.onicecandidate = (e) => {
      if (e.candidate)
        send({ kind: "ice", from: myIdRef.current, candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) remoteVideoRef.current.srcObject = e.streams[0];
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") setStatus("connected");
      else if (s === "disconnected" || s === "failed") setStatus("ended");
    };
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current = true;
        await pc.setLocalDescription();
        if (pc.localDescription)
          send({ kind: "offer", from: myIdRef.current, sdp: pc.localDescription });
      } catch (err) {
        console.error("negotiation error", err);
      } finally {
        makingOfferRef.current = false;
      }
    };
    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });
    return pc;
  }, [send]);

  const handleSignal = useCallback(
    async (msg: Signal) => {
      if (msg.from === myIdRef.current) return;
      if (!remoteIdRef.current) remoteIdRef.current = msg.from;
      if (msg.from !== remoteIdRef.current) return;
      const pc = ensurePeer();
      try {
        if (msg.kind === "ready") {
          send({ kind: "ready", from: myIdRef.current });
          politeRef.current = myIdRef.current > msg.from;
          if (!politeRef.current) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            send({ kind: "offer", from: myIdRef.current, sdp: pc.localDescription! });
          }
          setStatus("connecting");
        } else if (msg.kind === "offer") {
          const offerCollision = makingOfferRef.current || pc.signalingState !== "stable";
          if (offerCollision && !politeRef.current) return;
          await pc.setRemoteDescription(msg.sdp);
          await pc.setLocalDescription(await pc.createAnswer());
          send({ kind: "answer", from: myIdRef.current, sdp: pc.localDescription! });
          for (const c of pendingIceRef.current) await pc.addIceCandidate(c);
          pendingIceRef.current = [];
        } else if (msg.kind === "answer") {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(msg.sdp);
            for (const c of pendingIceRef.current) await pc.addIceCandidate(c);
            pendingIceRef.current = [];
          }
        } else if (msg.kind === "ice") {
          if (pc.remoteDescription) await pc.addIceCandidate(msg.candidate);
          else pendingIceRef.current.push(msg.candidate);
        } else if (msg.kind === "chat") {
          setMessages((m) => [
            ...m,
            {
              id: `${msg.from}-${msg.ts}`,
              from: msg.from,
              author: msg.author,
              text: msg.text,
              ts: msg.ts,
            },
          ]);
          setUnread((u) => (chatOpen ? u : u + 1));
        } else if (msg.kind === "bye") {
          setStatus("ended");
          cleanup();
        }
      } catch (err) {
        console.error("signal error", err);
      }
    },
    [ensurePeer, send, cleanup, chatOpen],
  );

  async function join() {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setJoined(true);
      setStatus("waiting");

      const channel = supabase.channel(`consult:${appointmentId}`, {
        config: { broadcast: { self: false } },
      });
      channelRef.current = channel;
      channel.on("broadcast", { event: "signal" }, (payload) =>
        handleSignal(payload.payload as Signal),
      );
      await new Promise<void>((resolve, reject) => {
        channel.subscribe((s) => {
          if (s === "SUBSCRIBED") resolve();
          else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT")
            reject(new Error("Realtime channel error"));
        });
      });
      ensurePeer();
      send({ kind: "ready", from: myIdRef.current });
    } catch (err) {
      const e = err as Error;
      setErrorMsg(e.message || "Could not access camera/microphone.");
      setStatus("error");
    }
  }

  function toggleMic() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }
  function toggleCam() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }

  async function toggleShare() {
    const pc = pcRef.current;
    if (!pc) return;
    const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (!videoSender) return;
    if (!sharing) {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = screen;
        camTrackRef.current = videoSender.track;
        const screenTrack = screen.getVideoTracks()[0];
        await videoSender.replaceTrack(screenTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = screen;
        screenTrack.onended = () => {
          void toggleShare();
        };
        setSharing(true);
      } catch (e) {
        if ((e as Error).name !== "NotAllowedError") toast.error("Couldn't start screen share");
      }
    } else {
      const cam = camTrackRef.current;
      if (cam) await videoSender.replaceTrack(cam);
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      if (localVideoRef.current && localStreamRef.current)
        localVideoRef.current.srcObject = localStreamRef.current;
      setSharing(false);
    }
  }

  async function switchCamera() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const current = track.getSettings().facingMode as string | undefined;
    const next = current === "user" ? "environment" : "user";
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: next } },
        audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(newTrack);
      track.stop();
      localStreamRef.current?.removeTrack(track);
      localStreamRef.current?.addTrack(newTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    } catch {
      toast.error("Couldn't switch camera");
    }
  }

  function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    const ts = Date.now();
    setMessages((m) => [...m, { id: `me-${ts}`, from: myIdRef.current, author: "You", text, ts }]);
    send({ kind: "chat", from: myIdRef.current, author: "You", text, ts });
    setChatInput("");
  }
  function endCall() {
    send({ kind: "bye", from: myIdRef.current });
    setStatus("ended");
    cleanup();
  }
  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied — share with the other party");
  }

  const remoteName = appt?.clinics?.doctor_name || "Doctor";
  const patientName = appt?.patient_name || "Patient";

  // ── ERROR ────────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 p-6">
        <Card className="p-8 max-w-md text-center">
          <div className="size-14 rounded-full bg-destructive/10 grid place-items-center mx-auto mb-4">
            <PhoneOff className="size-6 text-destructive" />
          </div>
          <h1 className="font-display text-2xl">Can't start the call</h1>
          <p className="text-muted-foreground mt-2 text-sm">{errorMsg}</p>
          <Link to="/" className="inline-block mt-6">
            <Button variant="outline">Go home</Button>
          </Link>
        </Card>
      </div>
    );
  }

  // ── ENDED ────────────────────────────────────────────────────────────────
  if (status === "ended") {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 p-6 text-white">
        <div className="text-center max-w-sm">
          <div className="size-20 rounded-full bg-white/10 grid place-items-center mx-auto mb-5">
            <PhoneOff className="size-8 text-red-400" />
          </div>
          <h1 className="font-display text-2xl">Call ended</h1>
          <p className="text-white/60 text-sm mt-1">Duration · {formatDuration(callSeconds)}</p>
          <div className="mt-6 flex gap-2 justify-center">
            <Link to="/">
              <Button
                variant="outline"
                className="bg-transparent border-white/20 text-white hover:bg-white/10"
              >
                Home
              </Button>
            </Link>
            <Button
              onClick={() => window.location.reload()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Rejoin
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── LOBBY (pre-join) ─────────────────────────────────────────────────────
  if (!joined) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white flex flex-col">
        <header className="px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-white/10">
            <ArrowLeft className="size-5" />
          </Link>
          <p className="text-sm font-medium">Video consultation</p>
        </header>
        <div className="flex-1 grid place-items-center px-4">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto size-28 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 grid place-items-center text-4xl font-semibold shadow-2xl shadow-emerald-900/50 mb-5 ring-4 ring-white/5">
              {appt ? initials(remoteName) : <User className="size-10" />}
            </div>
            <h1 className="font-display text-2xl">{appt ? remoteName : "Loading…"}</h1>
            {appt && (
              <>
                <p className="text-white/60 text-sm mt-1">{appt.clinics?.clinic_name}</p>
                <p className="text-white/40 text-xs mt-3">
                  Appointment · {new Date(appt.scheduled_at).toLocaleString()}
                </p>
              </>
            )}

            <Button
              onClick={join}
              disabled={!appt}
              className="mt-8 w-full h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-base font-medium shadow-lg shadow-emerald-900/40"
            >
              {appt ? (
                <>
                  <Video className="size-5 mr-2" /> Join video call
                </>
              ) : (
                <Loader2 className="size-5 animate-spin" />
              )}
            </Button>

            <button
              onClick={copyLink}
              className="mt-4 text-xs text-white/50 hover:text-white/80 inline-flex items-center gap-1.5"
            >
              <Copy className="size-3.5" /> Copy call link
            </button>

            <p className="text-[11px] text-white/40 mt-8 leading-relaxed">
              Your browser will ask for camera and microphone access.
              <br />
              The call is end-to-end peer-to-peer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── IN-CALL (WhatsApp-style) ─────────────────────────────────────────────
  const showOverlay = status !== "connected";

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden fixed inset-0 flex flex-col">
      {/* Remote video (full bleed) */}
      <div className="absolute inset-0 bg-slate-950">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        {showOverlay && (
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 grid place-items-center">
            <div className="text-center">
              <div className="mx-auto size-32 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 grid place-items-center text-5xl font-semibold shadow-2xl mb-6 ring-4 ring-white/5 relative">
                {initials(remoteName)}
                <span className="absolute inset-0 rounded-full ring-2 ring-emerald-400/40 animate-ping" />
              </div>
              <p className="font-display text-2xl">{remoteName}</p>
              <p className="text-white/60 text-sm mt-2">
                {status === "waiting" && "Waiting for them to join…"}
                {status === "connecting" && "Connecting…"}
              </p>
              {status === "waiting" && (
                <button
                  onClick={copyLink}
                  className="mt-6 inline-flex items-center gap-2 text-xs bg-white/10 hover:bg-white/15 rounded-full px-4 py-2"
                >
                  <Copy className="size-3.5" /> Copy invite link
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Top bar (WhatsApp-style) */}
      <header
        className={`absolute top-0 inset-x-0 z-20 transition-opacity duration-300 ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)" }}
      >
        <div className="px-3 pt-3 pb-6 flex items-center gap-3">
          <button
            onClick={endCall}
            className="p-2 -ml-1 rounded-full hover:bg-white/10"
            aria-label="Back"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="size-9 rounded-full bg-emerald-600 grid place-items-center text-sm font-semibold shrink-0">
            {initials(remoteName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{remoteName}</p>
            <p className="text-[11px] text-white/70">
              {status === "connected" ? (
                <span className="inline-flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {formatDuration(callSeconds)}
                </span>
              ) : status === "waiting" ? (
                "Ringing…"
              ) : (
                "Connecting…"
              )}
            </p>
          </div>
          <button
            onClick={copyLink}
            className="p-2 rounded-full hover:bg-white/10"
            aria-label="Copy link"
          >
            <Copy className="size-4" />
          </button>
          <button className="p-2 rounded-full hover:bg-white/10" aria-label="More">
            <MoreVertical className="size-4" />
          </button>
        </div>
      </header>

      {/* Local PIP (self-view) */}
      <div className="absolute top-20 right-3 z-10 w-28 sm:w-36 aspect-[3/4] rounded-2xl overflow-hidden bg-slate-800 shadow-2xl ring-1 ring-white/10 touch-none">
        {camOn ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        ) : (
          <div className="w-full h-full grid place-items-center bg-slate-800">
            <div className="size-12 rounded-full bg-slate-700 grid place-items-center">
              <VideoOff className="size-5 text-white/60" />
            </div>
          </div>
        )}
        {sharing && (
          <span className="absolute top-1 left-1 text-[9px] bg-emerald-600 rounded px-1.5 py-0.5 font-medium">
            SHARING
          </span>
        )}
        {!micOn && (
          <span className="absolute bottom-1 right-1 size-6 rounded-full bg-red-500 grid place-items-center">
            <MicOff className="size-3" />
          </span>
        )}
      </div>

      {/* Bottom controls (circular, WhatsApp-style) */}
      <div
        className={`absolute bottom-0 inset-x-0 z-20 pb-6 pt-16 transition-opacity duration-300 ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)" }}
      >
        <div className="flex items-center justify-center gap-3 sm:gap-4 px-4 flex-wrap">
          <CtrlButton onClick={toggleMic} active={!micOn} label={micOn ? "Mute" : "Unmute"}>
            {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </CtrlButton>
          <CtrlButton
            onClick={toggleCam}
            active={!camOn}
            label={camOn ? "Turn camera off" : "Turn camera on"}
          >
            {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
          </CtrlButton>
          <CtrlButton onClick={switchCamera} label="Switch camera">
            <Camera className="size-5" />
          </CtrlButton>
          <CtrlButton
            onClick={toggleShare}
            highlight={sharing}
            label={sharing ? "Stop sharing" : "Share screen"}
          >
            {sharing ? <ScreenShareOff className="size-5" /> : <ScreenShare className="size-5" />}
          </CtrlButton>
          <CtrlButton
            onClick={() => {
              setChatOpen((o) => !o);
              setUnread(0);
            }}
            highlight={chatOpen}
            label="Chat"
            badge={unread > 0 && !chatOpen ? unread : undefined}
          >
            <MessageSquare className="size-5" />
          </CtrlButton>
          <button
            onClick={endCall}
            className="size-14 rounded-full bg-red-600 hover:bg-red-700 grid place-items-center shadow-lg shadow-red-900/50 transition"
            aria-label="End call"
          >
            <PhoneOff className="size-6" />
          </button>
        </div>
      </div>

      {/* Chat sheet (WhatsApp-style) */}
      {chatOpen && (
        <div className="absolute inset-0 z-30 flex flex-col sm:justify-end sm:items-end">
          <div
            className="hidden sm:block absolute inset-0 bg-black/40"
            onClick={() => setChatOpen(false)}
          />
          <div className="relative w-full sm:w-96 sm:m-4 sm:rounded-2xl bg-[#0b141a] flex flex-col h-full sm:h-[80vh] shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-[#075E54] flex items-center gap-3">
              <button
                onClick={() => setChatOpen(false)}
                className="p-1 -ml-1 rounded-full hover:bg-white/10"
              >
                <X className="size-5" />
              </button>
              <div className="flex-1">
                <p className="text-sm font-medium">In-call chat</p>
                <p className="text-[11px] text-white/70">
                  {patientName} · {remoteName}
                </p>
              </div>
            </div>
            <div
              className="flex-1 overflow-y-auto p-3 space-y-1.5"
              style={{
                backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
                backgroundSize: "18px 18px",
              }}
            >
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-block bg-yellow-500/10 text-yellow-200 text-[11px] rounded-lg px-3 py-2">
                    Messages here stay only during this call.
                  </div>
                </div>
              ) : (
                messages.map((m) => {
                  const mine = m.from === myIdRef.current;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-lg px-2.5 py-1.5 text-sm shadow ${
                          mine
                            ? "bg-[#005c4b] text-white rounded-tr-none"
                            : "bg-[#202c33] text-white rounded-tl-none"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words leading-snug">{m.text}</p>
                        <p className="text-[9px] opacity-60 text-right mt-0.5">
                          {new Date(m.ts).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendChat();
              }}
              className="p-2 bg-[#0b141a] flex gap-2 items-center border-t border-white/5"
            >
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Message"
                className="bg-[#2a3942] border-0 text-white placeholder:text-white/50 rounded-full h-10 focus-visible:ring-0"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="size-10 shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 grid place-items-center"
                aria-label="Send"
              >
                <Send className="size-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CtrlButton({
  children,
  onClick,
  active,
  highlight,
  label,
  badge,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean; // "off" state (mic muted, cam off) → red-tinted
  highlight?: boolean; // "on" toggle (sharing, chat open) → white bg
  label: string;
  badge?: number;
}) {
  const base = "relative size-12 rounded-full grid place-items-center transition backdrop-blur";
  const style = active
    ? "bg-white text-slate-900"
    : highlight
      ? "bg-white text-slate-900"
      : "bg-white/15 text-white hover:bg-white/25";
  return (
    <button onClick={onClick} className={`${base} ${style}`} aria-label={label}>
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 size-5 rounded-full bg-red-500 text-[10px] font-semibold grid place-items-center ring-2 ring-black">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}
