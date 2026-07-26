import json, urllib.request, urllib.error, sys, re, pathlib

L_URL = "http://127.0.0.1:54321"
L_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
APP = "http://localhost:8080"


def req(url, method="GET", headers=None, body=None, timeout=25):
    r = urllib.request.Request(url, method=method, data=body)
    for k, v in (headers or {}).items():
        r.add_header(k, v)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        return -1, f"{type(e).__name__}: {e}"


def mint(email):
    st, body = req(
        f"{L_URL}/auth/v1/token?grant_type=password",
        "POST",
        {"apikey": L_ANON, "Content-Type": "application/json"},
        json.dumps({"email": email, "password": "QaTestPass123!"}).encode(),
    )
    if st != 200:
        return None, f"mint failed {st}: {body[:200]}"
    return json.loads(body)["access_token"], None


if __name__ == "__main__":
    admin, e1 = mint("qa-admin@clinicx.test")
    owner, e2 = mint("qa-owner-a@clinicx.test")
    print("admin token:", "OK len=%d" % len(admin) if admin else e1)
    print("owner token:", "OK len=%d" % len(owner) if owner else e2)
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    if admin:
        (out / "t_admin").write_text(admin)
    if owner:
        (out / "t_owner").write_text(owner)
