import { cn } from "@/lib/cn";

type EyebrowProps = {
  children: React.ReactNode;
  className?: string;
};

export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <p
      className={cn(
        "font-brand text-xs font-medium uppercase tracking-brand text-sage",
        className,
      )}
    >
      {children}
    </p>
  );
}
