"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";

export async function setParkingDoneAction(id: string, done: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("parking").update({ done }).eq("id", z.uuid().parse(id));
  revalidatePath("/pensees");
}

export async function deleteParkingAction(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("parking").delete().eq("id", z.uuid().parse(id));
  revalidatePath("/pensees");
}
