import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * The middleware already redirects "/" to /login or /dashboard before this
 * ever renders — this is just a defensive fallback for the same logic in
 * case middleware is ever bypassed, not the primary routing path.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
