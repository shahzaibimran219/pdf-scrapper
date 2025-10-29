import clsx from "clsx";

type Props = {
  children: React.ReactNode;
  intent?: "default" | "success" | "warning" | "danger";
  className?: string;
};

export function Badge({ children, intent = "default", className }: Props) {
  const intents = {
    default: "bg-zinc-100 text-zinc-800",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
  } as const;
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", intents[intent], className)}>
      {children}
    </span>
  );
}


