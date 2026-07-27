import { SecurityDetails } from "@/components/securities/security-details";

export default async function SecurityDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SecurityDetails securityId={id} />;
}
