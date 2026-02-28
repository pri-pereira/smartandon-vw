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
    <div className="grid grid-cols-3 gap-3 w-full max-w-xs mx-auto">
      {keys.map((key) => (
        <Button
          key={key}
          variant="outline"
          className="h-16 text-2xl font-bold border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground active:scale-95 transition-transform"
          onClick={() => handleDigit(key)}
        >
          {key}
        </Button>
      ))}
      <Button
        variant="outline"
        className="h-16 border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
        onClick={handleBackspace}
      >
        <Delete className="h-6 w-6" />
      </Button>
      <Button
        variant="outline"
        className="h-16 text-2xl font-bold border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground active:scale-95 transition-transform"
        onClick={() => handleDigit("0")}
      >
        0
      </Button>
      <div />
    </div>
  );
};

export default NumericKeypad;
