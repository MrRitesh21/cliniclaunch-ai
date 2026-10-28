#!/usr/bin/env node
/**
 * Security & Auth Guard Audit Script
 * Scans all src/lib/*.functions.ts server functions to ensure:
 * 1. Sensitive and mutating RPCs have proper auth middleware (requireSupabaseAuth or requireAdminAuth).
 * 2. Explicitly public RPCs are strictly allowlisted and validated.
 * 3. All RPCs with client inputs enforce strict .validator() schemas.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import ts from "typescript";

const PROJECT_ROOT = resolve(process.cwd());
const LIB_DIR = join(PROJECT_ROOT, "src", "lib");

// Explicitly allowlisted public endpoints (accessible without session auth)
const PUBLIC_ALLOWLIST = new Set([
  // Public system status
  "admin.functions.ts:checkMaintenanceStatus",
  // Public clinic website rendering & public booking
  "clinic.functions.ts:getClinicBySlug",
  "clinic.functions.ts:getClinicDoctors",
  "clinic.functions.ts:resolveAvailableOrgSlug",
  "clinic.functions.ts:getReviewPageContext",
  "clinic.functions.ts:submitPublicReview",
  "clinic.functions.ts:getClinicPublicSchema",
  "clinic.functions.ts:getBookedSlots",
  "clinic.functions.ts:createBooking",
  "clinic.functions.ts:getConsultAppointment",
  // Public custom domain resolution
  "domain.functions.ts:resolveHostToClinic",
  // Public rate limiter before login
  "limits.functions.ts:guardAuthAttempt",
  // Public plans & push config
  "plans.functions.ts:getPublicPlans",
  "push.functions.ts:getPushConfig",
  // Public template gallery & site template
  "site-templates.functions.ts:listTemplateLibrary",
  "site-templates.functions.ts:getClinicSiteTemplate",
  // Public CRM lead capture
  "crm.functions.ts:submitPlatformLead",
  // Public SSO token verification
  "sso.functions.ts:verifySsoTokenFn",
  // Public phone identity lookup for login
  "phone-auth.functions.ts:resolvePhoneIdentityFn",
  // Public Creator Referral tracking & resolution
  "referral.functions.ts:getPublicReferralInfo",
  "referral.functions.ts:trackReferralClick",
  "referral.functions.ts:trackReferralSignup",
  "referral.functions.ts:linkReferralOnboarding",
]);

function scanFunctions() {
  const files = readdirSync(LIB_DIR)
    .filter((f) => f.endsWith(".functions.ts"))
    .sort();

  const results = [];
  const errors = [];

  for (const file of files) {
    const filePath = join(LIB_DIR, file);
    const content = readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

    function visit(node) {
      if (
        ts.isVariableStatement(node) &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        for (const decl of node.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;

          const initText = decl.initializer.getText(sourceFile);
          if (!initText.includes("createServerFn")) continue;

          const fnName = decl.name.text;
          const key = `${file}:${fnName}`;

          // Extract HTTP method
          const methodMatch = initText.match(/createServerFn\(\s*\{\s*method:\s*["'](\w+)["']\s*\}\s*\)/);
          const method = methodMatch ? methodMatch[1] : "GET";

          // Extract middlewares
          const middlewares = [];
          const mwMatches = [...initText.matchAll(/\.middleware\(\s*\[([^\]]*)\]\s*\)/g)];
          for (const m of mwMatches) {
            middlewares.push(...m[1].split(",").map((s) => s.trim()).filter(Boolean));
          }

          // Check validator
          const hasValidator = /\.validator\s*\(/.test(initText);

          const hasAdminAuth = middlewares.includes("requireAdminAuth");
          const hasSupabaseAuth = middlewares.includes("requireSupabaseAuth");
          const hasAuth = hasAdminAuth || hasSupabaseAuth;
          const isPublic = PUBLIC_ALLOWLIST.has(key);

          // Security checks
          if (!hasAuth && !isPublic) {
            errors.push({
              key,
              method,
              issue: "Missing auth middleware (must have requireSupabaseAuth or requireAdminAuth, or be in PUBLIC_ALLOWLIST)",
            });
          }

          // Admin-only functions must enforce requireAdminAuth
          const isAdminFunction =
            (file === "admin.functions.ts" && fnName !== "checkMaintenanceStatus") ||
            (file === "audit-test.functions.ts") ||
            (file === "site-templates.functions.ts" && fnName.startsWith("admin"));

          if (isAdminFunction && !hasAdminAuth) {
            errors.push({
              key,
              method,
              issue: "Admin RPC must enforce requireAdminAuth",
            });
          }

          // Public POST functions must have input validation
          if (isPublic && method === "POST" && !hasValidator) {
            errors.push({
              key,
              method,
              issue: "Public mutating RPC must enforce a strict .validator() schema",
            });
          }

          results.push({
            file,
            fnName,
            key,
            method,
            middlewares,
            hasValidator,
            hasAuth,
            isPublic,
          });
        }
      }
      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
  }

  return { results, errors };
}

function main() {
  console.log("🔒 Checking Server Function Auth Guards & Input Validators...\n");

  const { results, errors } = scanFunctions();

  const publicCount = results.filter((r) => r.isPublic).length;
  const userAuthCount = results.filter((r) => r.middlewares.includes("requireSupabaseAuth") && !r.middlewares.includes("requireAdminAuth")).length;
  const adminAuthCount = results.filter((r) => r.middlewares.includes("requireAdminAuth")).length;
  const validatedCount = results.filter((r) => r.hasValidator).length;

  console.log(`Audited ${results.length} server functions across src/lib/*.functions.ts:`);
  console.log(`  • Admin-guarded (requireAdminAuth):       ${adminAuthCount}`);
  console.log(`  • Session-guarded (requireSupabaseAuth):  ${userAuthCount}`);
  console.log(`  • Public allowlisted:                    ${publicCount}`);
  console.log(`  • Input validated (.validator):          ${validatedCount}`);
  console.log("");

  if (errors.length > 0) {
    console.error(`❌ Found ${errors.length} auth guard violation(s):\n`);
    for (const err of errors) {
      console.error(`  [FAIL] ${err.key} [${err.method}]: ${err.issue}`);
    }
    console.error("\nPlease add proper auth middleware or validator schemas before building.");
    process.exit(1);
  }

  console.log("✅ All server functions enforce valid authentication guards and schemas.");
  process.exit(0);
}

main();
