import { useNavigate } from "react-router-dom";
import { HardHat, Truck } from "lucide-react";
import Header from "@/components/Header";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <h1 className="text-2xl font-bold text-primary text-center">
          Célula de Vidros
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg">
          <button
            onClick={() => navigate("/operador")}
            className="flex flex-col items-center justify-center gap-4 p-8 rounded-lg border-2 border-primary bg-background hover:bg-primary hover:text-primary-foreground text-primary transition-all active:scale-95 shadow-md"
          >
            <HardHat className="h-16 w-16" />
            <span className="text-xl font-bold">OPERADOR</span>
          </button>
          <button
            onClick={() => navigate("/logistica")}
            className="flex flex-col items-center justify-center gap-4 p-8 rounded-lg border-2 border-primary bg-background hover:bg-primary hover:text-primary-foreground text-primary transition-all active:scale-95 shadow-md"
          >
            <Truck className="h-16 w-16" />
            <span className="text-xl font-bold">LOGÍSTICA</span>
          </button>
        </div>
      </main>
    </div>
  );
};

export default Index;
