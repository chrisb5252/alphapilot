import { auth } from "@clerk/nextjs/server";

/**
 * Use in server components, route handlers, and server actions that require a user.
 */
export async function requireUserId() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  return userId;
}
