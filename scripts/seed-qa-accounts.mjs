// Seeds QA test accounts against a LOCAL Supabase stack only.
//
// Creates two clinics under two separate owners so cross-tenant isolation can be
// proven, plus a super_admin and a deliberately role-less user to test /admin/*
// rejection. Refuses to run against a non-local SUPABASE_URL — these are
// throwaway credentials and must never touch a hosted project.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) {
  console.error(`Refusing to seed non-local Supabase: ${url}`);
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "QAtest!2345";

const USERS = [
  { key: "ownerA", email: "qa-owner-a@clinicx.test" },
  { key: "ownerB", email: "qa-owner-b@clinicx.test" },
  { key: "admin", email: "qa-admin@clinicx.test" },
  { key: "nonAdmin", email: "qa-nonadmin@clinicx.test" },
];

const CLINICS = {
  ownerA: {
    slug: "qa-clinic-a",
    clinic_name: "QA Clinic A",
    doctor_name: "Dr. A Sharma",
    specialization: "Dermatology",
    qualification: "MBBS, MD",
    experience_years: 8,
    phone: "+919000000001",
    email: "qa-owner-a@clinicx.test",
    address: "1 Test Road, Pune",
    consultation_fee: 500,
  },
  ownerB: {
    slug: "qa-clinic-b",
    clinic_name: "QA Clinic B",
    doctor_name: "Dr. B Verma",
    specialization: "Dentistry",
    qualification: "BDS",
    experience_years: 5,
    phone: "+919000000002",
    email: "qa-owner-b@clinicx.test",
    address: "2 Test Road, Mumbai",
    consultation_fee: 700,
  },
};

async function upsertUser(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (!error) return data.user;

  // Re-runnable: fall back to the existing user when it was already seeded,
  // resetting the password so a partial earlier run can't leave it stale.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw listErr;
  const found = list.users.find((u) => u.email === email);
  if (!found) throw error;
  const { error: updErr } = await admin.auth.admin.updateUserById(found.id, {
    password: PASSWORD,
    email_confirm: true,
  });
  if (updErr) throw updErr;
  return found;
}

const ids = {};
for (const u of USERS) {
  const user = await upsertUser(u.email);
  ids[u.key] = user.id;
  console.log(`user  ${u.email.padEnd(28)} ${user.id}`);
}

// clinics.organization_id is NOT NULL: each clinic needs an organization plus
// an owner membership row before the clinic row can be created.
async function upsertOrg(slug, name, ownerId) {
  const { data: existing, error: findErr } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (findErr) throw findErr;
  let orgId = existing?.id;
  if (!orgId) {
    const { data, error } = await admin
      .from("organizations")
      .insert({ slug, name, business_type: "clinic" })
      .select("id")
      .single();
    if (error) throw error;
    orgId = data.id;
  }
  const { error: memErr } = await admin
    .from("organization_members")
    .upsert(
      { organization_id: orgId, user_id: ownerId, role: "owner" },
      { onConflict: "organization_id,user_id" },
    );
  if (memErr) throw memErr;
  return orgId;
}

for (const [ownerKey, clinic] of Object.entries(CLINICS)) {
  const orgId = await upsertOrg(clinic.slug, clinic.clinic_name, ids[ownerKey]);
  const { error } = await admin
    .from("clinics")
    .upsert({ ...clinic, owner_id: ids[ownerKey], organization_id: orgId }, { onConflict: "slug" });
  if (error) throw error;
  console.log(`clinic ${clinic.slug.padEnd(28)} owner=${ids[ownerKey]} org=${orgId}`);
}

const { error: roleErr } = await admin
  .from("user_roles")
  .upsert({ user_id: ids.admin, role: "super_admin" }, { onConflict: "user_id,role" });
if (roleErr) throw roleErr;
console.log(`role   super_admin -> qa-admin@clinicx.test`);
console.log(`\nAll accounts use password: ${PASSWORD}`);
console.log(`qa-nonadmin@clinicx.test intentionally has NO role row.`);
