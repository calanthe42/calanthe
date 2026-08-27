import { cn } from "@/lib/cn";

type StaggerProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Group whose direct children reveal 80ms apart (CSS nth-child delays).
 * Server component — triggered once by MotionObserver.
 */
export function Stagger({ children, className }: StaggerProps) {
  return (
    <div data-io className={cn("io-stagger", className)}>
      {children}
    </div>
  );
}

type StaggerItemProps = {
  children: React.ReactNode;
  className?: string;
};

/** Direct child of <Stagger> — kept as a named component for call-site clarity. */
export function StaggerItem({ children, className }: StaggerItemProps) {
  return <div className={className}>{children}</div>;
}
