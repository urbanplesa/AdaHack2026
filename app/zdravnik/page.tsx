import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function ZdravnikPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ZDRAVNIK") redirect("/pacient");

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Dashboard — {user.name}</h1>
      <p className="mt-2 text-gray-600">
        Zdravnik UI — v delu: seznam pacientov s statusom, čakalna vrsta
        alarmov, podrobnosti meritev.
      </p>
    </main>
  );
}
