import { PREMIUM_TEMPLATES, TEMPLATE_COMPONENTS, isPremiumTemplate, getPremiumTemplateDefinition, getPremiumTemplateComponent } from "../src/templates/registry.ts";
import { allTemplates, categories } from "../src/features/website-builder/data/templatesData.ts";

const EXPECTED_TEMPLATES = [
  // 1-10 Original
  "aura-care",
  "pulse-motion",
  "dental-atelier",
  "terra-wellness",
  "precision-medical",
  "bloom-pediatrics",
  "noir-signature",
  "digital-health",
  "local-trust",
  "editorial-studio",
  // 11-30 New
  "swiss-medical",
  "coastal-calm",
  "urban-clinical",
  "botanical-wellness",
  "clinical-editorial",
  "neo-bauhaus",
  "soft-luxury",
  "active-recovery",
  "family-first",
  "precision-ortho",
  "neonatal-gentle",
  "dermatology-gallery",
  "neuro-motion",
  "cardio-clarity",
  "dental-pop",
  "rural-community",
  "digital-appointment",
  "heritage-medical",
  "editorial-split",
  "horizon-modern",
];

console.log("=== CLINICX 30 PREMIUM TEMPLATES VERIFICATION ===");

let passed = true;

// 1. Verify all 30 expected templates exist in registry
console.log("\n1. Verifying Registry Definitions...");
if (PREMIUM_TEMPLATES.length !== 30) {
  console.error(`❌ Expected 30 templates in PREMIUM_TEMPLATES, got ${PREMIUM_TEMPLATES.length}`);
  passed = false;
} else {
  console.log(`✅ Exactly 30 templates defined in PREMIUM_TEMPLATES.`);
}

for (const id of EXPECTED_TEMPLATES) {
  const def = getPremiumTemplateDefinition(id);
  if (!def) {
    console.error(`❌ Missing template definition for '${id}'`);
    passed = false;
    continue;
  }

  // Check palette
  const requiredPaletteKeys = ["primary", "secondary", "accent", "background", "surface", "text", "mutedText", "border"];
  for (const key of requiredPaletteKeys) {
    if (!def.palette[key]) {
      console.error(`❌ Template '${id}' missing palette key: ${key}`);
      passed = false;
    }
  }

  // Check typography
  if (!def.typography?.headingFont || !def.typography?.bodyFont) {
    console.error(`❌ Template '${id}' missing typography fields`);
    passed = false;
  }

  // Check component binding
  const comp = getPremiumTemplateComponent(id);
  if (!comp || typeof comp !== "function") {
    console.error(`❌ Template '${id}' has missing or invalid React component in TEMPLATE_COMPONENTS`);
    passed = false;
  }

  // Check isPremiumTemplate
  if (!isPremiumTemplate(id)) {
    console.error(`❌ isPremiumTemplate('${id}') returned false`);
    passed = false;
  }

  console.log(`  ✓ Template [${id}]: "${def.name}" - ${def.tagline} (${def.palette.primary})`);
}

// 2. Verify Website Builder allTemplates has all 30 templates
console.log("\n2. Verifying Website Builder allTemplates & Category...");
const signatureCategory = categories.find((c) => c.id === "signature");
if (!signatureCategory) {
  console.error("❌ 'signature' category missing in templatesData.ts categories");
  passed = false;
} else {
  console.log(`✅ 'signature' category found: "${signatureCategory.label}"`);
}

for (const id of EXPECTED_TEMPLATES) {
  const marketplaceTpl = allTemplates.find((t) => t.id === id);
  if (!marketplaceTpl) {
    console.error(`❌ Template '${id}' missing in allTemplates`);
    passed = false;
  } else {
    console.log(`  ✓ Builder Marketplace [${id}]: "${marketplaceTpl.name}" (category: ${marketplaceTpl.category})`);
  }
}

if (!passed) {
  console.error("\n❌ VERIFICATION FAILED!");
  process.exit(1);
} else {
  console.log("\n🎉 ALL 30 PREMIUM TEMPLATES VERIFIED SUCCESSFULLY!");
}
