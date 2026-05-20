export const plans = {
  starter: {
    name: "Starter",
    price: 799,
    currency: "PHP",
    trialDays: 14,
    registers: 1,
    features: ["checkout", "inventory", "offline"]
  },
  pro: {
    name: "Pro",
    price: 1299,
    currency: "PHP",
    trialDays: 14,
    registers: 2,
    features: ["checkout", "inventory", "customers", "reports", "offline", "backup"]
  },
  business: {
    name: "Business",
    price: 2199,
    currency: "PHP",
    trialDays: 14,
    registers: 5,
    features: ["checkout", "inventory", "customers", "reports", "offline", "backup", "multi-store"]
  }
};

export function getPlan(planKey) {
  return plans[planKey] || plans.pro;
}
