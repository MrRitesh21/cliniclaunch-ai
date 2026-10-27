# ClinicLaunch & WAFlow CRM MCP Server 🚀

A high-performance Model Context Protocol (MCP) server that connects your **WAFlow CRM (`waflow.digiwil.com`)** and **ClinicLaunch AI (`clinicx.digiwil.com`)** together.

It allows any AI Agent (Claude, Cursor, Antigravity) or WAFlow CRM to generate complete, live, published doctor/clinic websites with WhatsApp OPD booking in **1-click**.

---

## 🛠️ Available MCP Tools

| Tool Name | Description |
| :--- | :--- |
| **`generate_clinic_website`** | Generates a full clinic website at `https://clinicx.digiwil.com/c/[slug]` with doctor bio, 6 clinical services with pricing, verified Google review badges, and WhatsApp OPD booking. |
| **`generate_website_for_waflow_lead`** | **1-Click Lead Converter:** Finds any lead by name or phone in WAFlow CRM, builds their ClinicX website, links it directly into their CRM profile, and produces a ready-to-send WhatsApp pitch. |
| **`sync_all_interested_waflow_leads`** | Automatically finds all **Interested** leads in WAFlow CRM without a website, generates websites in bulk, and updates all records. |
| **`list_waflow_crm_leads`** | Lists CRM leads with filters by stage (`INTERESTED`, `NEW`, `WON`), search query, and priority. |
| **`batch_create_from_csv`** | Batch creates 100+ clinic websites from an Excel/CSV file (Google Maps scraper) and exports live URLs. |

---

## ⚙️ Configuration

### 1. Claude Desktop Configuration
Add this to your Claude Desktop config file:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "cliniclaunch": {
      "command": "bun",
      "args": [
        "/Users/ritesh/Downloads/cliniclaunch-ai-main 2/mcp-server/index.ts"
      ]
    }
  }
}
```

*(If using Node.js instead of Bun, replace `"command": "bun"` with `"command": "node"`).*

---

### 2. Cursor Configuration (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "cliniclaunch": {
      "command": "bun",
      "args": [
        "/Users/ritesh/Downloads/cliniclaunch-ai-main 2/mcp-server/index.ts"
      ]
    }
  }
}
```

---

## 💡 Example Prompts You Can Give to AI Agents

- *"Generate a clinic website for Active Life physiotherapy clinic with phone 919455094720 in Lucknow"*
- *"Find the lead 'Active Life' in WAFlow CRM and generate their ClinicX website in 1-click"*
- *"Find all Interested leads in WAFlow CRM and generate websites for all of them"*
- *"Give me the WhatsApp pitch message for Active Life with their live website link"*

---

## 🌐 Direct REST API (For CRM & Webhooks)

You can also call the ClinicLaunch API directly from any backend or webhook:

**Endpoint:** `POST https://clinicx.digiwil.com/api/public/clinic-generate`  
**Headers:** `Content-Type: application/json`  
**Payload:**
```json
{
  "clinicName": "Active Life Physiotherapy Clinic",
  "phone": "919455094720",
  "specialty": "Physiotherapy & Rehabilitation",
  "city": "Lucknow",
  "rating": 4.9,
  "reviewsCount": 85
}
```

**Response:**
```json
{
  "ok": true,
  "slug": "active-life-physiotherapy-clinic-lucknow",
  "url": "https://clinicx.digiwil.com/c/active-life-physiotherapy-clinic-lucknow",
  "whatsappPitch": "Namaste Active Life...\n🌐 https://clinicx.digiwil.com/c/active-life-physiotherapy-clinic-lucknow"
}
```
