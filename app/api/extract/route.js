import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";

const STAGES = ["New", "Contacted", "Discovery booked", "Proposal sent", "Negotiating", "Won", "Lost"];
const SOURCES = ["Email", "LinkedIn", "Call", "Referral", "Event", "Note", "Other"];
const DEAL_TYPES = ["Buyer", "Partnership", "Distributor", "Reseller", "Pilot", "Investor", "Other"];

export async function POST(req) {
  const { content, roster = [] } = await req.json();
  if (!content) return NextResponse.json({ error: "no content" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: tagRows, error: tagsError } = await supabaseAdmin
    .from("tags")
    .select("kind,label")
    .order("created_at", { ascending: true });
  if (tagsError) return NextResponse.json({ error: tagsError.message }, { status: 500 });

  const angleLib = (tagRows || []).filter((t) => t.kind === "angle").map((t) => t.label);
  const problemLib = (tagRows || []).filter((t) => t.kind === "problem").map((t) => t.label);

  const system = `You are the SALES ANALYSIS engine for a B2B pipeline tool. The user dumps raw material — call transcripts, email threads, chat/DM trails, notes, or files. Your job is to READ IT AS A SALES SIGNAL: interpret what happened, the traction/momentum, what resonated, and where the opportunity now stands. Do not merely transcribe — analyze. (Content may be in any language; analyze in English.)

Existing accounts (match against these): ${JSON.stringify(roster)}
Canonical angle library (reuse labels verbatim when they fit): ${JSON.stringify(angleLib)}
Canonical problem library (reuse labels verbatim when they fit): ${JSON.stringify(problemLib)}
Classification hint: "Automated tracking through placement" is the workflow/plumbing pitch (replacing manual tracking through to placement). "Cross-program visibility" is the leadership view pitch (seeing across programs, cohorts, or member institutions in one place). Classify by which benefit was actually emphasized.

Return ONLY a JSON array (no prose, no code fences). One object per distinct organization/opportunity referenced, with exactly these keys:
"matchId","name","dealType","contacts","source","stage","lastContact","nextAction","summary","angles","problems"

- "matchId": id of an existing account if this clearly refers to it, else null.
- "name": the organization / opportunity name.
- "dealType": one of exactly: Buyer, Partnership, Distributor, Reseller, Pilot, Investor, Other. Infer; default "Buyer".
- "contacts": ARRAY of {"name","role","contact"} — EVERY person mentioned for this org. "contact"=email/phone/handle or "".
- "summary": 2-3 sentence SALES READ of THIS interaction — momentum, sentiment, what moved.
- "angles": the 1-2 PRIMARY value angles actually pitched in THIS interaction. CLASSIFY FIRST: if any canonical angle matches the meaning even loosely, reuse that label VERBATIM — never paraphrase a library label. Invent a new short label (3-6 words) only when nothing in the library fits. [] if no real pitch was made.
- "problems": ONLY pain points the PROSPECT EXPLICITLY confirmed or visibly reacted to (agreed, said it's their situation, asked follow-ups, gave their own examples). Problems merely raised by the seller, or inferred, do NOT belong. 0-2 maximum; [] is a common, correct answer. Reuse canonical problem labels VERBATIM; invent only if genuinely new.
- "stage": one of exactly: New, Contacted, Discovery booked, Proposal sent, Negotiating, Won, Lost.
- "source": one of exactly: Email, LinkedIn, Call, Referral, Event, Note, Other.
- "lastContact": YYYY-MM-DD, inferred or ${today}.
- "nextAction": concrete next step or "".
If no real opportunity, return [].`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content }],
      }),
    });
    const data = await r.json();
    if (data.error) return NextResponse.json({ error: data.error.message || "model error" }, { status: 502 });

    const text = (data.content || []).filter((i) => i.type === "text").map((i) => i.text).join("\n");
    let clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const s = clean.indexOf("["), e = clean.lastIndexOf("]");
    if (s !== -1 && e !== -1) clean = clean.slice(s, e + 1);

    let parsed = [];
    try { parsed = JSON.parse(clean); } catch { parsed = []; }

    const exactAngleSet = new Set(angleLib.map((x) => String(x || "").trim()));
    const exactProblemSet = new Set(problemLib.map((x) => String(x || "").trim()));

    const leads = (Array.isArray(parsed) ? parsed : []).map((p) => ({
      matchId: p.matchId || null,
      name: p.name || "",
      dealType: DEAL_TYPES.includes(p.dealType) ? p.dealType : "Buyer",
      contacts: Array.isArray(p.contacts) ? p.contacts : [],
      source: SOURCES.includes(p.source) ? p.source : "Other",
      stage: STAGES.includes(p.stage) ? p.stage : "New",
      lastContact: p.lastContact || today,
      nextAction: p.nextAction || "",
      summary: p.summary || "",
      angles: (Array.isArray(p.angles) ? p.angles : [])
        .map((x) => String(x || "").trim())
        .filter((x) => exactAngleSet.has(x))
        .filter(Boolean)
        .slice(0, 3),
      problems: (Array.isArray(p.problems) ? p.problems : [])
        .map((x) => String(x || "").trim())
        .filter((x) => exactProblemSet.has(x))
        .filter(Boolean)
        .slice(0, 3),
    }));

    return NextResponse.json({ leads });
  } catch (err) {
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
