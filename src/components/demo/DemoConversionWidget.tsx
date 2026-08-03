import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, X, CheckCircle2, Zap } from "lucide-react";

export function DemoConversionWidget({
  onExitDemo,
  onStartTrial,
}: {
  onExitDemo: () => void;
  onStartTrial: () => void;
}) {
  const [minimized, setMinimized] = useState(false);

  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-in fade-in zoom-in duration-200">
        <button
          onClick={onStartTrial}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-xs border border-blue-400/30 hover:scale-105 transition-all group"
        >
          <Sparkles className="size-4 text-amber-300 animate-pulse" />
          <span>Claim 14-Day Free Trial</span>
          <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-[calc(100vw-3rem)] bg-slate-950/95 text-slate-100 border border-blue-500/40 rounded-2xl p-5 shadow-2xl backdrop-blur-2xl animate-in slide-in-from-bottom-5 duration-300 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold text-blue-300 uppercase">
          <Zap className="size-3 text-amber-400 fill-amber-400" />
          <span>14-Day Free Trial Available</span>
        </div>
        <button
          onClick={() => setMinimized(true)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          title="Minimize conversion card"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-2">
        <h4 className="font-display text-base font-bold text-white leading-snug">
          Like what you see in the Live Demo?
        </h4>
        <p className="text-xs text-slate-300 leading-relaxed">
          Launch <strong>your own clinic website</strong>, WhatsApp bot & digital EHR in 5 minutes with <strong>0% patient commission</strong>.
        </p>
      </div>

      {/* Social Proof Line */}
      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium pt-1 border-t border-slate-800/80">
        <div className="flex -space-x-1">
          <span className="size-5 rounded-full bg-blue-600 grid place-items-center text-[9px] text-white font-bold">DR</span>
          <span className="size-5 rounded-full bg-emerald-600 grid place-items-center text-[9px] text-white font-bold">AP</span>
          <span className="size-5 rounded-full bg-indigo-600 grid place-items-center text-[9px] text-white font-bold">MK</span>
        </div>
        <span>Joined by <strong>240+ doctors</strong> across India</span>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-1">
        <Button
          size="lg"
          onClick={onStartTrial}
          className="w-full font-bold bg-blue-600 hover:bg-blue-500 text-white h-11 text-xs shadow-lg shadow-blue-600/30 gap-1.5 border border-blue-400/30 cursor-pointer"
        >
          Start 14-Day Free Trial (₹1 setup) <ArrowRight className="size-4" />
        </Button>

        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono px-1">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="size-3 text-emerald-400" /> Cancel anytime
          </span>
          <button onClick={onExitDemo} className="underline hover:text-slate-200">
            Exit Live Demo
          </button>
        </div>
      </div>
    </div>
  );
}
