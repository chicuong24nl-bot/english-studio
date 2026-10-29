import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const clerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

const demoOnly = process.env.NODE_ENV === "production" && !clerkConfigured;

export default demoOnly
  ? (request: NextRequest) => {
      if (request.nextUrl.pathname === "/") {
        return NextResponse.redirect(new URL("/demo", request.url));
      }
      if (request.nextUrl.pathname === "/demo") {
        return NextResponse.next();
      }
      if (request.nextUrl.pathname === "/api/teacher-session") {
        return NextResponse.next();
      }
      return new NextResponse("Not found", { status: 404 });
    }
  : clerkConfigured
    ? clerkMiddleware()
    : () => NextResponse.next();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
