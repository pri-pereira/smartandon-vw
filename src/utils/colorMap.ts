export const getCardColorClasses = (colorName: string | undefined | null) => {
    const normalizedColor = colorName?.trim().toLowerCase();

    switch (normalizedColor) {
        case "azul":
            return "bg-blue-100 border-l-[12px] border-l-blue-400 border-y-2 border-y-transparent border-r-2 border-r-transparent text-gray-900";
        case "rosa":
            return "bg-pink-100 border-l-[12px] border-l-pink-400 border-y-2 border-y-transparent border-r-2 border-r-transparent text-gray-900";
        case "amarelo":
            return "bg-yellow-100 border-l-[12px] border-l-yellow-400 border-y-2 border-y-transparent border-r-2 border-r-transparent text-gray-900";
        case "branco":
        default:
            return "bg-white border-l-[12px] border-l-gray-300 border-y-2 border-y-transparent border-r-2 border-r-transparent text-gray-900";
    }
};
