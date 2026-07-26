import json, pathlib, sys, base64, time, re, subprocess
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from qa_authbound_lib import req, APP

SCRATCH = pathlib.Path(sys.argv[1])
ROOT = pathlib.Path(__file__).parent.parent
ADMIN = (SCRATCH / "t_admin").read_text().strip()
OWNER = (SCRATCH / "t_owner").read_text().strip()
DEMO_ORG = "11111111-1111-4111-8111-111111111111"


def tamper(tok):
    h, p, s = tok.split(".")
    return f"{h}.{p}.{('B' if s[0] != 'B' else 'C')}{s[1:]}"


def expire(tok):
    h, p, s = tok.split(".")
    pad = p + "=" * (-len(p) % 4)
    c = json.loads(base64.urlsafe_b64decode(pad))
    c["exp"] = int(time.time()) - 86400
    c["iat"] = int(time.time()) - 90000
    np = base64.urlsafe_b64encode(json.dumps(c).encode()).decode().rstrip("=")
    return f"{h}.{np}.{s}"


_enc_cache = {}
def enc(data):
    key = json.dumps(data, sort_keys=True)
    if key not in _enc_cache:
        out = subprocess.run(
            ["node", str(ROOT / "scripts/qa_encode_payload.mjs"), key],
            capture_output=True, text=True, cwd=str(ROOT), timeout=60)
        _enc_cache[key] = json.loads(out.stdout)
    return _enc_cache[key]


def discover(module):
    st, body = req(f"{APP}/src/lib/{module}")
    if st != 200:
        print(f"!! could not load {module}: {st}")
        return []
    return [(m.group(1), m.group(2), m.group(3)) for m in re.finditer(
        r'export const (\w+) = createServerFn\(\{\s*method:\s*"(\w+)"\s*\}\)'
        r'\.handler\(createClientRpc\("([^"]+)"\)\)', body)]


# Args mirroring the real .inputValidator(z.object({...})) schemas in
# src/lib/admin.functions.ts, so every probe clears validation and actually
# reaches getVerifiedAdmin(). Wrong field names make a probe die in Zod first,
# which looks like a pass but proves nothing.
ARGS = {
    "getDoctorDetails": {"id": DEMO_ORG},
    "updateDoctorProfile": {"id": DEMO_ORG, "doctorName": "QA Probe"},
    "changeDoctorPlan": {"clinicId": DEMO_ORG, "planId": "professional"},
    "issueRefund": {"clinicId": DEMO_ORG, "amount": 1, "reason": "qa"},
    "toggleDoctorSuspension": {"id": DEMO_ORG, "reason": "qa"},
    "deleteDoctorAccount": {"id": DEMO_ORG},
    "clearDoctorPatientsData": {"id": DEMO_ORG},
    "updatePlanDetails": {"id": DEMO_ORG, "monthlyPrice": 1, "yearlyPrice": 1,
                          "features": ["qa"]},
    "createCoupon": {"code": "QAPROBE", "discountType": "percent",
                     "discountValue": 1, "maxUses": 1},
    "toggleCouponActive": {"code": "QAPROBE", "active": False},
    "deleteCoupon": {"code": "QAPROBE"},
    "toggleFeatureFlag": {"key": "qa_probe_flag", "enabled": False},
    "updateFeatureFlagOverrides": {"key": "qa_probe_flag", "plans": [],
                                   "doctorIds": []},
    "createAnnouncement": {"title": "qa", "body": "qa", "type": "info",
                           "targetPlans": []},
    "toggleAnnouncementActive": {"id": DEMO_ORG, "active": False},
    "createEmailCampaign": {"name": "qa", "subject": "qa", "bodyHtml": "qa",
                            "targetSegment": "all", "status": "draft"},
    "runDatabaseCleanup": {"tool": "sessions"},
    "getSupportTicket": {"id": DEMO_ORG},
    "replySupportTicket": {"ticketId": DEMO_ORG, "body": "qa"},
    "updateTicketStatus": {"id": DEMO_ORG, "status": "open", "priority": "low"},
    "createAdminUser": {"email": "qa-ownerb@clinicx.test", "role": "support"},
    "deleteAdminUser": {"id": DEMO_ORG},
    "testIntegration": {"provider": "razorpay", "settings": {}},
    "impersonateDoctor": {"clinicId": DEMO_ORG},
    "resetDoctorPassword": {"clinicId": DEMO_ORG},
    "toggleClinicPublish": {"clinicId": DEMO_ORG},
    "updateSubscriptionStatus": {"id": DEMO_ORG, "action": "reactivate"},
    "createPlan": {"slug": "qa-probe-plan", "name": "QA Probe",
                   "monthlyPrice": 0, "yearlyPrice": 0},
    "deletePlan": {"id": DEMO_ORG},
    # z.record(z.string(), z.string()) — not a z.object
    "saveSystemSettings": {"qa_probe_setting": "qa"},
}

