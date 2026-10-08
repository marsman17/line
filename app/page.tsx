import { cookies } from "next/headers";
import { db } from "../lib/db";
import { hash } from "../lib/security";
import Dashboard from "../components/dashboard";
import Marketing from "../components/marketing";
export default async function Page() {
  const secret = (await cookies()).get("tableq_session")?.value;
  const signedIn =
    secret &&
    db
      .prepare(
        "SELECT m.id FROM sessions s JOIN managers m ON m.id=s.manager_id WHERE s.token_hash=? AND s.expires>?",
      )
      .get(hash(secret), Date.now());
  return signedIn ? <Dashboard /> : <Marketing />;
}
