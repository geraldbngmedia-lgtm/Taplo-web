import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const cookieStore = await cookies();

  if (provider === "google") {
    cookieStore.delete("calendar_google_access_token");
    cookieStore.delete("calendar_google_refresh_token");
  }

  if (provider === "outlook" || provider === "teams") {
    cookieStore.delete("calendar_microsoft_access_token");
    cookieStore.delete("calendar_microsoft_refresh_token");
  }

  return NextResponse.json({ ok: true });
}
