import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();

  return NextResponse.json({
    providers: {
      google: {
        configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        connected: Boolean(cookieStore.get("calendar_google_access_token")?.value),
      },
      outlook: {
        configured: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
        connected: Boolean(cookieStore.get("calendar_microsoft_access_token")?.value),
      },
      teams: {
        configured: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
        connected: Boolean(cookieStore.get("calendar_microsoft_access_token")?.value),
      },
    },
  });
}
