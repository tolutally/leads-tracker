import { NextResponse } from "next/server";

export async function POST(req) {
  let password = "";
  try {
    ({ password } = await req.json());
  } catch {
    /* ignore */
  }

  if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("cv_auth", process.env.AUTH_SECRET || "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("cv_auth", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
