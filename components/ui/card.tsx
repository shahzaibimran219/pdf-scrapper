type Props = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className }: Props) {
  return (
    <div className={`rounded-xl border border-zinc-200 bg-white shadow-sm ${className ?? ""}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: Props) {
  return <div className={`px-6 py-4 border-b ${className ?? ""}`}>{children}</div>;
}

export function CardContent({ children, className }: Props) {
  return <div className={`px-6 py-5 ${className ?? ""}`}>{children}</div>;
}


