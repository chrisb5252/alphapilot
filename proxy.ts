import { clerkMiddleware } from "@clerk/nextjs/server";

// Each page and route handler that accesses private data performs its own auth check.
// This avoids path-matcher drift and Clerk's deprecated createRouteMatcher helper.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
