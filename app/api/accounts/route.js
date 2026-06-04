import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";
import { fromRow, toRow } from "../../../lib/map";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("accounts")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accounts: (data || []).map(fromRow) });
}

export async function POST(req) {
  const a = await req.json();
  const { data, error } = await supabaseAdmin
    .from("accounts")
    .insert(toRow(a))
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: fromRow(data) });
}
