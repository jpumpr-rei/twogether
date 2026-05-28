"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function deleteCategory(categoryId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id")
    .eq("id", user.id)
    .single();

  if (!profile?.couple_id) throw new Error("No household");

  // Safety: never allow deleting built-in categories
  const { data: cat } = await supabase
    .from("categories")
    .select("id, is_default")
    .eq("id", categoryId)
    .single();

  if (!cat) throw new Error("Category not found");
  if (cat.is_default) throw new Error("Cannot delete built-in categories");

  // Delete the budget for this category — FK is SET NULL not CASCADE,
  // so it would otherwise orphan in the budgets table.
  await supabase
    .from("budgets")
    .delete()
    .eq("category_id", categoryId)
    .eq("couple_id", profile.couple_id);

  // Delete the category. Transactions referencing it get category_id = NULL
  // (ON DELETE SET NULL) so no transaction data is lost.
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId);

  if (error) throw new Error(error.message);

  revalidatePath("/budgets");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}
