import { Button } from "@/components/ui/button";
import { Delete } from "lucide-react";

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

const NumericKeypad = ({ value, onChange, maxLength = 10 }: NumericKeypadProps) => {
  const handleDigit = (digit: string) => {
    if (value.length < maxLength) {
      onChange(value + digit);
    }
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="grid grid-cols-3 gap-4 w-full max-w-[280px] mx-auto">
      {keys.map((key) => (
        <Button
          key={key}
          variant="outline"
          className="h-16 text-3xl font-light rounded-2xl border-transparent bg-slate-50 text-[#001E50] shadow-sm hover:bg-[#001E50] hover:text-white transition-all active:scale-95"
          onClick={() => handleDigit(key)}
        >
          {key}
        </Button>
      ))}
      <Button
        variant="ghost"
        className="h-16 rounded-2xl text-[#001E50] hover:bg-slate-100 hover:text-[#001E50] transition-all"
        onClick={handleBackspace}
      >
        <Delete className="h-7 w-7" />
      </Button>
      <Button
        variant="outline"
        className="h-16 text-3xl font-light rounded-2xl border-transparent bg-slate-50 text-[#001E50] shadow-sm hover:bg-[#001E50] hover:text-white transition-all active:scale-95"
        onClick={() => handleDigit("0")}
      >
        0
      </Button>
      <div />
    </div>
  );
};

export default NumericKeypad;
