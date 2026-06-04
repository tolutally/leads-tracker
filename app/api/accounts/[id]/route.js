import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";
import { fromRow, toRow } from "../../../../lib/map";

export async function PATCH(req, ctx) {
  const { id } = await ctx.params;
  const a = await req.json();
  const { data, error } = await supabaseAdmin
    .from("accounts")
    .update(toRow(a))
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: fromRow(data) });
}

export async function DELETE(req, ctx) {
  const { id } = await ctx.params;
  const { error } = await supabaseAdmin.from("accounts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
