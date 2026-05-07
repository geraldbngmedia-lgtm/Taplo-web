import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error_description?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;

  if (!code) {
    return NextResponse.json({ error: "Missing Microsoft OAuth code." }, { status: 400 });
  }

  const tenant = process.env.MICROSOFT_TENANT_ID ?? "common";
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI ?? `${origin}/api/calendar/callback/microsoft`;

  const body = new URLSearchParams({
    code,
    client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
    client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: ["offline_access", "User.Read", "Calendars.Read"].join(" "),
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  const payload = (await response.json()) as MicrosoftTokenResponse;

  if (!response.ok || !payload.access_token) {
    return NextResponse.json(
      { error: payload.error_description ?? "Microsoft OAuth token exchange failed." },
      { status: response.status || 502 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set("calendar_microsoft_access_token", payload.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: payload.expires_in ?? 3600,
    path: "/",
  });
  if (payload.refresh_token) {
    cookieStore.set("calendar_microsoft_refresh_token", payload.refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }

  return NextResponse.redirect(`${origin}/?calendar=microsoft-connected`);
}
