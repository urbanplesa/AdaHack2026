import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function PacientPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "PACIENT") redirect("/zdravnik");

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Pozdravljen, {user.name}</h1>
      <p className="mt-2 text-gray-600">
        Pacient UI — v delu: vnos meritev, koledar zdravil, SOS gumb,
        knjižnjica, AI asistent.
      </p>
    </main>
  );
}
