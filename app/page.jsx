"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Upload, Sparkles, Trash2, Download, X, FileText, Image as ImageIcon, Check, Inbox, Clock, CornerDownRight, Plus, Search, LayoutGrid, FileInput, TrendingUp, Target, UserPlus, Table2, AlertTriangle, Activity, Filter, LogOut } from "lucide-react";

const STAGES = ["New", "Contacted", "Discovery booked", "Proposal sent", "Negotiating", "Won", "Lost"];
const FUNNEL = ["New", "Contacted", "Discovery booked", "Proposal sent", "Negotiating", "Won"];
const SOURCES = ["Email", "LinkedIn", "Call", "Referral", "Event", "Note", "Other"];
const DEAL_TYPES = ["Buyer", "Partnership", "Distributor", "Reseller", "Pilot", "Investor", "Other"];
const ADVANCING = ["Negotiating", "Won"];
const STAGE_COLOR = { "New": "#8a8f84", "Contacted": "#3f6f9e", "Discovery booked": "#0e5b4f", "Proposal sent": "#caa24a", "Negotiating": "#bf4f2a", "Won": "#2f7d4f", "Lost": "#a04545" };
const DEAL_COLOR = { "Buyer": "#0e5b4f", "Partnership": "#3f6f9e", "Distributor": "#caa24a", "Reseller": "#8a6fb0", "Pilot": "#bf4f2a", "Investor": "#2f7d4f", "Other": "#8a8f84" };
const DAY = 86400000;
const STALE = 14;

let _id = 0;
const uid = (p = "x") => `${p}${Date.now().toString(36)}${(_id++).toString(36)}`;
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (ts) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const splitTags = (s) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);
const uniq = (a) => [...new Set(a)];
const lastTouchAt = (a) => Math.max(...a.timeline.map((t) => t.at), a.createdAt || 0);
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

