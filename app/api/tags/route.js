import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";
import { TAG_KINDS } from "../../../lib/tags";

const clean = (value) => String(value || "").trim();

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("tags")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tags: data || [] });
}

export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const kind = clean(body.kind);
  const label = clean(body.label);

  if (!TAG_KINDS.includes(kind)) {
    return NextResponse.json({ error: "kind must be 'angle' or 'problem'" }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const { data: inserted, error: upsertError } = await supabaseAdmin
    .from("tags")
    .upsert([{ kind, label }], { onConflict: "kind,label", ignoreDuplicates: true })
    .select();
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  let tag = inserted?.[0] || null;
  if (!tag) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("tags")
      .select("*")
      .eq("kind", kind)
      .eq("label", label)
      .single();
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    tag = existing;
  }

  return NextResponse.json({ tag });
}
