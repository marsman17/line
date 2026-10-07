import { GuestVisit } from "../../../components/guest";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <GuestVisit token={token} />;
}
