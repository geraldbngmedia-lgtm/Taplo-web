import { NextResponse } from "next/server";
const googleScope = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

const microsoftScope = ["offline_access", "User.Read", "Calendars.Read"].join(" ");

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const origin = new URL(request.url).origin;

  if (provider === "google") {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return setupRequired("Google Calendar", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]);
    }

    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ?? `${origin}/api/calendar/callback/google`;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", googleScope);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");

    return NextResponse.redirect(url);
  }

  if (provider === "outlook" || provider === "teams") {
    if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
      return setupRequired("Microsoft Calendar", [
        "MICROSOFT_CLIENT_ID",
        "MICROSOFT_CLIENT_SECRET",
      ]);
    }

    const redirectUri =
      process.env.MICROSOFT_REDIRECT_URI ?? `${origin}/api/calendar/callback/microsoft`;
    const tenant = process.env.MICROSOFT_TENANT_ID ?? "common";
    const url = new URL(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    );
    url.searchParams.set("client_id", process.env.MICROSOFT_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", microsoftScope);
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("state", provider);

    return NextResponse.redirect(url);
  }

  return NextResponse.json({ error: "Unsupported calendar provider." }, { status: 400 });
}

function setupRequired(providerName: string, envVars: string[]) {
  return NextResponse.json(
    {
      error: `${providerName} OAuth is not configured.`,
      requiredEnv: envVars,
    },
    { status: 501 },
  );
}
