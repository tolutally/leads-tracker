import { supabaseAdmin } from "./supabase";

export const TAG_KINDS = ["angle", "problem"];

const dedupeStrings = (arr) => {
  const seen = new Set();
  const out = [];
  for (const item of arr || []) {
    const value = String(item || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
};

const transformTouchTags = (touch, kind, oldLabel, newLabel) => {
  const key = kind === "angle" ? "angles" : "problems";
  const source = Array.isArray(touch?.[key]) ? touch[key] : [];
  let changed = false;

  const transformed = source.map((tag) => {
    if (tag !== oldLabel) return tag;
    changed = true;
    return newLabel;
  });

  const cleaned = dedupeStrings(transformed);
  if (cleaned.length !== source.length) changed = true;

  if (!changed) return { touch, changed: false };
  return { touch: { ...touch, [key]: cleaned }, changed: true };
};

export async function propagateTagLabel({ kind, oldLabel, newLabel }) {
  const { data: rows, error } = await supabaseAdmin.from("accounts").select("id,timeline");
  if (error) throw new Error(error.message);

  let changedRows = 0;
  for (const row of rows || []) {
    const timeline = Array.isArray(row.timeline) ? row.timeline : [];
    let rowChanged = false;
    const nextTimeline = timeline.map((touch) => {
      const next = transformTouchTags(touch || {}, kind, oldLabel, newLabel);
      if (next.changed) rowChanged = true;
      return next.touch;
    });

    if (!rowChanged) continue;

    const { error: updateError } = await supabaseAdmin
      .from("accounts")
      .update({ timeline: nextTimeline, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (updateError) throw new Error(updateError.message);
    changedRows++;
  }

  return { changedRows };
}

export async function stripTagLabel({ kind, label }) {
  const { data: rows, error } = await supabaseAdmin.from("accounts").select("id,timeline");
  if (error) throw new Error(error.message);

  let changedRows = 0;
  const key = kind === "angle" ? "angles" : "problems";

  for (const row of rows || []) {
    const timeline = Array.isArray(row.timeline) ? row.timeline : [];
    let rowChanged = false;

    const nextTimeline = timeline.map((touch) => {
      const source = Array.isArray(touch?.[key]) ? touch[key] : [];
      const filtered = dedupeStrings(source.filter((item) => item !== label));
      if (filtered.length === source.length) return touch;
      rowChanged = true;
      return { ...touch, [key]: filtered };
    });

    if (!rowChanged) continue;

    const { error: updateError } = await supabaseAdmin
      .from("accounts")
      .update({ timeline: nextTimeline, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (updateError) throw new Error(updateError.message);
    changedRows++;
  }

  return { changedRows };
}
