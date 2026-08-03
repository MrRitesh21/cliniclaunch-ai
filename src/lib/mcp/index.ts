import { defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import getClinicTool from "./tools/get-clinic";

export default defineMcp({
  name: "clinicos-mcp",
  title: "ClinicX MCP",
  version: "0.1.0",
  instructions:
    "Tools for the ClinicX clinic management platform. Use `echo` to verify connectivity and `get_clinic_by_slug` to look up a published clinic's public profile.",
  tools: [echoTool, getClinicTool],
});
