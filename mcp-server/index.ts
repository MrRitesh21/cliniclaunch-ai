#!/usr/bin/env bun
/**
 * @module cliniclaunch-mcp
 * @description Model Context Protocol (MCP) Server for ClinicLaunch AI & WAFlow CRM.
 * Enables 1-click clinic website generation, CRM lead sync, and WhatsApp pitch creation.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

// Directories
const CLINICLAUNCH_ROOT = path.resolve(__dirname, "..");
const WAFLOW_DATA_DIR = "/Users/ritesh/projects/whats-gateway-v1.5.6-source-code/data";
const DEFAULT_ORIGIN = "https://clinicx.digiwil.com";

// Helper to find latest WAFlow CRM file
function getWAFlowCrmFile(): string | null {
  if (!fs.existsSync(WAFLOW_DATA_DIR)) return null;
  const files = fs.readdirSync(WAFLOW_DATA_DIR);
  const crmFiles = files
    .filter((f) => f.startsWith("crm-leads-") && f.endsWith(".json"))
    .map((f) => ({
      path: path.join(WAFLOW_DATA_DIR, f),
      mtime: fs.statSync(path.join(WAFLOW_DATA_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (crmFiles.length > 0) return crmFiles[0].path;
  const fallback = path.join(WAFLOW_DATA_DIR, "crm-leads.json");
  return fs.existsSync(fallback) ? fallback : null;
}

// ─── TOOL DEFINITIONS ──────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "generate_clinic_website",
    description:
      "Generate a fully functional, live, published clinic website at https://clinicx.digiwil.com/c/[slug] with doctor bio, 6 clinical procedures, fees, Google reviews, and WhatsApp booking.",
    inputSchema: {
      type: "object",
      properties: {
        clinic_name: { type: "string", description: "Name of the clinic (e.g. 'Active Life Physiotherapy Clinic')" },
        doctor_name: { type: "string", description: "Doctor's name (e.g. 'Dr. Anubhav Agrawal'). Auto-detected if omitted." },
        phone: { type: "string", description: "WhatsApp contact phone number (e.g. '919455094720')" },
        specialty: { type: "string", description: "Medical specialty (e.g. 'Physiotherapy & Rehabilitation', 'Orthopedic', 'Dental')" },
        city: { type: "string", description: "City (default: 'Lucknow')" },
        address: { type: "string", description: "Clinic physical address or locality" },
        rating: { type: "number", description: "Google star rating (default: 4.9)" },
        reviews_count: { type: "number", description: "Number of reviews (default: 85)" },
        use_ai: { type: "boolean", description: "Whether to use LLM copywriting (default: true)" },
      },
      required: ["clinic_name", "phone"],
    },
  },
  {
    name: "generate_website_for_waflow_lead",
    description:
      "1-Click generate a ClinicX website for a lead in WAFlow CRM. Automatically reads lead info, generates the live website at /c/[slug], updates the lead's website in WAFlow CRM, and produces a ready-to-send WhatsApp pitch.",
    inputSchema: {
      type: "object",
      properties: {
        lead_name_or_phone: {
          type: "string",
          description: "Search keyword matching the lead's name or phone number (e.g. 'Active Life' or '919455094720')",
        },
        auto_update_crm: {
          type: "boolean",
          description: "Whether to save the generated URL back to WAFlow CRM (default: true)",
        },
      },
      required: ["lead_name_or_phone"],
    },
  },
  {
    name: "sync_all_interested_waflow_leads",
    description:
      "Finds all leads in WAFlow CRM with stage 'INTERESTED' (or specified stage) that do not have a website yet, generates ClinicX AI websites for all of them in bulk, and updates their CRM records.",
    inputSchema: {
      type: "object",
      properties: {
        stage: {
          type: "string",
          description: "CRM stage to process (e.g. 'INTERESTED', 'NEW', 'QUALIFIED', or 'ALL'). Default is 'INTERESTED'.",
        },
        limit: {
          type: "number",
          description: "Maximum number of leads to process in one batch (default: 10)",
        },
      },
    },
  },
  {
    name: "list_waflow_crm_leads",
    description:
      "List recent leads from WAFlow CRM with stage, priority, phone, and current website status.",
    inputSchema: {
      type: "object",
      properties: {
        stage: { type: "string", description: "Optional filter by stage (e.g. 'INTERESTED', 'NEW', 'WON')" },
        search: { type: "string", description: "Search term for lead name or phone" },
        limit: { type: "number", description: "Max leads to return (default: 20)" },
      },
    },
  },
  {
    name: "batch_create_from_csv",
    description:
      "Batch generate 100+ clinic websites from a CSV string or local CSV file path. Returns all live URLs and an updated CSV.",
    inputSchema: {
      type: "object",
      properties: {
        csv_path_or_content: { type: "string", description: "File path to CSV or raw CSV text" },
        default_city: { type: "string", description: "Default city fallback (e.g. 'Lucknow')" },
      },
      required: ["csv_path_or_content"],
    },
  },
];

// ─── EXECUTION HANDLERS ────────────────────────────────────────────────────────

async function handleGenerateClinicWebsite(args: any) {
  const {
    createFullClinicFromParsedRow,
    extractDoctorAndClinicNames,
    cleanDoctorName,
    cleanRawTitle,
  } = await import("../src/lib/ai-clinic-creator.server");

  const extracted = extractDoctorAndClinicNames({
    title: args.clinic_name,
    category: args.specialty || "",
  });

  const doctorName = args.doctor_name
    ? cleanDoctorName(args.doctor_name)
    : extracted.doctorName;
  const clinicName = cleanRawTitle(args.clinic_name || extracted.clinicName);
  const specialty = args.specialty || extracted.detectedSpecialty;
  const city = args.city || "Lucknow";

  const row = {
    id: `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    doctorName,
    clinicName,
    specialty,
    city,
    phone: String(args.phone).trim(),
    address: args.address || `${city}, India`,
    rating: typeof args.rating === "number" ? args.rating : 4.9,
    reviewsCount: typeof args.reviews_count === "number" ? args.reviews_count : 85,
    timings: "10:00 AM - 8:00 PM",
  };

  const res = await createFullClinicFromParsedRow(row, {
    useAi: args.use_ai !== false,
  });

  const websiteUrl = `${DEFAULT_ORIGIN}/c/${res.slug}`;
  const whatsappPitch = `Namaste *${doctorName}* (${clinicName}),\n\nHumne aapke clinic ke liye ek complete, modern aur mobile-friendly appointment & 24/7 WhatsApp OPD portal taiyar kiya hai:\n🌐 ${websiteUrl}\n\n✨ *Key Highlights:*\n• 24/7 WhatsApp AI Receptionist & Instant OPD Token\n• Computerized Prescriptions & Patient History\n• Verified Google Reviews & Clinical Badges (${row.rating}★)\n• Zero Waiting Queue Management\n\nIse apne smartphone me open karke check karein aur batayein kaisa laga!\n_Powered by ClinicX AI_`;

  return {
    success: true,
    websiteUrl,
    slug: res.slug,
    clinicName,
    doctorName,
    specialty,
    phone: row.phone,
    city,
    whatsappPitch,
  };
}

async function handleGenerateForWAFlowLead(args: any) {
  const crmFile = getWAFlowCrmFile();
  if (!crmFile) {
    throw new Error(`WAFlow CRM leads database file not found in ${WAFLOW_DATA_DIR}`);
  }

  const rawJson = fs.readFileSync(crmFile, "utf8");
  const data = JSON.parse(rawJson);
  const query = String(args.lead_name_or_phone).toLowerCase().trim();

  const leadIndex = (data.leads || []).findIndex((l: any) => {
    const nameMatch = l.name && l.name.toLowerCase().includes(query);
    const phoneMatch =
      (l.phone && l.phone.includes(query)) ||
      (l.formattedPhone && l.formattedPhone.includes(query));
    return nameMatch || phoneMatch;
  });

  if (leadIndex < 0) {
    throw new Error(`Lead matching '${args.lead_name_or_phone}' was not found in WAFlow CRM.`);
  }

  const lead = data.leads[leadIndex];
  const generated = await handleGenerateClinicWebsite({
    clinic_name: lead.name,
    phone: lead.formattedPhone || lead.phone,
    specialty: lead.category,
    city: lead.city || "Lucknow",
    address: lead.address,
    rating: lead.rating || 4.9,
    reviews_count: lead.reviewsCount || 85,
  });

  if (args.auto_update_crm !== false) {
    lead.website = generated.websiteUrl;
    lead.updatedAt = new Date().toISOString();
    if (!lead.activities) lead.activities = [];
    lead.activities.unshift({
      id: `act_${Date.now()}_mcp`,
      type: "note",
      content: `⚡ MCP 1-Click ClinicX Website generated: ${generated.websiteUrl}`,
      createdAt: new Date().toISOString(),
      author: "ClinicX MCP",
    });

    data.leads[leadIndex] = lead;
    fs.writeFileSync(crmFile, JSON.stringify(data, null, 2), "utf8");
  }

  return {
    success: true,
    lead: {
      id: lead.id,
      name: lead.name,
      phone: lead.formattedPhone || lead.phone,
      stage: lead.stage,
      website: lead.website,
    },
    websiteUrl: generated.websiteUrl,
    whatsappPitch: generated.whatsappPitch,
    crmUpdated: args.auto_update_crm !== false,
  };
}

async function handleSyncAllInterestedLeads(args: any) {
  const crmFile = getWAFlowCrmFile();
  if (!crmFile) {
    throw new Error(`WAFlow CRM leads database file not found in ${WAFLOW_DATA_DIR}`);
  }

  const rawJson = fs.readFileSync(crmFile, "utf8");
  const data = JSON.parse(rawJson);
  const targetStage = (args.stage || "INTERESTED").toUpperCase();
  const limit = typeof args.limit === "number" ? args.limit : 10;

  const matches = (data.leads || []).filter((l: any) => {
    const stageMatch = targetStage === "ALL" || l.stage === targetStage;
    const noWebsite =
      !l.website ||
      l.website === "N/A" ||
      l.website === "none" ||
      l.website.trim() === "";
    return stageMatch && noWebsite;
  });

  const toProcess = matches.slice(0, limit);
  const results = [];

  for (const lead of toProcess) {
    try {
      const gen = await handleGenerateClinicWebsite({
        clinic_name: lead.name,
        phone: lead.formattedPhone || lead.phone,
        specialty: lead.category,
        city: lead.city || "Lucknow",
        address: lead.address,
        rating: lead.rating || 4.9,
        reviews_count: lead.reviewsCount || 85,
      });

      lead.website = gen.websiteUrl;
      lead.updatedAt = new Date().toISOString();
      if (!lead.activities) lead.activities = [];
      lead.activities.unshift({
        id: `act_${Date.now()}_mcp`,
        type: "note",
        content: `⚡ MCP Bulk ClinicX Website generated: ${gen.websiteUrl}`,
        createdAt: new Date().toISOString(),
        author: "ClinicX MCP",
      });

      results.push({
        leadName: lead.name,
        phone: lead.formattedPhone || lead.phone,
        websiteUrl: gen.websiteUrl,
        status: "success",
      });
    } catch (err: any) {
      results.push({
        leadName: lead.name,
        phone: lead.formattedPhone || lead.phone,
        status: "failed",
        error: err.message,
      });
    }
  }

  // Save back to CRM file
  fs.writeFileSync(crmFile, JSON.stringify(data, null, 2), "utf8");

  return {
    processedCount: toProcess.length,
    successCount: results.filter((r) => r.status === "success").length,
    results,
  };
}

async function handleListWAFlowLeads(args: any) {
  const crmFile = getWAFlowCrmFile();
  if (!crmFile) return { leads: [], total: 0 };
  const data = JSON.parse(fs.readFileSync(crmFile, "utf8"));
  let leads = data.leads || [];

  if (args.stage) {
    const stage = args.stage.toUpperCase();
    leads = leads.filter((l: any) => l.stage === stage);
  }

  if (args.search) {
    const s = args.search.toLowerCase();
    leads = leads.filter(
      (l: any) =>
        (l.name && l.name.toLowerCase().includes(s)) ||
        (l.phone && l.phone.includes(s))
    );
  }

  const limit = args.limit || 20;
  return {
    total: leads.length,
    leads: leads.slice(0, limit).map((l: any) => ({
      id: l.id,
      name: l.name,
      phone: l.formattedPhone || l.phone,
      category: l.category,
      city: l.city,
      stage: l.stage,
      priority: l.priority,
      website: l.website,
    })),
  };
}

async function handleBatchCreateFromCsv(args: any) {
  const {
    parseClinicSpreadsheet,
    batchCreateClinicsFromSpreadsheet,
  } = await import("../src/lib/ai-clinic-creator.server");

  let csvText = args.csv_path_or_content;
  if (fs.existsSync(csvText)) {
    csvText = fs.readFileSync(csvText, "utf8");
  }

  const parsed = parseClinicSpreadsheet(csvText, args.default_city || "Lucknow");
  const res = await batchCreateClinicsFromSpreadsheet({
    clinics: parsed,
  });

  return {
    totalProcessed: res.totalProcessed,
    successCount: res.successCount,
    failedCount: res.failedCount,
    sampleCreated: res.results.slice(0, 5),
    exportCsvSnippet: res.exportCsv.slice(0, 500) + "...",
  };
}

// ─── JSON-RPC MCP SERVER LOOP ──────────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

function sendResponse(id: any, result: any) {
  const msg = JSON.stringify({
    jsonrpc: "2.0",
    id,
    result,
  });
  process.stdout.write(msg + "\n");
}

function sendError(id: any, code: number, message: string) {
  const msg = JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
  process.stdout.write(msg + "\n");
}

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const req = JSON.parse(trimmed);
    const { id, method, params } = req;

    if (method === "initialize") {
      return sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "cliniclaunch-mcp",
          version: "1.0.0",
        },
      });
    }

    if (method === "notifications/initialized") {
      // Client handshake complete
      return;
    }

    if (method === "tools/list") {
      return sendResponse(id, { tools: TOOLS });
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const args = params?.arguments || {};

      let resultData: any;
      if (toolName === "generate_clinic_website") {
        resultData = await handleGenerateClinicWebsite(args);
      } else if (toolName === "generate_website_for_waflow_lead") {
        resultData = await handleGenerateForWAFlowLead(args);
      } else if (toolName === "sync_all_interested_waflow_leads") {
        resultData = await handleSyncAllInterestedLeads(args);
      } else if (toolName === "list_waflow_crm_leads") {
        resultData = await handleListWAFlowLeads(args);
      } else if (toolName === "batch_create_from_csv") {
        resultData = await handleBatchCreateFromCsv(args);
      } else {
        return sendError(id, -32601, `Tool not found: ${toolName}`);
      }

      return sendResponse(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(resultData, null, 2),
          },
        ],
      });
    }

    if (method === "ping") {
      return sendResponse(id, {});
    }

    return sendError(id, -32601, `Method not implemented: ${method}`);
  } catch (err: any) {
    sendError(null, -32603, err?.message || "Internal error");
  }
});
