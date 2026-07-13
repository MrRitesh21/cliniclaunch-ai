import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar, Users, Clock, TrendingUp, MessageSquare, Bell,
  Search, Plus, Filter, MoreHorizontal, ArrowUpRight, ArrowDownRight,
  Activity, Stethoscope, FileText, IndianRupee, CheckCircle2, XCircle,
  AlertCircle, Star, Sparkles, Video, Pill, Beaker, Package, Trash2, Printer
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Live Demo — ClinicX Dashboard" },
      { name: "description", content: "Explore a fully populated ClinicX doctor dashboard — no sign-up required." },
      { property: "og:title", content: "Live Demo — ClinicX Dashboard" },
      { property: "og:description", content: "Explore a fully populated ClinicX doctor dashboard — no sign-up required." },
    ],
  }),
  component: DemoPage,
});

const defaultPatients = [
  { name: "Priya Sharma", phone: "+91 98765 43210", last: "12 Jun · Dermatology", tags: ["Chronic"], color: "bg-rose-500", email: "priya@gmail.com" },
  { name: "Rahul Verma", phone: "+91 87654 32109", last: "14 Jun · Consultation", tags: ["New"], color: "bg-blue-500", email: "rahul@outlook.com" },
  { name: "Anaya Kapoor", phone: "+91 76543 21098", last: "15 Jun · Biopsy", tags: ["High priority"], color: "bg-emerald-500", email: "anaya.k@yahoo.com" },
  { name: "Neha Iyer", phone: "+91 95432 10987", last: "17 Jun · Consultation", tags: [], color: "bg-purple-500", email: "neha.iyer@gmail.com" },
  { name: "Aditya Mehta", phone: "+91 84321 09876", last: "18 Jun · Cosmetic", tags: ["VIP"], color: "bg-indigo-500", email: "aditya.m@gmail.com" },
  { name: "Vikram Singh", phone: "+91 73210 98765", last: "20 Jun · Acne Therapy", tags: ["Follow-up"], color: "bg-amber-500", email: "vikram.s@outlook.com" },
];

const defaultAppointments = [
  { time: "09:00", name: "Priya Sharma", type: "Follow-up · Dermatology", status: "confirmed", avatar: "PS", color: "bg-rose-500" },
  { time: "09:30", name: "Rahul Verma", type: "New patient · Consultation", status: "confirmed", avatar: "RV", color: "bg-blue-500" },
  { time: "10:00", name: "Anaya Kapoor", type: "Skin biopsy review", status: "in-progress", avatar: "AK", color: "bg-emerald-500" },
  { time: "10:30", name: "Vikram Singh", type: "Acne therapy · Follow-up", status: "pending", avatar: "VS", color: "bg-amber-500" },
  { time: "11:00", name: "Neha Iyer", type: "Consultation", status: "confirmed", avatar: "NI", color: "bg-purple-500" },
  { time: "11:30", name: "Aditya Mehta", type: "Cosmetic consult", status: "confirmed", avatar: "AM", color: "bg-indigo-500" },
];

const defaultActivity = [
  { icon: MessageSquare, text: "WhatsApp reminder sent to Priya Sharma", time: "2 min ago", tone: "emerald" },
  { icon: CheckCircle2, text: "Payment received: ₹1,200 from Rahul Verma", time: "8 min ago", tone: "emerald" },
  { icon: Star, text: "New 5★ review from Anaya Kapoor", time: "22 min ago", tone: "amber" },
  { icon: Calendar, text: "Vikram Singh rescheduled to 3:00 PM", time: "1 hr ago", tone: "blue" },
  { icon: Bell, text: "Low stock alert: Tretinoin 0.025%", time: "2 hr ago", tone: "rose" },
];

const stats = [
  { label: "Today's appointments", value: 24, delta: "+12%", up: true, icon: Calendar, tone: "blue" },
  { label: "Pending confirmations", value: 7, delta: "-3", up: false, icon: Clock, tone: "amber" },
  { label: "Revenue this week", value: "₹1,42,850", delta: "+18%", up: true, icon: IndianRupee, tone: "emerald" },
  { label: "Active patients", value: 1284, delta: "+42", up: true, icon: Users, tone: "purple" },
];

const revenueData = [42, 58, 51, 74, 68, 82, 95, 88, 102, 96, 115, 128];
const revenueMax = Math.max(...revenueData);

const TONE: Record<string, string> = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400",
  purple: "bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400",
};

