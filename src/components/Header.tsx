import { Factory } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Header = () => {
  const navigate = useNavigate();

  return (
    <header className="w-full bg-primary px-4 py-3 flex items-center justify-center shadow-md">
      <button onClick={() => navigate("/")} className="flex items-center gap-3">
        <Factory className="h-8 w-8 text-primary-foreground" />
        <span className="text-xl font-bold text-primary-foreground tracking-wide">
          SMART ANDON
        </span>
      </button>
    </header>
  );
};

export default Header;
