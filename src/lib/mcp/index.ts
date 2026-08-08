import { auth, defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import getClinicTool from "./tools/get-clinic";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";

export default defineMcp({
  name: "clinicx-mcp",
  title: "ClinicX MCP",
  version: "0.1.0",
  instructions:
    "Tools for the ClinicX clinic management platform. Use `echo` to verify connectivity and `get_clinic_by_slug` to look up a published clinic's public profile.",
  // Require a verified Supabase-issued OAuth bearer token on every MCP request.
  auth: auth.oauth.issuer({
    issuer: `${supabaseUrl}/auth/v1`,
    acceptedAudiences: ["authenticated"],
    resourceName: "ClinicX MCP",
  }),
  tools: [echoTool, getClinicTool],
});
