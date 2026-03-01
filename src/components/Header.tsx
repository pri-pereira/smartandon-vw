import { Factory, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Header = () => {
  const navigate = useNavigate();

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
        <Factory className="h-8 w-8 text-primary-foreground" />
        <span className="text-xl font-bold text-primary-foreground tracking-wide">
          SMART ANDON
        </span>
      </button>
      <div className="w-10"></div>
    </header>
  );
};

export default Header;
