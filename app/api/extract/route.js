import { NextResponse } from "next/server";

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
  const system = `You are the SALES ANALYSIS engine for a B2B pipeline tool. The user dumps raw material — call transcripts, email threads, chat/DM trails, notes, or files. Your job is to READ IT AS A SALES SIGNAL: interpret what happened, the traction/momentum, what resonated, and where the opportunity now stands. Do not merely transcribe — analyze. (Content may be in any language; analyze in English.)

Existing accounts (match against these): ${JSON.stringify(roster)}

Return ONLY a JSON array (no prose, no code fences). One object per distinct organization/opportunity referenced, with exactly these keys:
"matchId","name","dealType","contacts","source","stage","lastContact","nextAction","summary","angles","problems"

- "matchId": id of an existing account if this clearly refers to it, else null.
- "name": the organization / opportunity name.
- "dealType": one of exactly: Buyer, Partnership, Distributor, Reseller, Pilot, Investor, Other. Infer; default "Buyer".
- "contacts": ARRAY of {"name","role","contact"} — EVERY person mentioned for this org. "contact"=email/phone/handle or "".
- "summary": 2-3 sentence SALES READ of THIS interaction — momentum, sentiment, what moved.
- "angles": ARRAY of value angle(s)/positioning PITCHED. [] if none.
- "problems": ARRAY of pain point(s) that clearly LANDED / resonated. [] if none.
- "stage": one of exactly: New, Contacted, Discovery booked, Proposal sent, Negotiating, Won, Lost.
- "source": one of exactly: Email, LinkedIn, Call, Referral, Event, Note, Other.
- "lastContact": YYYY-MM-DD, inferred or ${today}.
- "nextAction": concrete next step or "".
Keep each angle/problem a short canonical phrase (3-7 words) so they group across deals. Never invent. If no real opportunity, return [].`;

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
      angles: Array.isArray(p.angles) ? p.angles : [],
      problems: Array.isArray(p.problems) ? p.problems : [],
    }));

    return NextResponse.json({ leads });
  } catch (err) {
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
