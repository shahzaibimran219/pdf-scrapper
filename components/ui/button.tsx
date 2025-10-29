"use client";
import clsx from "clsx";
import * as React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  const base = "cursor-pointer inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none";
  const sizes = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  } as const;
  const variants = {
    primary: "bg-black text-white hover:bg-zinc-800 focus:ring-black",
    secondary: "bg-white text-black border border-zinc-300 hover:bg-zinc-50 focus:ring-zinc-400",
    danger: "bg-red-600 text-white hover:bg-red-500 focus:ring-red-500",
    ghost: "bg-transparent hover:bg-zinc-100",
  } as const;
  return (
    <button className={clsx(base, sizes[size], variants[variant], className)} {...props} />
  );
}


