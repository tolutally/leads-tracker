// Map between the DB row (snake_case) and the app object (camelCase).
export const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  dealType: r.deal_type,
  stage: r.stage,
  nextAction: r.next_action || "",
  contacts: r.contacts || [],
  timeline: r.timeline || [],
  createdAt: +new Date(r.created_at),
  updatedAt: +new Date(r.updated_at),
});

export const toRow = (a) => ({
  name: a.name || "Untitled",
  deal_type: a.dealType || "Buyer",
  stage: a.stage || "New",
  next_action: a.nextAction || "",
  contacts: a.contacts || [],
  timeline: a.timeline || [],
  updated_at: new Date().toISOString(),
});
