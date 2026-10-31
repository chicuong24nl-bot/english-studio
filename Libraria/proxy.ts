import { NextResponse, type NextRequest } from "next/server";

const appApiRoutes = new Set([
  "/api/teacher-session",
  "/api/student-session",
  "/api/classroom-state",
]);

export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Keep the previous URL working while the app now lives at the root.
  if (pathname === "/demo" || pathname.startsWith("/demo/")) {
    return NextResponse.redirect(new URL("/", request.url), 308);
  }

  // Libraria currently exposes one reading app and its classroom APIs.
  if (pathname === "/" || appApiRoutes.has(pathname)) {
    return NextResponse.next();
  }

  return new NextResponse("Not found", { status: 404 });
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
