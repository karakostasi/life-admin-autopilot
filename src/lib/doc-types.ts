// Εικονίδιο ανά τύπο εγγράφου (emoji: χωρίς εξαρτήσεις)
export const TYPE_ICONS: Record<string, string> = {
  car_insurance: "🚗",
  ktel_ktheo: "🔧",
  road_tax: "🧾",
  passport: "🛂",
  id_card: "🪪",
  driving_license: "🚘",
  home_insurance: "🏠",
  health_insurance: "🩺",
  warranty: "🛡️",
  contract: "🔁",
  other: "📄",
};

export const typeIcon = (type: string) => TYPE_ICONS[type] ?? "📄";
