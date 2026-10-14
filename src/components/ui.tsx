import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none";

export const buttonStyles = {
  primary: `${base} bg-pitch-700 text-white hover:bg-pitch-600 active:bg-pitch-900`,
  secondary: `${base} bg-white text-pitch-900 ring-1 ring-black/10 hover:bg-pitch-50`,
  danger: `${base} bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50`,
  ghost: `${base} text-pitch-700 hover:bg-pitch-50`,
};

type Variant = keyof typeof buttonStyles;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${buttonStyles[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${buttonStyles[variant]} ${className}`} {...props} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 ${className}`}>{children}</section>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

export const inputStyles =
  "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-base outline-none focus:border-pitch-600 focus:ring-2 focus:ring-pitch-100 disabled:bg-neutral-100";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputStyles} ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${inputStyles} ${props.className ?? ""}`} />;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "red" }) {
  const tones = {
    neutral: "bg-neutral-100 text-neutral-700",
    green: "bg-pitch-100 text-pitch-900",
    amber: "bg-amber-100 text-amber-900",
    red: "bg-red-100 text-red-800",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-neutral-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{children}</p>;
}
