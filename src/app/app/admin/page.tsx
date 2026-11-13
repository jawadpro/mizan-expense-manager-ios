import { notFound } from "next/navigation";
import Admin from "@/components/Admin";
import { getUser } from "@/lib/auth";
import "../../admin.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function Page() {
  const user = await getUser().catch(() => null);
  if (!user || user.role !== "admin") notFound();
  return <Admin me={user.id} />;
}
