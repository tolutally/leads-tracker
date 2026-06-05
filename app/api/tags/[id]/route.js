import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";
import { propagateTagLabel, stripTagLabel } from "../../../../lib/tags";

const clean = (value) => String(value || "").trim();

export async function PATCH(req, ctx) {
  const { id } = await ctx.params;

  let body = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const newLabel = clean(body.label);
  if (!newLabel) return NextResponse.json({ error: "label is required" }, { status: 400 });

  const { data: current, error: currentError } = await supabaseAdmin
    .from("tags")
    .select("*")
    .eq("id", id)
    .single();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });

  if (current.label === newLabel) {
    return NextResponse.json({ tag: current, merged: false, changedRows: 0 });
  }

  const { data: mergeTarget, error: mergeTargetError } = await supabaseAdmin
    .from("tags")
    .select("*")
    .eq("kind", current.kind)
    .eq("label", newLabel)
    .neq("id", id)
    .maybeSingle();
  if (mergeTargetError) return NextResponse.json({ error: mergeTargetError.message }, { status: 500 });

  try {
    const { changedRows } = await propagateTagLabel({
      kind: current.kind,
      oldLabel: current.label,
      newLabel,
    });

    if (mergeTarget) {
      const { error: deleteError } = await supabaseAdmin.from("tags").delete().eq("id", id);
      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
      return NextResponse.json({ tag: mergeTarget, merged: true, changedRows });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("tags")
      .update({ label: newLabel })
      .eq("id", id)
      .select()
      .single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ tag: updated, merged: false, changedRows });
  } catch (err) {
    return NextResponse.json({ error: err.message || "failed to rename tag" }, { status: 500 });
  }
}

export async function DELETE(req, ctx) {
  const { id } = await ctx.params;

  const { data: current, error: currentError } = await supabaseAdmin
    .from("tags")
    .select("*")
    .eq("id", id)
    .single();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });

  try {
    const { changedRows } = await stripTagLabel({ kind: current.kind, label: current.label });

    const { error: deleteError } = await supabaseAdmin.from("tags").delete().eq("id", id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    return NextResponse.json({ ok: true, changedRows });
  } catch (err) {
    return NextResponse.json({ error: err.message || "failed to delete tag" }, { status: 500 });
  }
}
