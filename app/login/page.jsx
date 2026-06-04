"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) { router.push("/"); router.refresh(); }
      else setErr("Incorrect password.");
    } catch {
      setErr("Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lt">
      <div className="lt-login">
        <div className="lt-login-card">
          <h1>Clarivue</h1>
          <p>Pipeline Intelligence — enter your password to continue.</p>
          {err && <div className="lt-login-err">{err}</div>}
          <input
            type="password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            autoFocus
          />
          <button onClick={submit} disabled={busy}>{busy ? "Checking…" : "Enter"}</button>
        </div>
      </div>
    </div>
  );
}
