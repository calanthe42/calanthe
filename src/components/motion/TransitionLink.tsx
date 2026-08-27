"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type TransitionLinkProps = React.ComponentPropsWithoutRef<typeof Link>;

/**
 * Same-document View Transition navigation (morphs elements sharing a
 * view-transition-name). Falls back to a normal push where the API is
 * unsupported.
 */
export function TransitionLink({ href, onClick, ...props }: TransitionLinkProps) {
  const router = useRouter();

  return (
    <Link
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (
          typeof document !== "undefined" &&
          "startViewTransition" in document &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          e.preventDefault();
          document.startViewTransition(() => {
            router.push(typeof href === "string" ? href : String(href));
          });
        }
      }}
      {...props}
    />
  );
}
