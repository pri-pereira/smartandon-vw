import { Home, Database, BarChart2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const Header = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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
        setIsLoggedIn(true);

        // Captura o primeiro nome do usuário
        const fullName: string = user.user_metadata?.full_name || "";
        const firstName = fullName.trim().split(" ")[0];
        setUserName(firstName);
      }
    };
    checkAdmin();
  }, []);

  return (
    <header className="w-full bg-primary px-4 py-3 flex items-center justify-between shadow-md">
      <Button
        variant="ghost"
        onClick={() => navigate("/")}
        className="text-primary-foreground hover:bg-primary/80 h-16 w-16 rounded-2xl"
      >
        <Home className="h-10 w-10" />
      </Button>
      <button onClick={() => navigate("/")} className="flex items-center gap-2 flex-col leading-none">
        <span className="text-lg md:text-xl font-bold text-primary-foreground tracking-wide leading-tight">
          SMARTANDON
        </span>
        {isLoggedIn && (
          <span className="text-[11px] text-white/70 font-medium tracking-wide leading-none">
            {userName ? `Bem vindo! ${userName}` : "Bem-vindo ao SmartAndon VW"}
          </span>
        )}
      </button>

      {/* Renders Admin Button if user is admin, else empty div for flex spacing */}
      {isAdmin ? (
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate("/relatorios")}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-sm rounded-xl px-4 h-12 flex items-center gap-2 transition-all active:scale-95"
          >
            <BarChart2 className="h-4 w-4 md:h-5 md:w-5" />
            <span className="text-sm md:text-base font-bold hidden md:inline">System Analytics</span>
          </Button>
          <Button
            onClick={() => navigate("/admin/pecas")}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-sm rounded-xl px-4 h-12 flex items-center gap-2 transition-all active:scale-95"
          >
            <Database className="h-4 w-4 md:h-5 md:w-5" />
            <span className="text-sm md:text-base font-bold hidden md:inline">Admin Peças</span>
          </Button>
        </div>
      ) : (
        <div className="w-10"></div>
      )}
    </header>
  );
};

export default Header;
