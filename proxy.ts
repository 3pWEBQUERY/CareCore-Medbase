import { NextResponse, type NextRequest } from "next/server";

// Verwaltung: ohne Sitzungs-Cookie direkt zur Anmeldung (die Seiten prüfen die Sitzung selbst vollständig).
// Der Pfad geht als Kopfzeile an die Seite, damit sie nach der Anmeldung dorthin zurückführen kann.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!request.cookies.has("medbase_session")) {
    const login = request.nextUrl.clone();
    login.pathname = "/anmelden";
    login.search = "";
    login.searchParams.set("weiter", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  const headers = new Headers(request.headers);
  headers.set("x-medbase-path", `${pathname}${search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
