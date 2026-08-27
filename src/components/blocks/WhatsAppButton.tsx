"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { CONTACT } from "@/lib/data";

export function WhatsAppButton() {
  const pathname = usePathname();
  /* Pages with a sticky mobile action bar — float above it there. */
  const hasStickyBar =
    pathname.startsWith("/product/") ||
    pathname.startsWith("/build-your-own") ||
    pathname.startsWith("/checkout");

  return (
    <a
      href={CONTACT.whatsappHref}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with us on WhatsApp"
      className={cn(
        "fixed right-5 z-40 flex h-12 w-12 items-center justify-center rounded-sm bg-olive text-cream shadow-[0_4px_20px_rgba(43,47,27,0.35)] transition-opacity duration-200 ease-bloom hover:opacity-85",
        hasStickyBar
          ? "bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+5rem)] lg:bottom-[max(env(safe-area-inset-bottom),1.25rem)]"
          : "bottom-[max(env(safe-area-inset-bottom),1.25rem)]",
      )}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden>
        <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.33 4.95L2.05 22l5.3-1.39a9.87 9.87 0 0 0 4.69 1.19h.01c5.46 0 9.9-4.44 9.9-9.9a9.83 9.83 0 0 0-2.9-7A9.83 9.83 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.17-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.22-8.23 8.22Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.73-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
      </svg>
    </a>
  );
}
