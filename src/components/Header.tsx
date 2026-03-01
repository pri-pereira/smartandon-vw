import { Home, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const Header = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin");

        const hasAdminRole = roles && roles.length > 0;
        const hasMetadataAdmin = user.user_metadata?.role === "admin";
        setIsAdmin(hasAdminRole || hasMetadataAdmin);
      }
    };
    checkAdmin();
  }, []);

  return (
    <header className="w-full bg-primary px-4 py-3 flex items-center justify-between shadow-md">
      <Button
        variant="ghost"
        onClick={() => navigate("/")}
        className="text-primary-foreground hover:bg-primary/80 h-14 w-14 rounded-2xl"
      >
        <Home className="h-8 w-8" />
      </Button>
      <button onClick={() => navigate("/")} className="flex items-center gap-3">
        <img src="/vw-logo.svg" alt="VW Logo" className="h-8 w-8" />
        <span className="text-xl font-bold text-primary-foreground tracking-wide hidden sm:inline">
          SMARTANDON
        </span>
      </button>

      {/* Renders Admin Button if user is admin, else empty div for flex spacing */}
      {isAdmin ? (
        <Button
          onClick={() => navigate("/admin/pecas")}
          className="bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-sm rounded-xl px-4 h-12 flex items-center gap-2 transition-all active:scale-95"
        >
          <Database className="h-4 w-4 md:h-5 md:w-5" />
          <span className="text-sm md:text-base font-bold hidden md:inline">Admin Peças</span>
        </Button>
      ) : (
        <div className="w-10"></div>
      )}
    </header>
  );
};

export default Header;