const STATUS: Record<string, { label: string; className: string }> = {
  confirmed: { label: "Confirmed", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  "in-progress": { label: "In progress", className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" },
  cancelled: { label: "Cancelled", className: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20" },
};

function DemoPage() {
  const [activeSubView, setActiveSubView] = useState<"overview" | "patients" | "whatsapp" | "reviews" | "prescriptions" | "lab" | "inventory" | "loyalty" | "billing">("overview");

  // Dynamic States
  const [appointmentsList, setAppointmentsList] = useState(defaultAppointments);
  const [activityList, setActivityList] = useState(defaultActivity);
  const [patientsList, setPatientsList] = useState(defaultPatients);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  // Dialog / Modal States
  const [apptModalOpen, setApptModalOpen] = useState(false);
  const [consultModalOpen, setConsultModalOpen] = useState(false);
  const [meetDemoModalOpen, setMeetDemoModalOpen] = useState(false);

  // Google Meet Demo Booking states
  const [meetName, setMeetName] = useState("");
  const [meetEmail, setMeetEmail] = useState("");
  const [meetPhone, setMeetPhone] = useState("");
  const [meetClinicName, setMeetClinicName] = useState("");
  const [meetPreferredTime, setMeetPreferredTime] = useState("");
  const [meetMessage, setMeetMessage] = useState("");
  const [isSubmittingMeet, setIsSubmittingMeet] = useState(false);
  const [meetSubmitSuccess, setMeetSubmitSuccess] = useState(false);

  // Appointment Form state
  const [newApptName, setNewApptName] = useState("");
  const [newApptType, setNewApptType] = useState("Consultation");
  const [newApptTime, setNewApptTime] = useState("12:00");

  // Telehealth Consultation state
  const [activeConsultation, setActiveConsultation] = useState<any>(defaultAppointments[2]);
  const [soapSubjective, setSoapSubjective] = useState("Patient reports itching and redness on the left forearm for 3 days.");
  const [soapObjective, setSoapObjective] = useState("Vitals: Temp 98.6 F, BP 120/80 mmHg. Mild erythematous plaque observed.");
  const [soapAssessment, setSoapAssessment] = useState("Contact Dermatitis");
  const [soapPrescription, setSoapPrescription] = useState("Mometasone Furoate 0.1% Cream - Apply once daily for 7 days.");

  // WhatsApp configuration simulation
  const [waConfirmation, setWaConfirmation] = useState(true);
  const [waReminder, setWaReminder] = useState(true);
  const [waFeedback, setWaFeedback] = useState(true);

  // Reviews list simulation
  const [reviewsList, setReviewsList] = useState([
    { author: "Anaya Kapoor", rating: 5, text: "Dr. Jenkins was extremely thorough and helpful with my treatment path.", date: "Today", published: true },
    { author: "Rahul Verma", rating: 5, text: "Brilliant booking flow, got confirmation on WhatsApp instantly. Professional staff.", date: "Yesterday", published: true },
    { author: "Priya Sharma", rating: 4, text: "Satisfied with the consultation. Highly recommended doctor.", date: "2 days ago", published: true },
  ]);

  // Inventory list simulation
  const [inventoryList, setInventoryList] = useState([
    { name: "Paracetamol 650mg", stock: 120, unit: "Tablets", reorder: 50, category: "Medicine" },
    { name: "Mometasone 0.1% Cream", stock: 18, unit: "Tubes", reorder: 20, category: "Topical" },
    { name: "Salicylic Acid Face Wash", stock: 8, unit: "Bottles", reorder: 15, category: "Cosmetic" },
    { name: "Vitamin D3 60k IU", stock: 75, unit: "Capsules", reorder: 30, category: "Supplement" },
  ]);

  // Lab orders list simulation
  const [labOrdersList, setLabOrdersList] = useState([
    { id: "LAB-239", patient: "Anaya Kapoor", test: "Skin Biopsy Histopathology", status: "In progress", date: "Today" },
    { id: "LAB-238", patient: "Rahul Verma", test: "Complete Blood Count (CBC)", status: "Completed", date: "Yesterday" },
    { id: "LAB-237", patient: "Priya Sharma", test: "Allergy IgE Panel", status: "Completed", date: "3 days ago" },
  ]);

  // Billing invoices list simulation
  const [invoicesList, setInvoicesList] = useState([
    { id: "INV-7801", patient: "Rahul Verma", date: "Today", amount: "₹1,200", status: "Paid", method: "Razorpay" },
    { id: "INV-7800", patient: "Priya Sharma", date: "Yesterday", amount: "₹850", status: "Paid", method: "Cash" },
    { id: "INV-7799", patient: "Anaya Kapoor", date: "2 days ago", amount: "₹2,500", status: "Pending", method: "—" },
  ]);

  // Handle Google Meet Demo booking and lead capture
  const handleBookMeetDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetName || !meetPhone || !meetEmail) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSubmittingMeet(true);
    try {
      const messageContent = `Clinic Name: ${meetClinicName || "Not specified"}\nPreferred Date/Time: ${meetPreferredTime || "Not specified"}\nMessage: ${meetMessage || "None"}`;
      
      const { error } = await supabase.from("leads").insert({
        name: meetName,
        phone: meetPhone,
        email: meetEmail,
        message: messageContent,
        source: "demo_booking",
        status: "new"
      });

      if (error) {
        throw new Error(error.message);
      }

      setMeetSubmitSuccess(true);
      toast.success("Demo requested successfully!");
      
      // Add a simulated log entry to the Activity List in the Demo dashboard
      setActivityList(prev => [
        { icon: Video, text: `Google Meet Demo requested by ${meetName} (${meetClinicName || "Clinic"})`, time: "Just now", tone: "blue" },
        ...prev
      ]);
    } catch (err: any) {
      console.error("Error submitting lead:", err);
      toast.error(err.message || "Failed to submit demo request.");
    } finally {
      setIsSubmittingMeet(false);
    }
  };

  const handleResetMeetDemoForm = () => {
    setMeetName("");
    setMeetEmail("");
    setMeetPhone("");
    setMeetClinicName("");
    setMeetPreferredTime("");
    setMeetMessage("");
    setMeetSubmitSuccess(false);
  };

  // Force Light Mode for Demo
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = window.document.documentElement;
    root.classList.remove("dark");
    root.classList.add("light");
  }, []);

  // Handle mock appointment booking
  const handleBookAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApptName) {
      toast.error("Please enter patient name");
      return;
    }

    const newAppt = {
      time: newApptTime,
      name: newApptName,
      type: `Walk-in · ${newApptType}`,
      status: "confirmed",
      avatar: newApptName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2),
      color: "bg-indigo-500"
    };

    setAppointmentsList(prev => [...prev, newAppt].sort((a, b) => a.time.localeCompare(b.time)));
    setActivityList(prev => [
      { icon: Calendar, text: `New appointment booked for ${newApptName} at ${newApptTime}`, time: "Just now", tone: "blue" },
      ...prev
    ]);

    // Add to patient directory if not exists
    if (!patientsList.some(p => p.name.toLowerCase() === newApptName.toLowerCase())) {
      setPatientsList(prev => [
        { name: newApptName, phone: "+91 99999 11111", last: `Today · ${newApptType}`, tags: ["New"], color: "bg-indigo-500", email: `${newApptName.toLowerCase().replace(/\s+/g, '')}@demo.com` },
        ...prev
      ]);
    }

    toast.success("Appointment booked successfully!");
    setApptModalOpen(false);
    setNewApptName("");
  };

  // Handle mock consultation completion
  const handleSaveConsultation = () => {
    toast.success("Consultation complete! Prescriptions generated & sent to patient's WhatsApp.");
    setConsultModalOpen(false);

    // Update appointment status to confirmed/completed
    if (activeConsultation) {
      setAppointmentsList(prev => prev.map(a => a.name === activeConsultation.name ? { ...a, status: "confirmed" } : a));
    }

    // Add to activity list
    setActivityList(prev => [
      { icon: CheckCircle2, text: `Consultation notes finalized for ${activeConsultation?.name}`, time: "Just now", tone: "emerald" },
      ...prev
    ]);

    // Add to dynamic invoice list
    const randomInvId = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
    setInvoicesList(prev => [
      { id: randomInvId, patient: activeConsultation?.name || "Patient", date: "Today", amount: "₹1,500", status: "Paid", method: "Razorpay" },
      ...prev
    ]);
  };

  // Rendering Views
  const renderOverview = () => (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Greeting banner */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Workspace Console</p>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Dr. Sarah Jenkins</h1>
          <p className="text-muted-foreground text-sm mt-1">Skin & Aesthetics Clinic — {appointmentsList.length} scheduled visits today.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setApptModalOpen(true)} className="h-9"><Plus className="size-3.5 mr-1" /> New appointment</Button>
          <Button size="sm" onClick={() => {
            setActiveConsultation(appointmentsList.find(a => a.status === "in-progress") || appointmentsList[0]);
            setConsultModalOpen(true);
          }} className="h-9"><Video className="size-3.5 mr-1" /> Start consultation</Button>
        </div>
      </div>

      {/* Google Meet Demo CTA Card */}
      <Card className="p-5 border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-transparent flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="size-11 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 mt-0.5">
            <Video className="size-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-sm font-display">Book a Personalized Demo on Google Meet</h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              Get a live 1-on-1 walk-through with our product experts. Learn how to configure automated WhatsApp reminders, custom EHR templates, and billing rules tailored to your clinic.
            </p>
          </div>
        </div>
        <Button onClick={() => setMeetDemoModalOpen(true)} className="shrink-0 h-9 font-bold bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm">
          Book Live Demo <ArrowUpRight className="size-4 ml-1" />
        </Button>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4 border-border/60 shadow-sm">
            <div className="flex items-start justify-between">
              <div className={`size-9 rounded-lg grid place-items-center ${TONE[s.tone]}`}>
                <s.icon className="size-4.5" />
              </div>
              <span className={`text-xs font-semibold flex items-center gap-0.5 ${s.up ? "text-emerald-600" : "text-rose-600"}`}>
                {s.up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {s.delta}
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold font-display">{s.label === "Today's appointments" ? appointmentsList.length : s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Grid: appointments + sidebar */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today's schedule */}
        <Card className="lg:col-span-2 overflow-hidden border-border/60 shadow-sm">
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h2 className="font-display text-base font-bold">Today's schedule</h2>
              <p className="text-xs text-muted-foreground">Wednesday, July 1 · {appointmentsList.length} visits</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-8 text-xs"><Filter className="size-3.5 mr-1" /> Filter</Button>
            </div>
          </div>
          <ul className="divide-y">
            {appointmentsList.map((a, i) => (
              <li key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="text-xs font-mono text-muted-foreground w-12 shrink-0">{a.time}</div>
                <div className={`size-8 rounded-full ${a.color} text-white grid place-items-center text-xs font-semibold shrink-0`}>{a.avatar}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  {a.status === "in-progress" && (
                    <Button size="xs" onClick={() => { setActiveConsultation(a); setConsultModalOpen(true); }} className="h-7 text-xs bg-blue-600 hover:bg-blue-700">Consult</Button>
                  )}
                  <Badge variant="outline" className={`text-[10px] h-5 ${STATUS[a.status].className}`}>{STATUS[a.status].label}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Activity feed */}
        <Card className="overflow-hidden border-border/60 shadow-sm">
          <div className="p-4 border-b">
            <h2 className="font-display text-base font-bold">Live activity</h2>
            <p className="text-xs text-muted-foreground">Real-time updates from your clinic</p>
          </div>
          <ul className="divide-y">
            {activityList.slice(0, 5).map((a, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-3.5">
                <div className={`size-7.5 rounded-lg grid place-items-center shrink-0 ${TONE[a.tone]}`}>
                  <a.icon className="size-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-normal">{a.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{a.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Revenue chart */}
      <Card className="p-6 border-border/60 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-base font-bold">Revenue · Last 12 weeks</h2>
            <p className="text-xs text-muted-foreground">₹9,84,200 total · up 22% vs previous period</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-muted-foreground"><span className="size-2.5 rounded-full bg-primary" /> Revenue (Weekly)</span>
          </div>
        </div>
        <div className="h-56 flex items-end gap-2 px-2 relative border-b border-border/60 pb-1">
          {revenueData.map((v, i) => (
            <div 
              key={i} 
              className="flex-1 flex flex-col items-center gap-2 group relative cursor-pointer"
              onMouseEnter={() => setHoveredBar(i)}
              onMouseLeave={() => setHoveredBar(null)}
            >
              {/* Tooltip */}
              <div className={`absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900 border border-slate-800 text-white text-[10px] font-bold rounded shadow-md pointer-events-none transition-all z-10 ${hoveredBar === i ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
                ₹{(v * 1000).toLocaleString()}
              </div>
              <div
                className="w-full rounded-t bg-gradient-to-t from-primary/80 to-primary transition-all group-hover:from-primary group-hover:to-primary/95"
                style={{ height: `${(v / revenueMax) * 100}%` }}
              />
              <span className="text-[9px] text-muted-foreground font-mono font-bold mt-1">W{i + 1}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Installed apps */}
      <div>
        <h2 className="font-display text-lg font-bold mb-4">Installed apps</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { id: "whatsapp", icon: MessageSquare, name: "WhatsApp", stat: "1,284 sent", tone: "emerald" },
            { id: "reviews", icon: Star, name: "Reviews", stat: "4.9 · 312 reviews", tone: "amber" },
            { id: "prescriptions", icon: FileText, name: "Prescriptions", stat: "48 this week", tone: "blue" },
            { id: "lab", icon: Beaker, name: "Lab orders", stat: "12 pending", tone: "purple" },
            { id: "inventory", icon: Package, name: "Inventory", stat: "3 low-stock", tone: "rose" },
            { id: "loyalty", icon: Pill, name: "Loyalty", stat: "246 members", tone: "emerald" },
            { id: "billing", icon: IndianRupee, name: "Billing", stat: "₹1.4L this week", tone: "emerald" },
          ].map((m) => (
            <Card 
              key={m.name} 
              onClick={() => {
                setActiveSubView(m.id as any);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="p-4 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer border-border/60"
            >
              <div className={`size-10 rounded-xl grid place-items-center mb-3 ${TONE[m.tone]}`}>
                <m.icon className="size-5" />
              </div>
              <p className="font-bold text-sm">{m.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{m.stat}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPatients = () => (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Patient Directory</h1>
          <p className="text-sm text-muted-foreground">Manage files, histories, and basic contact sheets.</p>
        </div>
        <Button onClick={() => setApptModalOpen(true)} className="h-9"><Plus className="size-3.5 mr-1" /> Add Patient</Button>
      </div>

      <Card className="p-4 flex gap-2 border-border/60">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search patients by name, email, or phone number..." className="pl-9" />
        </div>
      </Card>

      <Card className="overflow-hidden border-border/60">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 border-b text-xs font-semibold text-muted-foreground uppercase">
              <th className="p-4">Patient Name</th>
              <th className="p-4">Phone Number</th>
              <th className="p-4">Email</th>
              <th className="p-4">Last Visit</th>
              <th className="p-4">Tags</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {patientsList.map((p, i) => (
              <tr key={i} className="hover:bg-muted/20">
                <td className="p-4 font-bold flex items-center gap-3">
                  <div className={`size-8 rounded-full ${p.color} text-white grid place-items-center text-xs font-semibold`}>
                    {p.name.split(" ").map(w => w[0]).join("")}
                  </div>
                  {p.name}
                </td>
                <td className="p-4 font-mono text-xs">{p.phone}</td>
                <td className="p-4 text-muted-foreground text-xs">{p.email}</td>
                <td className="p-4 text-muted-foreground text-xs">{p.last}</td>
                <td className="p-4">
                  {p.tags.map(t => (
                    <Badge key={t} variant="outline" className="text-[10px] font-bold">{t}</Badge>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );

  const renderWhatsApp = () => (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold font-display">WhatsApp Automation</h1>
        <p className="text-sm text-muted-foreground">Configure automated reminders and follow-up templates.</p>
      </div>

      <Card className="p-5 border-l-4 border-l-emerald-500 bg-emerald-500/5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center">
            <MessageSquare className="size-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-emerald-800">Account status: Connected</h3>
            <p className="text-xs text-emerald-700">ClinicX official business line (+91 90000 88888) is active.</p>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-5 border-border/60 space-y-4">
          <h3 className="font-bold font-display text-base">Templates & Automation</h3>
          <div className="space-y-4 divide-y">
            <div className="pt-3 flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold">Appointment Confirmation</h4>
                <p className="text-xs text-muted-foreground mt-0.5 bg-muted p-2 rounded border border-border/40 font-mono">
                  Hi {"{patient}"}, your appointment with {"{doctor}"} is confirmed for {"{time}"}.
                </p>
              </div>
              <button onClick={() => setWaConfirmation(!waConfirmation)} className={`w-10 h-6 rounded-full transition-colors flex items-center p-0.5 ${waConfirmation ? "bg-emerald-500 justify-end" : "bg-slate-300 justify-start"}`}>
                <span className="size-5 bg-white rounded-full shadow" />
              </button>
            </div>
            <div className="pt-4 flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold">24-Hour Reminder</h4>
                <p className="text-xs text-muted-foreground mt-0.5 bg-muted p-2 rounded border border-border/40 font-mono">
                  Hi {"{patient}"}, reminder for your upcoming appointment tomorrow at {"{time}"}.
                </p>
              </div>
              <button onClick={() => setWaReminder(!waReminder)} className={`w-10 h-6 rounded-full transition-colors flex items-center p-0.5 ${waReminder ? "bg-emerald-500 justify-end" : "bg-slate-300 justify-start"}`}>
                <span className="size-5 bg-white rounded-full shadow" />
              </button>
            </div>
            <div className="pt-4 flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold">Feedback / Review Request</h4>
                <p className="text-xs text-muted-foreground mt-0.5 bg-muted p-2 rounded border border-border/40 font-mono">
                  Hi {"{patient}"}, thank you for visiting. Please share your rating: {"{link}"}
                </p>
              </div>
              <button onClick={() => setWaFeedback(!waFeedback)} className={`w-10 h-6 rounded-full transition-colors flex items-center p-0.5 ${waFeedback ? "bg-emerald-500 justify-end" : "bg-slate-300 justify-start"}`}>
                <span className="size-5 bg-white rounded-full shadow" />
              </button>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-border/60">
          <h3 className="font-bold font-display text-base mb-4">Live Message Logs</h3>
          <div className="space-y-3">
            {[
              { name: "Priya Sharma", type: "Confirmation", time: "2 min ago", status: "Delivered" },
              { name: "Rahul Verma", type: "Reminder", time: "8 min ago", status: "Read" },
              { name: "Anaya Kapoor", type: "Feedback", time: "22 min ago", status: "Sent" },
            ].map((log, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs border-b pb-2">
                <div>
                  <span className="font-bold">{log.name}</span>
                  <span className="text-muted-foreground ml-1">({log.type})</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{log.time}</p>
                </div>
                <Badge variant="outline" className={log.status === "Read" ? "bg-emerald-500/10 text-emerald-700" : "bg-blue-500/10 text-blue-700"}>
                  {log.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );

  const renderReviews = () => (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold font-display">Review Management</h1>
        <p className="text-sm text-muted-foreground">Monitor patient reviews and sync with Google Business Profile.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-4 text-center border-border/60">
          <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Average Rating</span>
          <div className="text-3xl font-extrabold text-amber-500 mt-1 flex items-center justify-center gap-1">
            4.9 <Star className="size-6 fill-amber-500 text-amber-500" />
          </div>
        </Card>
        <Card className="p-4 text-center border-border/60">
          <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Reviews</span>
          <div className="text-3xl font-extrabold text-foreground mt-1">312</div>
        </Card>
        <Card className="p-4 text-center border-border/60 bg-primary/5">
          <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Google Sync</span>
          <div className="text-sm font-bold text-primary mt-2">CONNECTED</div>
        </Card>
      </div>

      <Card className="p-5 border-border/60">
        <h3 className="font-bold font-display text-base mb-4">Recent Reviews</h3>
        <div className="space-y-4">
          {reviewsList.map((r, idx) => (
            <div key={idx} className="p-4 border rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{r.author}</span>
                  <span className="text-xs text-muted-foreground font-mono">{r.date}</span>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} className="size-3 fill-amber-500 text-amber-500" />
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{r.text}</p>
              <div className="flex justify-end gap-2 pt-2">
                <Button size="xs" variant="outline">Reply</Button>
                <Button size="xs" variant="outline" className="text-rose-600 hover:text-rose-700">Flag</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderPrescriptions = () => (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Prescriptions (Rx)</h1>
          <p className="text-sm text-muted-foreground">Digital prescriptions, refills, and medication catalogs.</p>
        </div>
        <Button onClick={() => {
          setActiveConsultation(appointmentsList[2]);
          setConsultModalOpen(true);
        }} className="h-9"><Plus className="size-3.5 mr-1" /> New Prescription</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 p-5 border-border/60">
          <h3 className="font-bold font-display text-base mb-4">Medication Catalog</h3>
          <div className="space-y-3">
            {[
              { name: "Mometasone 0.1% Cream", type: "Topical", instructions: "Apply thin film daily" },
              { name: "Tab. Paracetamol 650mg", type: "Oral Tablet", instructions: "1 tablet post meals, SOS" },
              { name: "Cap. Vitamin D3 60K", type: "Oral Capsule", instructions: "1 capsule weekly with milk" },
              { name: "Levocetirizine 5mg", type: "Oral Tablet", instructions: "1 tablet at bedtime" },
            ].map((med, i) => (
              <div key={i} className="flex justify-between items-center text-xs border-b pb-3">
                <div>
                  <h4 className="font-bold">{med.name}</h4>
                  <p className="text-muted-foreground">{med.instructions}</p>
                </div>
                <Badge variant="secondary">{med.type}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 border-border/60">
          <h3 className="font-bold font-display text-base mb-4">Medication Stats</h3>
          <div className="space-y-4">
            <div>
              <span className="text-xs text-muted-foreground">Prescriptions issued this week</span>
              <div className="text-2xl font-bold font-display">48</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Active templates</span>
              <div className="text-2xl font-bold font-display">12</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderLab = () => (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold font-display">Lab Orders</h1>
        <p className="text-sm text-muted-foreground">Track test orders, collection logs, and results.</p>
      </div>

      <Card className="overflow-hidden border-border/60">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 border-b text-xs font-semibold text-muted-foreground uppercase">
              <th className="p-4">Order ID</th>
              <th className="p-4">Patient</th>
              <th className="p-4">Test Description</th>
              <th className="p-4">Date Ordered</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {labOrdersList.map((order, i) => (
              <tr key={i} className="hover:bg-muted/20">
                <td className="p-4 font-mono font-bold text-xs">{order.id}</td>
                <td className="p-4 font-bold">{order.patient}</td>
                <td className="p-4 text-xs">{order.test}</td>
                <td className="p-4 text-xs text-muted-foreground">{order.date}</td>
                <td className="p-4">
                  <Badge variant="outline" className={order.status === "Completed" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : "bg-amber-500/10 text-amber-700 border-amber-500/20"}>
                    {order.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );

  const renderInventory = () => (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Inventory Tracking</h1>
          <p className="text-sm text-muted-foreground">Manage medicine stocks, consumable levels, and alerts.</p>
        </div>
        <Button className="h-9"><Plus className="size-3.5 mr-1" /> Add Stock</Button>
      </div>

      <Card className="overflow-hidden border-border/60">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 border-b text-xs font-semibold text-muted-foreground uppercase">
              <th className="p-4">Item Name</th>
              <th className="p-4">Stock Level</th>
              <th className="p-4">Category</th>
              <th className="p-4">Reorder Limit</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {inventoryList.map((item, i) => {
              const isLow = item.stock <= item.reorder;
              return (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="p-4 font-bold">{item.name}</td>
                  <td className="p-4 font-mono text-xs">{item.stock} {item.unit}</td>
                  <td className="p-4 text-xs text-muted-foreground">{item.category}</td>
                  <td className="p-4 font-mono text-xs">{item.reorder} {item.unit}</td>
                  <td className="p-4">
                    <Badge variant="outline" className={isLow ? "bg-rose-500/10 text-rose-700 border-rose-500/20" : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"}>
                      {isLow ? "Low Stock" : "In Stock"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );

  const renderLoyalty = () => (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold font-display">Loyalty Programs</h1>
        <p className="text-sm text-muted-foreground">Configure referral rewards, discount rules, and member cards.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-5 border-border/60 space-y-4">
          <h3 className="font-bold font-display text-base">Referral Incentives</h3>
          <p className="text-xs text-muted-foreground">Configure rewards for patients referring others.</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs border-b pb-2">
              <span className="font-bold">Patient Reward Points</span>
              <span className="font-bold text-emerald-600">100 Pts (~₹100)</span>
            </div>
            <div className="flex justify-between items-center text-xs border-b pb-2">
              <span className="font-bold">Referee Consultation Discount</span>
              <span className="font-bold text-emerald-600">10% Off</span>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-border/60">
          <h3 className="font-bold font-display text-base mb-4">Loyalty Tiers</h3>
          <div className="space-y-3">
            {[
              { tier: "Gold Tier", points: "500+ Pts", members: 48 },
              { tier: "Silver Tier", points: "200+ Pts", members: 120 },
              { tier: "Bronze Tier", points: "50+ Pts", members: 78 },
            ].map((t, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs border-b pb-2">
                <div>
                  <h4 className="font-bold">{t.tier}</h4>
                  <p className="text-muted-foreground font-mono text-[10px]">{t.points}</p>
                </div>
                <Badge variant="outline">{t.members} Members</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );

  const renderBilling = () => (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Invoicing & Incomes</h1>
          <p className="text-sm text-muted-foreground">Review receipts, print invoices, and review payments.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-4 text-center border-border/60 border-l-4 border-l-emerald-500">
          <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Gross Revenue</span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">₹4,550</div>
        </Card>
        <Card className="p-4 text-center border-border/60 border-l-4 border-l-amber-500">
          <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Pending co-pays</span>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">₹2,500</div>
        </Card>
        <Card className="p-4 text-center border-border/60 border-l-4 border-l-blue-500">
          <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Invoices</span>
          <div className="text-2xl font-extrabold text-blue-600 mt-1">{invoicesList.length} items</div>
        </Card>
      </div>

      <Card className="overflow-hidden border-border/60">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 border-b text-xs font-semibold text-muted-foreground uppercase">
              <th className="p-4">Invoice ID</th>
              <th className="p-4">Patient</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Date</th>
              <th className="p-4">Method</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {invoicesList.map((inv, i) => (
              <tr key={i} className="hover:bg-muted/20">
                <td className="p-4 font-mono font-bold text-xs">{inv.id}</td>
                <td className="p-4 font-bold">{inv.patient}</td>
                <td className="p-4 font-mono text-xs">{inv.amount}</td>
                <td className="p-4 text-xs text-muted-foreground">{inv.date}</td>
                <td className="p-4 text-xs text-muted-foreground">{inv.method}</td>
                <td className="p-4">
                  <Badge variant="outline" className={inv.status === "Paid" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : "bg-amber-500/10 text-amber-700 border-amber-500/20"}>
                    {inv.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );

  return (
    <MarketingShell>
      {/* Demo banner */}
      <div className="bg-primary text-primary-foreground border-b border-primary-foreground/10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4 text-[11px] sm:text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="size-4 shrink-0 animate-pulse text-amber-300" />
            <span className="truncate"><b>Demo mode</b> — fully interactive dashboard. Switch sections using the left rail.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setMeetDemoModalOpen(true)} 
              className="h-7 text-[10px] sm:text-xs border-white/30 text-white hover:bg-white hover:text-primary bg-transparent shrink-0 px-2 sm:px-3 flex items-center gap-1 transition-colors"
            >
              <Video className="size-3 sm:size-3.5" />
              <span>Book <span className="hidden sm:inline">1-on-1 </span>Demo</span>
            </Button>
            <Link to="/auth" className="shrink-0">
              <Button size="sm" variant="secondary" className="h-7 text-[10px] sm:text-xs bg-white text-primary hover:bg-white/95 px-2 sm:px-3">Create free account</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row min-h-[calc(100vh-4rem)] bg-muted/10">
        {/* Mobile Horizontal Tabs */}
        <div className="md:hidden flex items-center gap-2 overflow-x-auto pb-3 pt-3 border-b scrollbar-none px-4 bg-card">
          {[
            { id: "overview", label: "Overview" },
            { id: "patients", label: "Patients" },
            { id: "whatsapp", label: "WhatsApp" },
            { id: "reviews", label: "Reviews" },
            { id: "prescriptions", label: "Rx" },
            { id: "lab", label: "Labs" },
            { id: "inventory", label: "Inventory" },
            { id: "loyalty", label: "Loyalty" },
            { id: "billing", label: "Billing" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSubView(item.id as any)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeSubView === item.id
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Left Demo Sidebar (desktop) */}
        <aside className="hidden md:flex w-64 border-r bg-card flex-col p-4 shrink-0 space-y-6">
          <div className="px-2 pt-2">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-md shadow-primary/20">
                <Stethoscope className="size-5" />
              </div>
              <div>
                <span className="font-display font-bold text-sm tracking-tight text-foreground">ClinicX Demo</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Mock Sandbox environment</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {[
              { id: "overview", label: "Overview", icon: Activity },
              { id: "patients", label: "Patients", icon: Users },
              { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
              { id: "reviews", label: "Reviews", icon: Star },
              { id: "prescriptions", label: "Prescriptions", icon: FileText },
              { id: "lab", label: "Lab orders", icon: Beaker },
              { id: "inventory", label: "Inventory", icon: Package },
              { id: "loyalty", label: "Loyalty", icon: Pill },
              { id: "billing", label: "Billing & Invoices", icon: IndianRupee },
            ].map((item) => {
              const active = activeSubView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSubView(item.id as any);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    active 
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto p-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary animate-pulse" />
              <span className="font-bold text-xs">Personalized Demo</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Want to see how ClinicX fits your clinic? Book a 1-on-1 walk-through on Google Meet.
            </p>
            <Button size="sm" onClick={() => setMeetDemoModalOpen(true)} className="w-full h-8 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90">
              Book Meet Demo
            </Button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 space-y-6">
          {activeSubView === "overview" && renderOverview()}
          {activeSubView === "patients" && renderPatients()}
          {activeSubView === "whatsapp" && renderWhatsApp()}
          {activeSubView === "reviews" && renderReviews()}
          {activeSubView === "prescriptions" && renderPrescriptions()}
          {activeSubView === "lab" && renderLab()}
          {activeSubView === "inventory" && renderInventory()}
          {activeSubView === "loyalty" && renderLoyalty()}
          {activeSubView === "billing" && renderBilling()}
        </div>
      </div>

      {/* Appointment Booking Modal */}
      {apptModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-50 p-4">
          <Card className="w-full max-w-md p-6 border-border/60 shadow-2xl relative animate-in zoom-in duration-200">
            <h3 className="font-display text-lg font-bold mb-4">Book New Appointment</h3>
            <form onSubmit={handleBookAppointment} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="appt-name">Patient Full Name</Label>
                <Input id="appt-name" required value={newApptName} onChange={e => setNewApptName(e.target.value)} placeholder="Vikram Aditya" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="appt-time">Time Slot</Label>
                  <Input id="appt-time" type="time" required value={newApptTime} onChange={e => setNewApptTime(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="appt-type">Consultation Type</Label>
                  <select 
                    id="appt-type"
                    value={newApptType} 
                    onChange={e => setNewApptType(e.target.value)}
                    className="w-full h-10 border rounded-md px-3 bg-background text-sm focus:outline-none"
                  >
                    <option value="Consultation">Consultation</option>
                    <option value="Dermatology">Dermatology</option>
                    <option value="Cosmetic">Cosmetic</option>
                    <option value="Biopsy">Biopsy</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="ghost" onClick={() => setApptModalOpen(false)}>Cancel</Button>
                <Button type="submit">Confirm Appointment</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Telehealth Consultation SOAP Notes Modal */}
      {consultModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-50 p-4">
          <Card className="w-full max-w-4xl p-6 border-border/60 shadow-2xl relative grid lg:grid-cols-2 gap-6 max-h-[90vh] overflow-y-auto animate-in zoom-in duration-200">
            {/* Left Side: Mock Video Frame */}
            <div className="space-y-4 flex flex-col">
              <div className="relative flex-1 bg-slate-950 rounded-xl overflow-hidden min-h-[250px] border border-border/60 flex items-center justify-center">
                {/* Visual Camera Simulation */}
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950/70" />
                <div className="relative text-center text-white space-y-2">
                  <div className="size-16 bg-red-500 rounded-full mx-auto flex items-center justify-center animate-pulse">
                    <Video className="size-8" />
                  </div>
                  <h4 className="font-bold text-sm">Active Session: {activeConsultation?.name}</h4>
                  <p className="text-xs text-slate-400">Secure Peer-to-Peer Telehealth Link Established</p>
                </div>
                <div className="absolute bottom-3 right-3 size-24 bg-slate-900 border rounded-lg overflow-hidden flex items-center justify-center">
                  {/* Doctor Thumbnail */}
                  <span className="text-[10px] text-slate-400 font-bold font-display">Dr. Sarah</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">Mic Active</Badge>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">Video HD</Badge>
              </div>
            </div>

            {/* Right Side: SOAP Prescription Panel */}
            <div className="space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-display text-lg font-bold mb-4">SOAP Notes & Prescription (EHR)</h3>
                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Subjective (Patient Notes)</Label>
                    <textarea 
                      value={soapSubjective} 
                      onChange={e => setSoapSubjective(e.target.value)} 
                      rows={2} 
                      className="w-full border rounded p-2 bg-background focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Objective (Vitals & Observations)</Label>
                    <textarea 
                      value={soapObjective} 
                      onChange={e => setSoapObjective(e.target.value)} 
                      rows={2} 
                      className="w-full border rounded p-2 bg-background focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Assessment (Diagnosis)</Label>
                    <Input 
                      value={soapAssessment} 
                      onChange={e => setSoapAssessment(e.target.value)} 
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Plan (Prescription Catalog)</Label>
                    <textarea 
                      value={soapPrescription} 
                      onChange={e => setSoapPrescription(e.target.value)} 
                      rows={2} 
                      className="w-full border rounded p-2 bg-background focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                <Button variant="ghost" onClick={() => setConsultModalOpen(false)}>Close Session</Button>
                <Button onClick={handleSaveConsultation} className="bg-emerald-600 hover:bg-emerald-700">Sign & Complete</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Google Meet Demo Booking Modal */}
      {meetDemoModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-50 p-4">
          <Card className="w-full max-w-lg p-6 border-border/60 shadow-2xl relative overflow-hidden animate-in zoom-in duration-200">
            {/* Header Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-red-500 to-yellow-500" />
            
            <button 
              onClick={() => { setMeetDemoModalOpen(false); handleResetMeetDemoForm(); }} 
              className="absolute top-4 right-4 size-8 rounded-full grid place-items-center text-muted-foreground hover:bg-muted transition"
              aria-label="Close modal"
            >
              <XCircle className="size-5" />
            </button>

            {!meetSubmitSuccess ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-10 rounded-xl bg-gradient-to-tr from-primary/20 to-primary/10 text-primary grid place-items-center shrink-0">
                    <Video className="size-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold">Book 1-on-1 Demo on Google Meet</h3>
                    <p className="text-xs text-muted-foreground">Get a personalized tour of ClinicX software</p>
                  </div>
                </div>

                <form onSubmit={handleBookMeetDemo} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="meet-name" className="text-xs font-semibold">Your Name <span className="text-red-500">*</span></Label>
                    <Input 
                      id="meet-name" 
                      required 
                      value={meetName} 
                      onChange={e => setMeetName(e.target.value)} 
                      placeholder="Dr. Sarah Jenkins" 
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="meet-email" className="text-xs font-semibold">Email Address <span className="text-red-500">*</span></Label>
                      <Input 
                        id="meet-email" 
                        type="email" 
                        required 
                        value={meetEmail} 
                        onChange={e => setMeetEmail(e.target.value)} 
                        placeholder="doctor@example.com" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="meet-phone" className="text-xs font-semibold">Phone Number <span className="text-red-500">*</span></Label>
                      <Input 
                        id="meet-phone" 
                        type="tel" 
                        required 
                        value={meetPhone} 
                        onChange={e => setMeetPhone(e.target.value)} 
                        placeholder="+91 98765 43210" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="meet-clinic" className="text-xs font-semibold">Clinic Name</Label>
                      <Input 
                        id="meet-clinic" 
                        value={meetClinicName} 
                        onChange={e => setMeetClinicName(e.target.value)} 
                        placeholder="Skin & Aesthetics Clinic" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="meet-time" className="text-xs font-semibold">Preferred Date & Time</Label>
                      <Input 
                        id="meet-time" 
                        type="datetime-local" 
                        value={meetPreferredTime} 
                        onChange={e => setMeetPreferredTime(e.target.value)} 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="meet-msg" className="text-xs font-semibold">Specific requirements (optional)</Label>
                    <Textarea 
                      id="meet-msg" 
                      rows={3} 
                      value={meetMessage} 
                      onChange={e => setMeetMessage(e.target.value)} 
                      placeholder="e.g. Tell us about your specialties or integrations you need." 
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t mt-6">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => { setMeetDemoModalOpen(false); handleResetMeetDemoForm(); }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isSubmittingMeet}
                      className="bg-primary text-primary-foreground hover:bg-primary/95 flex items-center gap-1.5"
                    >
                      {isSubmittingMeet ? "Submitting..." : "Schedule Demo"}
                      {!isSubmittingMeet && <ArrowUpRight className="size-4" />}
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center py-8 space-y-4 animate-in fade-in duration-300">
                <div className="size-16 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center mx-auto">
                  <CheckCircle2 className="size-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-display text-xl font-bold">Demo Request Received!</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Thank you, <b>{meetName}</b>. We have registered your details for a personalized Google Meet walkthrough.
                  </p>
                  <p className="text-xs text-muted-foreground/80 max-w-sm mx-auto">
                    Our team will reach out to you on <b>{meetPhone}</b> via WhatsApp/Call to share the calendar invite and Google Meet link.
                  </p>
                </div>
                <div className="pt-4">
                  <Button 
                    onClick={() => { setMeetDemoModalOpen(false); handleResetMeetDemoForm(); }}
                    className="px-6"
                  >
                    Back to Dashboard
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </MarketingShell>
  );
}
