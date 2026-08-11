import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession() reads the locally stored session (and only hits the network
    // when the token actually needs refreshing). getUser() forced a round trip
    // to Supabase on every single dashboard navigation.
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  component: () => <Outlet />,
});
