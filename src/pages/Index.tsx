import { useNavigate } from "react-router-dom";
import { HardHat, Truck, Lock } from "lucide-react";
import { motion } from "framer-motion";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center bg-[#FFFFFF] font-sans selection:bg-[#001E50] selection:text-white">
      {/* Header & Identity */}
      <header className="w-full flex flex-col items-center pt-16 pb-8 px-4">
        <motion.img
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          src="/vw-logo.svg"
          alt="Volkswagen Logo"
          className="w-24 h-24 md:w-32 md:h-32 mb-6"
        />
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-2xl md:text-4xl font-bold text-[#001E50] text-center tracking-tight"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          SmartAndon Volkswagen Taubaté
        </motion.h1>
      </header>

      {/* Main Profiles */}
      <main className="w-full max-w-4xl flex-1 flex flex-col items-center justify-center px-6 gap-8 pb-12">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          {/* Operator Card */}
          <motion.button
            whileHover={{ y: -4, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            onClick={() => navigate("/operador")}
            className="group flex flex-col items-center justify-center gap-6 p-10 bg-white rounded-3xl shadow-xl hover:shadow-2xl border border-gray-100 transition-shadow w-full aspect-square md:aspect-auto md:h-80"
          >
            <div className="p-6 bg-slate-50 rounded-full group-hover:bg-[#001E50]/5 transition-colors">
              <HardHat className="h-20 w-20 text-[#001E50]" />
            </div>
            <span className="text-2xl font-bold text-[#001E50] tracking-wide">OPERADOR</span>
          </motion.button>

          {/* Logistics Card */}
          <motion.button
            whileHover={{ y: -4, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            onClick={() => navigate("/login-logistica")}
            className="group flex flex-col items-center justify-center gap-6 p-10 bg-white rounded-3xl shadow-xl hover:shadow-2xl border border-gray-100 transition-shadow w-full aspect-square md:aspect-auto md:h-80"
          >
            <div className="p-6 bg-slate-50 rounded-full group-hover:bg-[#001E50]/5 transition-colors">
              <Truck className="h-20 w-20 text-[#001E50]" />
            </div>
            <span className="text-2xl font-bold text-[#001E50] tracking-wide">LOGÍSTICA</span>
          </motion.button>
        </div>

        {/* Admin Login Section (Discreet) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 w-full flex flex-col items-center"
        >
          <button
            onClick={() => navigate("/login-logistica")}
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-[#001E50] transition-colors px-4 py-2"
          >
            <Lock className="w-4 h-4" />
            <span>Acesso Restrito</span>
          </button>
        </motion.div>

      </main>
    </div>
  );
};

export default Index;