# Mutating fns: probe ONLY with unauthorised identities (must be rejected).
# Never run these with the real admin token — that would actually mutate data.
DESTRUCTIVE = {
    "updateDoctorProfile", "changeDoctorPlan", "issueRefund",
    "toggleDoctorSuspension", "deleteDoctorAccount", "clearDoctorPatientsData",
    "updatePlanDetails", "createCoupon", "toggleCouponActive", "deleteCoupon",
    "toggleFeatureFlag", "updateFeatureFlagOverrides", "createAnnouncement",
    "toggleAnnouncementActive", "createEmailCampaign", "runDatabaseCleanup",
    "replySupportTicket", "updateTicketStatus", "createAdminUser",
    "deleteAdminUser", "saveSystemSettings", "testIntegration",
    "impersonateDoctor", "resetDoctorPassword", "toggleClinicPublish",
    "updateSubscriptionStatus", "createPlan", "deletePlan",
}

DATA_MARKERS = re.compile(
    r'\\?"(email|phone|patient|full_name|totalDoctors|revenue|mrr|amount|'
    r'razorpay|subscription|specialization|consultation_fee)\\?"', re.I)


def probe(name, method, fid, tok):
    p = enc(ARGS.get(name))
    url = f"{APP}/_serverFn/{fid}"
    if method == "GET" and p["query"]:
        url += "?" + p["query"]
    h = {"x-tsr-serverFn": "true", "accept": "application/json"}
    if tok:
        h["Authorization"] = f"Bearer {tok}"
    body = None
    if method == "POST" and p["body"]:
        h["content-type"] = "application/json"
        body = p["body"].encode()
    return req(url, method, h, body, timeout=25)


VALIDATION = re.compile(r'invalid_type|invalid_string|too_small|invalid_enum|'
                        r'ZodError|"issues"', re.I)


def classify(st, body):
    low = body.lower()
    rejected = st in (401, 403) or "unauthorized" in low or "forbidden" in low
    # Zod inputValidator runs BEFORE getVerifiedAdmin(), so a validation error
    # means the probe never reached the guard. Inconclusive, not a pass.
    inconclusive = not rejected and bool(VALIDATION.search(body))
    leaked = (200 <= st < 300) and not rejected and bool(DATA_MARKERS.search(body))
    return rejected, leaked, inconclusive


if __name__ == "__main__":
    fns = discover("admin.functions.ts")
    print(f"discovered {len(fns)} admin server functions")
    readonly = [f for f in fns if f[0] not in DESTRUCTIVE]
    print(f"read-only (safe for admin control): {len(readonly)}\n")

    print("=== CONTROL: real super_admin must SUCCEED on read-only fns ===")
    ctrl_ok = ctrl_tot = 0
    for name, method, fid in readonly:
        st, body = probe(name, method, fid, ADMIN)
        rej, _, _ = classify(st, body)
        ok = 200 <= st < 300 and not rej
        ctrl_tot += 1
        ctrl_ok += ok
        if not ok:
            print(f"  FAIL [{st}] {name}: {body[:110]}")
    print(f"  control: {ctrl_ok}/{ctrl_tot} read-only fns succeeded with admin token")
    if ctrl_ok < ctrl_tot:
        print("  !! control imperfect — negative results on failing fns are INCONCLUSIVE\n")
    else:
        print("  control clean — negative results below are meaningful\n")

    identities = [
        ("A. no-auth-header", None),
        ("B. clinic-owner(non-admin)", OWNER),
        ("C. tampered-signature", tamper(ADMIN)),
        ("D. expired-exp", expire(ADMIN)),
        ("E. garbage-token", "not.a.jwt"),
    ]

    results, leaks = [], []
    for label, tok in identities:
        rej_n = inc_n = 0
        for name, method, fid in fns:
            st, body = probe(name, method, fid, tok)
            rej, leaked, inc = classify(st, body)
            rej_n += rej
            inc_n += inc
            if leaked:
                leaks.append((label, name, st, body[:400]))
                print(f"  LEAK! [{st}] {label} / {name}: {body[:180]}")
            if inc:
                print(f"  inconclusive (died in Zod) {label} / {name}")
            results.append({"identity": label, "fn": name, "method": method,
                            "status": st, "rejected": rej, "leaked": leaked,
                            "inconclusive": inc, "snippet": body[:250]})
        print(f"{label:<28} rejected {rej_n}/{len(fns)}  inconclusive {inc_n}")

    inc_tot = sum(r["inconclusive"] for r in results)
    print(f"\n=== SUMMARY ===\nprobes: {len(results)}   "
          f"LEAKS: {len(leaks)}   INCONCLUSIVE: {inc_tot}")
    (SCRATCH / "test3_results.json").write_text(json.dumps(results, indent=1))