export default function Pipeline() {
  const [view, setView] = useState("intake");
  const [dump, setDump] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [staged, setStaged] = useState([]);
  const [accts, setAccts] = useState([]);
  const [ready, setReady] = useState(false);
  const [drag, setDrag] = useState(false);
  const [toast, setToast] = useState("");
  const [modalId, setModalId] = useState(null);
  const [openRaw, setOpenRaw] = useState({});
  const [noteDraft, setNoteDraft] = useState({});
  const [q, setQ] = useState("");
  const fileRef = useRef(null);
  const acctsRef = useRef([]);
  const timers = useRef({});

  useEffect(() => { acctsRef.current = accts; }, [accts]);

  const refetch = useCallback(async () => {
    try { const r = await fetch("/api/accounts"); const d = await r.json(); if (r.ok) setAccts(d.accounts || []); } catch (e) {}
  }, []);

  useEffect(() => { (async () => { await refetch(); setReady(true); })(); }, [refetch]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const scheduleSave = (id) => {
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      const a = acctsRef.current.find((x) => x.id === id);
      if (!a) return;
      try { await fetch(`/api/accounts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) }); } catch (e) {}
    }, 700);
  };
  const mutate = (id, fn) => { setAccts((prev) => prev.map((a) => (a.id === id ? fn(a) : a))); scheduleSave(id); };

  const logout = async () => { try { await fetch("/api/auth", { method: "DELETE" }); } catch (e) {} window.location.href = "/login"; };

  const readFile = (file) => new Promise((resolve) => {
    const isText = /text|csv|json|markdown/i.test(file.type) || /\.(txt|md|csv|json|log)$/i.test(file.name);
    const reader = new FileReader();
    if (isText) { reader.onload = () => resolve({ id: uid("f"), name: file.name, kind: "text", text: reader.result }); reader.readAsText(file); }
    else { reader.onload = () => resolve({ id: uid("f"), name: file.name, kind: file.type.includes("pdf") ? "pdf" : "image", mediaType: file.type || "application/octet-stream", base64: String(reader.result).split(",")[1] }); reader.readAsDataURL(file); }
  });
  const addFiles = async (list) => { const read = await Promise.all(Array.from(list || []).map(readFile)); setFiles((f) => [...f, ...read]); };
  const onDrop = async (e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) await addFiles(e.dataTransfer.files); };

  const buildContent = () => {
    const content = [];
    files.forEach((f) => {
      if (f.kind === "pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.base64 } });
      else if (f.kind === "image") content.push({ type: "image", source: { type: "base64", media_type: f.mediaType, data: f.base64 } });
    });
    let txt = dump.trim();
    const tf = files.filter((f) => f.kind === "text");
    if (tf.length) txt += (txt ? "\n\n" : "") + tf.map((f) => `--- ${f.name} ---\n${f.text}`).join("\n\n");
    content.push({ type: "text", text: txt || "Analyze the attached file(s) for sales signal." });
    return content;
  };
  const rawTextOf = () => {
    let t = dump.trim();
    const tf = files.filter((f) => f.kind === "text");
    if (tf.length) t += (t ? "\n\n" : "") + tf.map((f) => `--- ${f.name} ---\n${f.text}`).join("\n\n");
    const bin = files.filter((f) => f.kind !== "text").map((f) => `[attached file: ${f.name}]`);
    if (bin.length) t += (t ? "\n\n" : "") + bin.join("\n");
    return t;
  };

  const extract = async () => {
    if (!dump.trim() && files.length === 0) { setErr("Paste some content or attach a file first."); return; }
    setErr(""); setBusy(true);
    try {
      const content = buildContent();
      const roster = accts.map((a) => ({ id: a.id, name: a.name, contacts: a.contacts.map((c) => c.name) }));
      const res = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, roster }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "extract failed");
      const raw = rawTextOf();
      const rows = (data.leads || []).map((p) => ({
        id: uid("s"),
        matchId: accts.some((a) => a.id === p.matchId) ? p.matchId : null,
        name: p.name || "",
        dealType: DEAL_TYPES.includes(p.dealType) ? p.dealType : "Buyer",
        contacts: (p.contacts || []).map((c) => ({ id: uid("ct"), name: c.name || "", role: c.role || "", contact: c.contact || "" })),
        source: SOURCES.includes(p.source) ? p.source : "Other",
        stage: STAGES.includes(p.stage) ? p.stage : "New",
        lastContact: p.lastContact || today(),
        nextAction: p.nextAction || "",
        summary: p.summary || "",
        anglesText: (p.angles || []).join(", "),
        problemsText: (p.problems || []).join(", "),
        rawText: raw,
      }));
      if (rows.length === 0) setErr("No opportunity found in that content.");
      if (rows.length && rows[0].contacts.length === 0) rows[0].contacts.push({ id: uid("ct"), name: "", role: "", contact: "" });
      setStaged((cur) => [...cur, ...rows]);
      setDump(""); setFiles([]);
    } catch (e) { setErr("Couldn't read that — try again, or paste the text directly."); }
    finally { setBusy(false); }
  };

  const editStaged = (id, k, v) => setStaged((s) => s.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
  const editStContact = (sid, cid, k, v) => setStaged((s) => s.map((r) => (r.id === sid ? { ...r, contacts: r.contacts.map((c) => (c.id === cid ? { ...c, [k]: v } : c)) } : r)));
  const addStContact = (sid) => setStaged((s) => s.map((r) => (r.id === sid ? { ...r, contacts: [...r.contacts, { id: uid("ct"), name: "", role: "", contact: "" }] } : r)));
  const rmStContact = (sid, cid) => setStaged((s) => s.map((r) => (r.id === sid ? { ...r, contacts: r.contacts.filter((c) => c.id !== cid) } : r)));
  const dropStaged = (id) => setStaged((s) => s.filter((r) => r.id !== id));

  const commit = async () => {
    if (staged.length === 0) return;
    setBusy(true);
    try {
      const existingById = new Map(acctsRef.current.map((a) => [a.id, a]));
      const pendingUpdates = new Map();
      const pendingCreates = [];

      for (const s of staged) {
        const cleanContacts = s.contacts.filter((c) => c.name.trim() || c.contact.trim());
        const touch = { id: uid("t"), at: new Date(s.lastContact + "T12:00:00").getTime() || Date.now(), source: s.source, stage: s.stage, summary: s.summary, nextAction: s.nextAction, rawText: s.rawText, angles: splitTags(s.anglesText), problems: splitTags(s.problemsText) };
        const existing = s.matchId ? existingById.get(s.matchId) : null;

        if (!existing) {
          pendingCreates.push({ name: s.name || "Untitled", dealType: s.dealType, stage: s.stage, nextAction: s.nextAction, contacts: cleanContacts, timeline: [touch] });
          continue;
        }

        const current = pendingUpdates.get(existing.id) || { ...existing, contacts: [...existing.contacts], timeline: [...existing.timeline] };
        cleanContacts.forEach((c) => {
          if (c.name && !current.contacts.some((m) => m.name.toLowerCase() === c.name.toLowerCase())) current.contacts.push(c);
        });
        current.stage = s.stage;
        current.dealType = current.dealType || s.dealType;
        current.nextAction = s.nextAction || current.nextAction;
        current.timeline.push(touch);
        pendingUpdates.set(existing.id, current);
      }

      for (const updated of pendingUpdates.values()) {
        await fetch(`/api/accounts/${updated.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
      }
      for (const created of pendingCreates) {
        await fetch("/api/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(created) });
      }

      await refetch();
      flash(`${staged.length} logged`); setStaged([]); setView("dashboard");
    } catch (e) { setErr("Couldn't save — check your connection and try again."); }
    finally { setBusy(false); }
  };

  const editAcct = (id, k, v) => mutate(id, (a) => ({ ...a, [k]: v }));
  const editContact = (aid, cid, k, v) => mutate(aid, (a) => ({ ...a, contacts: a.contacts.map((c) => (c.id === cid ? { ...c, [k]: v } : c)) }));
  const addContact = (aid) => mutate(aid, (a) => ({ ...a, contacts: [...a.contacts, { id: uid("ct"), name: "", role: "", contact: "" }] }));
  const rmContact = (aid, cid) => mutate(aid, (a) => ({ ...a, contacts: a.contacts.filter((c) => c.id !== cid) }));
  const addNote = (id) => {
    const txt = (noteDraft[id] || "").trim(); if (!txt) return;
    mutate(id, (a) => ({ ...a, timeline: [...a.timeline, { id: uid("t"), at: Date.now(), source: "Note", stage: a.stage, summary: txt, nextAction: "", rawText: "", angles: [], problems: [] }] }));
    setNoteDraft((d) => ({ ...d, [id]: "" }));
  };
  const deleteAcct = async (id) => {
    if (!window.confirm("Delete this account and its whole timeline?")) return;
    try { await fetch(`/api/accounts/${id}`, { method: "DELETE" }); } catch (e) {}
    setAccts((p) => p.filter((a) => a.id !== id)); setModalId(null);
  };

  const anglesOf = (a) => uniq(a.timeline.flatMap((t) => t.angles || []));
  const problemsOf = (a) => uniq(a.timeline.flatMap((t) => t.problems || []));

  // ---------- stats ----------
  const now = Date.now();
  const total = accts.length;
  const open = accts.filter((a) => !["Won", "Lost"].includes(a.stage));
  const won = accts.filter((a) => a.stage === "Won").length;
  const lost = accts.filter((a) => a.stage === "Lost").length;
  const closed = won + lost;
  const pastDisc = accts.filter((a) => STAGES.indexOf(a.stage) >= 2 && a.stage !== "Lost").length;
  const stageCounts = STAGES.reduce((m, st) => ({ ...m, [st]: accts.filter((a) => a.stage === st).length }), {});
  const allGaps = [];
  accts.forEach((a) => { const ts = a.timeline.map((t) => t.at).sort((x, y) => x - y); for (let i = 1; i < ts.length; i++) allGaps.push((ts[i] - ts[i - 1]) / DAY); });
  const avgGap = allGaps.length ? Math.round(allGaps.reduce((s, g) => s + g, 0) / allGaps.length) : null;
  const stale = open.map((a) => ({ a, age: Math.round((now - lastTouchAt(a)) / DAY) })).filter((x) => x.age >= STALE).sort((x, y) => y.age - x.age);
  const totalTouches = accts.reduce((s, a) => s + a.timeline.length, 0);
  const touches7 = accts.reduce((s, a) => s + a.timeline.filter((t) => t.at >= now - 7 * DAY).length, 0);
  const new7 = accts.filter((a) => (a.createdAt || 0) >= now - 7 * DAY).length;
  const avgTouches = total ? (totalTouches / total).toFixed(1) : "0";
  const countBy = (fn) => accts.reduce((m, a) => { const k = fn(a); m[k] = (m[k] || 0) + 1; return m; }, {});
  const dealMix = countBy((a) => a.dealType || "Other");
  const srcMix = countBy((a) => { const ts = [...a.timeline].sort((x, y) => x.at - y.at); return ts[0]?.source || "Other"; });

  const rankStats = (kind) => {
    const map = {};
    accts.forEach((a) => { const good = ADVANCING.includes(a.stage); uniq(a.timeline.flatMap((t) => t[kind] || [])).forEach((tag) => { map[tag] = map[tag] || { count: 0, adv: 0 }; map[tag].count++; if (good) map[tag].adv++; }); });
    return Object.entries(map).map(([tag, v]) => ({ tag, ...v })).sort((x, y) => y.count - x.count || y.adv - x.adv).slice(0, 6);
  };
  const angleRank = rankStats("angles"), problemRank = rankStats("problems");
  const maxA = Math.max(1, ...angleRank.map((r) => r.count)), maxP = Math.max(1, ...problemRank.map((r) => r.count));
  const funnelMax = Math.max(1, ...FUNNEL.map((st) => stageCounts[st]));

  const exportCSV = () => {
    const head = ["Account", "Deal type", "Contacts", "Stage", "Next action", "Angles pitched", "Problems landed", "Touches", "Last touch", "Latest read"];
    const rows = accts.map((a) => { const last = a.timeline[a.timeline.length - 1] || {}; return [a.name, a.dealType, a.contacts.map((c) => `${c.name}${c.role ? ` (${c.role})` : ""}`).join("; "), a.stage, a.nextAction, anglesOf(a).join("; "), problemsOf(a).join("; "), a.timeline.length, new Date(lastTouchAt(a)).toISOString().slice(0, 10), last.summary || ""]; });
    const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const b = new Blob([csv], { type: "text/csv" }); const u = URL.createObjectURL(b); const el = document.createElement("a"); el.href = u; el.download = "clarivue-pipeline.csv"; el.click(); URL.revokeObjectURL(u);
  };

  const filtered = accts.filter((a) => (a.name + " " + a.dealType + " " + a.contacts.map((c) => c.name + c.role).join(" ")).toLowerCase().includes(q.toLowerCase()));
  const dtag = (t) => { const c = DEAL_COLOR[t] || "#8a8f84"; return { background: c + "1f", color: c }; };

  const Rank = ({ r, max, color }) => (
    <div className="lt-rank">
      <div className="lt-rank-top"><span className="lt-rank-l">{r.tag}</span><span className="lt-rank-r">{r.count} {r.count === 1 ? "deal" : "deals"}{r.adv > 0 && <> · <b>{r.adv} advancing</b></>}</span></div>
      <div className="lt-track2"><div className="lt-fill2" style={{ width: `${(r.count / max) * 100}%`, background: color }} /></div>
    </div>
  );

  const StagedCard = ({ s }) => {
    const match = accts.find((a) => a.id === s.matchId);
    return (
      <div className="lt-scard">
        <div className="lt-srow">
          {match ? <span className="lt-tag exist">↳ updates {match.name}</span> : <span className="lt-tag new">+ new account</span>}
          <select className="lt-sel" value={s.matchId || ""} onChange={(e) => editStaged(s.id, "matchId", e.target.value || null)} style={{ marginLeft: "auto" }}>
            <option value="">New account</option>{accts.map((a) => <option key={a.id} value={a.id}>↳ {a.name}</option>)}
          </select>
          <button className="lt-btn danger" onClick={() => dropStaged(s.id)}><X size={13} /></button>
        </div>
        <div className="lt-grid">
          <div className="lt-f"><label>Account / Org</label><input className="lt-in" value={s.name} onChange={(e) => editStaged(s.id, "name", e.target.value)} /></div>
          <div className="lt-f"><label>Deal type</label><select className="lt-sel" style={{ width: "100%" }} value={s.dealType} onChange={(e) => editStaged(s.id, "dealType", e.target.value)}>{DEAL_TYPES.map((x) => <option key={x}>{x}</option>)}</select></div>
        </div>
        <div className="lt-f full" style={{ marginTop: 9 }}>
          <label>Contacts</label>
          {s.contacts.map((c) => (
            <div className="lt-contact" key={c.id}>
              <input className="lt-in" placeholder="Name" value={c.name} onChange={(e) => editStContact(s.id, c.id, "name", e.target.value)} />
              <input className="lt-in" placeholder="Role" value={c.role} onChange={(e) => editStContact(s.id, c.id, "role", e.target.value)} />
              <input className="lt-in mono" placeholder="email / handle" value={c.contact} onChange={(e) => editStContact(s.id, c.id, "contact", e.target.value)} />
              <button className="lt-cx" onClick={() => rmStContact(s.id, c.id)}><X size={14} /></button>
            </div>
          ))}
          <button className="lt-addc" onClick={() => addStContact(s.id)}><UserPlus size={13} /> Add contact</button>
        </div>
        <div className="lt-grid" style={{ marginTop: 9 }}>
          <div className="lt-f"><label>Stage</label><select className="lt-sel" style={{ width: "100%" }} value={s.stage} onChange={(e) => editStaged(s.id, "stage", e.target.value)}>{STAGES.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div className="lt-f"><label>Source · Date</label><div style={{ display: "flex", gap: 6 }}><select className="lt-sel" value={s.source} onChange={(e) => editStaged(s.id, "source", e.target.value)}>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select><input className="lt-in mono" value={s.lastContact} onChange={(e) => editStaged(s.id, "lastContact", e.target.value)} /></div></div>
          <div className="lt-f full"><label>Sales read — what happened</label><textarea className="lt-in" value={s.summary} onChange={(e) => editStaged(s.id, "summary", e.target.value)} /></div>
          <div className="lt-f full"><label>Angle(s) pitched</label><input className="lt-in" value={s.anglesText} onChange={(e) => editStaged(s.id, "anglesText", e.target.value)} placeholder="comma-separated" /></div>
          <div className="lt-f full"><label>Problem(s) that landed</label><input className="lt-in" value={s.problemsText} onChange={(e) => editStaged(s.id, "problemsText", e.target.value)} placeholder="comma-separated" /></div>
          <div className="lt-f full"><label>Next action</label><input className="lt-in" value={s.nextAction} onChange={(e) => editStaged(s.id, "nextAction", e.target.value)} /></div>
        </div>
      </div>
    );
  };

  const Modal = ({ a }) => {
    const idx = STAGES.indexOf(a.stage);
    const ordered = [...a.timeline].sort((x, y) => y.at - x.at);
    const angles = anglesOf(a), problems = problemsOf(a);
    return (
      <div className="lt-overlay" onClick={() => setModalId(null)}>
        <div className="lt-modal" onClick={(e) => e.stopPropagation()}>
          <div className="lt-mh">
            <div>
              <div className="nm">{a.name}</div>
              <div className="row">
                <span className="lt-dtag" style={dtag(a.dealType)}>{a.dealType}</span>
                <span className="lt-pill" style={{ background: STAGE_COLOR[a.stage] }}>{a.stage}</span>
                <span className="lt-tsrc">{a.timeline.length} touches · last {fmt(lastTouchAt(a))}</span>
              </div>
            </div>
            <button className="lt-mx" onClick={() => setModalId(null)}><X size={18} /></button>
          </div>
          <div className="lt-mb">
            <div className="lt-prog">{FUNNEL.map((st, i) => <div key={st} className="lt-seg" style={{ background: a.stage === "Lost" ? "#e7d3d3" : i <= idx ? STAGE_COLOR[a.stage] : "#e7e0d0" }} title={st} />)}</div>
            <div className="lt-fields">
              <div className="lt-f"><label>Account / Org</label><input className="lt-in" value={a.name} onChange={(e) => editAcct(a.id, "name", e.target.value)} /></div>
              <div className="lt-f"><label>Deal type</label><select className="lt-sel" style={{ width: "100%" }} value={a.dealType} onChange={(e) => editAcct(a.id, "dealType", e.target.value)}>{DEAL_TYPES.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div className="lt-f"><label>Stage</label><select className="lt-sel" style={{ width: "100%" }} value={a.stage} onChange={(e) => editAcct(a.id, "stage", e.target.value)}>{STAGES.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div className="lt-na"><label>Next action</label><input className="lt-in" value={a.nextAction} onChange={(e) => editAcct(a.id, "nextAction", e.target.value)} placeholder="—" /></div>
            </div>
            <div className="lt-block">
              <p className="lt-block-h">Contacts</p>
              {a.contacts.map((c) => (
                <div className="lt-contact" key={c.id}>
                  <input className="lt-in" placeholder="Name" value={c.name} onChange={(e) => editContact(a.id, c.id, "name", e.target.value)} />
                  <input className="lt-in" placeholder="Role" value={c.role} onChange={(e) => editContact(a.id, c.id, "role", e.target.value)} />
                  <input className="lt-in mono" placeholder="email / handle" value={c.contact} onChange={(e) => editContact(a.id, c.id, "contact", e.target.value)} />
                  <button className="lt-cx" onClick={() => rmContact(a.id, c.id)}><X size={14} /></button>
                </div>
              ))}
              <button className="lt-addc" onClick={() => addContact(a.id)}><UserPlus size={13} /> Add contact</button>
            </div>
            {(angles.length > 0 || problems.length > 0) && (
              <div className="lt-block">
                <p className="lt-block-h">What&apos;s been pitched · what&apos;s landed</p>
                <div className="lt-chiprow">{angles.map((x) => <span className="lt-tg angle" key={"a" + x}>{x}</span>)}{problems.map((x) => <span className="lt-tg problem" key={"p" + x}>{x}</span>)}</div>
              </div>
            )}
            <p className="lt-tl-h">Timeline · {a.timeline.length} {a.timeline.length === 1 ? "entry" : "entries"}</p>
            <div className="lt-tl">
              {ordered.map((t) => {
                const rk = a.id + t.id;
                return (
                  <div className="lt-touch" key={t.id}>
                    <span className="lt-dot" style={{ background: STAGE_COLOR[t.stage] || "#8a8f84" }} />
                    <div className="lt-tmeta"><span className="lt-tdate">{fmt(t.at)}</span><span className="lt-tstage" style={{ background: STAGE_COLOR[t.stage] }}>{t.stage}</span><span className="lt-tsrc">{t.source}</span></div>
                    <div className="lt-tsum">{t.summary || <em style={{ color: "var(--faint)" }}>no read</em>}</div>
                    {(t.angles?.length > 0 || t.problems?.length > 0) && <div className="lt-tchips">{(t.angles || []).map((x) => <span className="lt-tg angle" key={"a" + x}>{x}</span>)}{(t.problems || []).map((x) => <span className="lt-tg problem" key={"p" + x}>{x}</span>)}</div>}
                    {t.nextAction && <div className="lt-tnext"><CornerDownRight size={13} style={{ marginTop: 2, flexShrink: 0 }} /> {t.nextAction}</div>}
                    {t.rawText && (<><button className="lt-raw-toggle" onClick={() => setOpenRaw((o) => ({ ...o, [rk]: !o[rk] }))}><FileText size={11} /> {openRaw[rk] ? "Hide original" : "View original"}</button>{openRaw[rk] && <div className="lt-raw">{t.rawText}</div>}</>)}
                  </div>
                );
              })}
            </div>
            <div className="lt-addnote">
              <input className="lt-in" placeholder="Add a quick note to the timeline…" value={noteDraft[a.id] || ""} onChange={(e) => setNoteDraft((d) => ({ ...d, [a.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") addNote(a.id); }} />
              <button className="lt-mini" onClick={() => addNote(a.id)}><Plus size={14} /> Note</button>
            </div>
            <div className="lt-cdel"><button className="lt-btn danger" onClick={() => deleteAcct(a.id)}><Trash2 size={13} /> Delete account</button></div>
          </div>
        </div>
      </div>
    );
  };

  const modalAcct = accts.find((a) => a.id === modalId);

  return (
    <div className="lt">
      <div className="lt-wrap">
        <header className="lt-head">
          <div>
            <span className="lt-kicker">Clarivue · Lead Ops</span>
            <h1 className="lt-title">Pipeline <em>Intelligence</em></h1>
            <p className="lt-sub">Dump a transcript, email, or message trail. It reads the sales signal — the angle you pitched, the problem that landed, where the deal stands — and logs it to the right account.</p>
          </div>
          <button className="lt-logout" onClick={logout}><LogOut size={12} style={{ verticalAlign: "-1px", marginRight: 5 }} />Log out</button>
        </header>

        <nav className="lt-nav">
          <button className={`lt-tab${view === "intake" ? " active" : ""}`} onClick={() => setView("intake")}><FileInput size={15} /> Intake{staged.length > 0 && <span className="b">{staged.length}</span>}</button>
          <button className={`lt-tab${view === "dashboard" ? " active" : ""}`} onClick={() => setView("dashboard")}><LayoutGrid size={15} /> Dashboard</button>
          <button className={`lt-tab${view === "accounts" ? " active" : ""}`} onClick={() => setView("accounts")}><Table2 size={15} /> Accounts<span className="b">{accts.length}</span></button>
        </nav>

        {view === "intake" && (
          <>
            <section className="lt-card lt-intake">
              <div className={`lt-drop${drag ? " drag" : ""}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
                <textarea className="lt-ta" value={dump} onChange={(e) => setDump(e.target.value)} placeholder={"Paste anything here…\n\n• a call transcript\n• an email or LinkedIn thread\n• a WhatsApp / DM exchange\n• rough notes\n\n…then hit Read & Log. Drag files in too."} />
                {files.length > 0 && <div className="lt-chips">{files.map((f) => <span className="lt-chip" key={f.id}>{f.kind === "image" ? <ImageIcon size={12} /> : <FileText size={12} />}{f.name}<button onClick={() => setFiles((x) => x.filter((y) => y.id !== f.id))}><X size={12} /></button></span>)}</div>}
              </div>
              <div className="lt-bar">
                <label className="lt-attach"><Upload size={15} /> Attach files<input ref={fileRef} type="file" multiple className="lt-hide" accept=".txt,.md,.csv,.json,.log,.pdf,image/*" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} /></label>
                <button className="lt-go" onClick={extract} disabled={busy}>{busy ? <><span className="lt-spin" /> Reading…</> : <><Sparkles size={16} /> Read &amp; Log</>}</button>
              </div>
              {err && <div className="lt-err">{err}</div>}
            </section>
            {staged.length > 0 ? (
              <section className="lt-staging">
                <div className="lt-sec-h">
                  <div className="lt-sec-t"><Check size={18} color="#bf4f2a" /> {staged.length} ready <small>check match, deal type, angle &amp; problem — then log</small></div>
                  <div className="lt-actions"><button className="lt-btn danger" onClick={() => setStaged([])}><X size={14} /> Discard</button><button className="lt-btn commit" onClick={commit} disabled={busy}><Check size={14} /> {busy ? "Saving…" : "Log → Dashboard"}</button></div>
                </div>
                {staged.map((s) => <StagedCard key={s.id} s={s} />)}
              </section>
            ) : <p style={{ textAlign: "center", color: "var(--faint)", fontSize: 13, marginTop: 8 }}>Paste something above and hit Read &amp; Log — extracted entries show here for a quick check before they hit your pipeline.</p>}
          </>
        )}

        {view === "dashboard" && (
          total === 0 ? (
            <div className="lt-card lt-empty"><div className="ico"><Inbox size={26} /></div><h4>{ready ? "Nothing to analyze yet" : "Loading…"}</h4><p>Log a few interactions in Intake and your sales motion shows up here.</p></div>
          ) : (
            <>
              <div className="lt-pulse"><Activity size={14} color="var(--teal)" /> <b>{totalTouches}</b> touches logged · <b>{avgTouches}</b> avg per account · <b>{touches7}</b> this week · <b>{new7}</b> new accounts this week</div>
              <div className="lt-kpis">
                <div className="lt-kpi"><div className="k"><LayoutGrid size={11} /> Open pipeline</div><div className="v">{open.length}</div><div className="s">{won} won · {lost} lost</div></div>
                <div className="lt-kpi"><div className="k"><Filter size={11} /> Past discovery</div><div className="v">{pct(pastDisc, total)}%</div><div className="s">{pastDisc} of {total} accounts</div></div>
                <div className="lt-kpi"><div className="k"><TrendingUp size={11} /> Win rate</div><div className="v">{closed ? pct(won, closed) + "%" : "—"}</div><div className="s">{closed} closed so far</div></div>
                <div className="lt-kpi"><div className="k"><Clock size={11} /> Response gap</div><div className="v">{avgGap != null ? avgGap + "d" : "—"}</div><div className="s">avg between touches</div></div>
                <div className="lt-kpi"><div className="k"><AlertTriangle size={11} /> Going cold</div><div className="v" style={{ color: stale.length ? "var(--clay)" : "var(--ink)" }}>{stale.length}</div><div className="s">no touch in {STALE}+ days</div></div>
              </div>
              <div className="lt-panels">
                <section className="lt-card lt-panel">
                  <p className="lt-panel-h"><Filter size={12} /> Stage funnel</p>
                  {FUNNEL.map((st) => (
                    <div className="lt-frow" key={st}>
                      <span className="lab">{st}</span>
                      <div className="track"><div className="fill" style={{ width: `${(stageCounts[st] / funnelMax) * 100}%`, background: STAGE_COLOR[st] }} /></div>
                      <span className="ct">{stageCounts[st]}</span>
                    </div>
                  ))}
                  {lost > 0 && <div className="lt-frow" style={{ marginTop: 4, opacity: .7 }}><span className="lab" style={{ color: "var(--muted)" }}>Lost</span><div className="track"><div className="fill" style={{ width: `${(lost / funnelMax) * 100}%`, background: STAGE_COLOR["Lost"] }} /></div><span className="ct">{lost}</span></div>}
                </section>
                <div className="lt-stack">
                  <section className="lt-card lt-panel">
                    <p className="lt-panel-h"><Target size={12} /> Deal type mix</p>
                    {Object.entries(dealMix).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                      <div className="lt-mini-row" key={k}><span className="lab"><span className="lt-dot-s" style={{ background: DEAL_COLOR[k] }} />{k}</span><div className="track"><div style={{ height: "100%", borderRadius: 4, width: `${(v / total) * 100}%`, background: DEAL_COLOR[k] }} /></div><span className="ct">{v}</span></div>
                    ))}
                  </section>
                  <section className="lt-card lt-panel">
                    <p className="lt-panel-h"><Activity size={12} /> Source mix</p>
                    {Object.entries(srcMix).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                      <div className="lt-mini-row" key={k}><span className="lab">{k}</span><div className="track"><div style={{ height: "100%", borderRadius: 4, width: `${(v / total) * 100}%`, background: "var(--teal)" }} /></div><span className="ct">{v}</span></div>
                    ))}
                  </section>
                </div>
              </div>
              <section className="lt-card lt-insights">
                <div className="lt-sec-t" style={{ fontSize: 18, marginBottom: 16 }}><TrendingUp size={17} color="var(--teal)" /> What&apos;s working <small>angle &amp; problem vs. deals advancing</small></div>
                <div className="lt-ins-grid">
                  <div><p className="lt-panel-h"><Sparkles size={12} /> Angles pitched</p>{angleRank.length ? angleRank.map((r) => <Rank key={r.tag} r={r} max={maxA} color="var(--teal)" />) : <p className="lt-noins">No angles logged yet.</p>}</div>
                  <div><p className="lt-panel-h"><Target size={12} /> Problems that landed</p>{problemRank.length ? problemRank.map((r) => <Rank key={r.tag} r={r} max={maxP} color="var(--clay)" />) : <p className="lt-noins">No problems logged yet.</p>}</div>
                </div>
              </section>
              {stale.length > 0 && (
                <section style={{ marginTop: 18 }}>
                  <div className="lt-sec-h"><div className="lt-sec-t"><AlertTriangle size={17} color="var(--clay)" /> Needs attention <small>open deals going quiet — click to open</small></div></div>
                  {stale.slice(0, 6).map(({ a, age }) => (
                    <div className="lt-cold" key={a.id} onClick={() => setModalId(a.id)}>
                      <div><div className="nm">{a.name}</div><div className="meta">{a.stage} · {a.dealType}</div></div>
                      <span className="age">{age}d quiet</span>
                    </div>
                  ))}
                </section>
              )}
            </>
          )
        )}

        {view === "accounts" && (
          <section>
            <div className="lt-sec-h">
              <div className="lt-sec-t">Accounts <small>{accts.length} · click any row for the full timeline</small></div>
              <div className="lt-actions">
                {accts.length > 0 && <div className="lt-search"><Search size={14} color="var(--faint)" /><input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /></div>}
                {accts.length > 0 && <button className="lt-btn" onClick={exportCSV}><Download size={14} /> Export</button>}
              </div>
            </div>
            {accts.length > 0 ? (
              <div className="lt-card lt-tblwrap">
                <table className="lt-tbl">
                  <thead><tr><th>Account</th><th>Type</th><th>Stage</th><th>Top angle</th><th>Last touch</th><th style={{ textAlign: "right" }}>Touches</th></tr></thead>
                  <tbody>
                    {filtered.map((a) => {
                      const ang = anglesOf(a)[0];
                      const age = Math.round((now - lastTouchAt(a)) / DAY);
                      return (
                        <tr key={a.id} onClick={() => setModalId(a.id)}>
                          <td><div className="lt-td-name">{a.name}</div><div className="lt-td-sub">{a.contacts.map((c) => c.name).filter(Boolean).join(", ") || "no contacts"}</div></td>
                          <td><span className="lt-dtag" style={dtag(a.dealType)}>{a.dealType}</span></td>
                          <td><span className="lt-pill" style={{ background: STAGE_COLOR[a.stage] }}>{a.stage}</span></td>
                          <td>{ang ? <span className="lt-tg angle">{ang}</span> : <span style={{ color: "var(--faint)" }}>—</span>}</td>
                          <td><div className="lt-td-mono">{fmt(lastTouchAt(a))}</div><div className="lt-td-sub" style={{ color: age >= STALE ? "var(--clay)" : "var(--faint)" }}>{age}d ago</div></td>
                          <td style={{ textAlign: "right" }} className="lt-td-mono">{a.timeline.length}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && <div className="lt-empty" style={{ padding: 36 }}><p>Nothing matches &quot;{q}&quot;.</p></div>}
              </div>
            ) : (
              <div className="lt-card lt-empty"><div className="ico"><Inbox size={26} /></div><h4>{ready ? "Pipeline's empty" : "Loading…"}</h4><p>Head to Intake, dump your first transcript or thread, and it lands here.</p></div>
            )}
          </section>
        )}
      </div>
      {modalAcct && <Modal a={modalAcct} />}
      {toast && <div className="lt-toast"><Check size={15} /> {toast}</div>}
    </div>
  );
}
