import Link from "next/link";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "secondary-cream";

const base =
  "inline-flex min-h-12 items-center justify-center rounded-sm px-8 py-3 " +
  "font-brand text-[0.8125rem] font-medium uppercase tracking-brand " +
  "transition-[opacity,filter,transform] duration-200 ease-bloom " +
  "select-none focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "active:scale-[0.985]";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-burnt-orange text-cream hover:brightness-95 focus-visible:outline-burnt-orange",
  secondary:
    "border border-olive text-olive hover:opacity-70 focus-visible:outline-olive",
  "secondary-cream":
    "border border-cream text-cream hover:opacity-75 focus-visible:outline-cream",
};

export function buttonClasses(variant: ButtonVariant, className?: string): string {
  return cn(base, variants[variant], className);
}

type ButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button className={buttonClasses(variant, className)} {...props} />;
}

type ButtonLinkProps = React.ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonVariant;
};

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, className)} {...props} />;
}
