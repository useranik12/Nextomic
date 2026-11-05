import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";

export default async function RootPage() {
  const sessionData = await getServerSession();
  redirect(sessionData ? "/dashboard" : "/sign-in");
}
