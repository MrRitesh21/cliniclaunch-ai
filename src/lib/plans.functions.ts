import { createServerFn } from "@tanstack/react-start";

export const getPublicPlans = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plans, error } = await supabaseAdmin
      .from("plans")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error || !plans) {
      console.error("[getPublicPlans] Database query error:", error);
      return [];
    }
    return plans;
  } catch (err) {
    console.error("[getPublicPlans] Server error:", err);
    return [];
  }
});
