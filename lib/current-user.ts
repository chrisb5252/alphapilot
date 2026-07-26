import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export class UnauthorizedError extends Error {}

export async function getCurrentAppUser() {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError("Sign in to access portfolios.");
  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress;
  if (!email) throw new UnauthorizedError("Your account needs a verified email address.");
  return prisma.user.upsert({ where: { clerkId: userId }, create: { clerkId: userId, email, firstName: clerkUser?.firstName, lastName: clerkUser?.lastName, imageUrl: clerkUser?.imageUrl }, update: { email, firstName: clerkUser?.firstName, lastName: clerkUser?.lastName, imageUrl: clerkUser?.imageUrl } });
}
