import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type NormalizedCalendarEvent = {
  externalId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetingUrl: string;
  description: string;
  attendeeEmails: string[];
};

type GoogleEvent = {
  id?: string;
  summary?: string;
  description?: string;
  hangoutLink?: string;
  htmlLink?: string;
  attendees?: Array<{ email?: string; displayName?: string; self?: boolean }>;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

type MicrosoftEvent = {
  id?: string;
  subject?: string;
  bodyPreview?: string;
  webLink?: string;
  attendees?: Array<{ emailAddress?: { address?: string; name?: string } }>;
  onlineMeeting?: { joinUrl?: string };
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? 14);
  const start = new Date();
  const end = new Date(start.getTime() + Math.max(1, Math.min(days, 31)) * 24 * 60 * 60 * 1000);

  if (provider === "google") {
    return fetchGoogleEvents(start, end);
  }

  if (provider === "outlook" || provider === "teams") {
    return fetchMicrosoftEvents(start, end);
  }

  return NextResponse.json({ error: "Unsupported calendar provider." }, { status: 400 });
}

async function fetchGoogleEvents(start: Date, end: Date) {
  const cookieStore = await cookies();
  let token = cookieStore.get("calendar_google_access_token")?.value;

  if (!token) {
    token = await refreshGoogleAccessToken(cookieStore);
    if (!token) {
      return NextResponse.json({ error: "Google Calendar is not connected." }, { status: 401 });
    }
  }

  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", start.toISOString());
  url.searchParams.set("timeMax", end.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "20");

  let response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (response.status === 401) {
    const refreshedToken = await refreshGoogleAccessToken(cookieStore);
    if (refreshedToken) {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${refreshedToken}` },
        cache: "no-store",
      });
    }
  }
  const payload = (await response.json().catch(() => ({}))) as {
    items?: GoogleEvent[];
    error?: { message?: string };
  };

  if (!response.ok) {
    return NextResponse.json(
      { error: payload.error?.message ?? "Google Calendar event sync failed." },
      { status: response.status },
    );
  }

  return NextResponse.json({
    events: (payload.items ?? []).map(normalizeGoogleEvent),
  });
}

async function fetchMicrosoftEvents(start: Date, end: Date) {
  const cookieStore = await cookies();
  let token = cookieStore.get("calendar_microsoft_access_token")?.value;

  if (!token) {
    token = await refreshMicrosoftAccessToken(cookieStore);
    if (!token) {
      return NextResponse.json({ error: "Microsoft Calendar is not connected." }, { status: 401 });
    }
  }

  const url = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
  url.searchParams.set("startDateTime", start.toISOString());
  url.searchParams.set("endDateTime", end.toISOString());
  url.searchParams.set("$top", "20");
  url.searchParams.set("$orderby", "start/dateTime");

  let response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'outlook.timezone="UTC"',
    },
    cache: "no-store",
  });
  if (response.status === 401) {
    const refreshedToken = await refreshMicrosoftAccessToken(cookieStore);
    if (refreshedToken) {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${refreshedToken}`,
          Prefer: 'outlook.timezone="UTC"',
        },
        cache: "no-store",
      });
    }
  }
  const payload = (await response.json().catch(() => ({}))) as {
    value?: MicrosoftEvent[];
    error?: { message?: string };
  };

  if (!response.ok) {
    return NextResponse.json(
      { error: payload.error?.message ?? "Microsoft Calendar event sync failed." },
      { status: response.status },
    );
  }

  return NextResponse.json({
    events: (payload.value ?? []).map(normalizeMicrosoftEvent),
  });
}

function normalizeGoogleEvent(event: GoogleEvent): NormalizedCalendarEvent {
  const startsAt = event.start?.dateTime ?? event.start?.date ?? new Date().toISOString();
  const endsAt = event.end?.dateTime ?? event.end?.date ?? startsAt;

  return {
    externalId: event.id ?? `google-${startsAt}`,
    title: event.summary ?? "Calendar interview",
    startsAt,
    endsAt,
    meetingUrl: event.hangoutLink ?? event.htmlLink ?? "",
    description: event.description ?? "",
    attendeeEmails:
      event.attendees
        ?.filter((attendee) => !attendee.self && attendee.email)
        .map((attendee) => attendee.email as string) ?? [],
  };
}

function normalizeMicrosoftEvent(event: MicrosoftEvent): NormalizedCalendarEvent {
  const startsAt = event.start?.dateTime
    ? new Date(`${event.start.dateTime}Z`).toISOString()
    : new Date().toISOString();
  const endsAt = event.end?.dateTime ? new Date(`${event.end.dateTime}Z`).toISOString() : startsAt;

  return {
    externalId: event.id ?? `microsoft-${startsAt}`,
    title: event.subject ?? "Calendar interview",
    startsAt,
    endsAt,
    meetingUrl: event.onlineMeeting?.joinUrl ?? event.webLink ?? "",
    description: event.bodyPreview ?? "",
    attendeeEmails:
      event.attendees
        ?.map((attendee) => attendee.emailAddress?.address)
        .filter((email): email is string => Boolean(email)) ?? [],
  };
}

async function refreshGoogleAccessToken(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const refreshToken = cookieStore.get("calendar_google_refresh_token")?.value;
  if (!refreshToken || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return undefined;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!response.ok || !payload.access_token) return undefined;

  cookieStore.set("calendar_google_access_token", payload.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: payload.expires_in ?? 3600,
    path: "/",
  });

  return payload.access_token;
}

async function refreshMicrosoftAccessToken(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const refreshToken = cookieStore.get("calendar_microsoft_refresh_token")?.value;
  if (!refreshToken || !process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
    return undefined;
  }

  const tenant = process.env.MICROSOFT_TENANT_ID ?? "common";
  const response = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: ["offline_access", "User.Read", "Calendars.Read"].join(" "),
      }),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!response.ok || !payload.access_token) return undefined;

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

  return payload.access_token;
}
