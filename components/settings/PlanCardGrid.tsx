"use client";
import PlanCard from "./PlanCard";

export default function PlanCardGrid({ billing }: { billing: { planType: string; credits: number } }) {
  const plans = [
    {
      name: "Basic",
      price: 10,
      credits: 10000,
      desc: "Best for regular recruiters and job seekers.",
    },
    {
      name: "Pro",
      price: 20,
      credits: 20000,
      desc: "Advanced users, agencies, and power parsers.",
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {plans.map((plan) => (
        <PlanCard key={plan.name} plan={plan} billing={billing} />
      ))}
    </div>
  );
}
