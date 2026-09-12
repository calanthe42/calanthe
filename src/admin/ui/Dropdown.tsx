"use client";

import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { buttonClasses } from "./Button";
import { Icon, type IconName } from "./icons";

/**
 * A menu button — the "⋯" on a row.
 *
 * The WAI-ARIA menu button pattern: ↓/↑ move, Home/End jump, typing a letter
 * moves to the next item starting with it, Enter activates, Escape and Tab
 * close and return focus to the button.
 *
 * The menu is portalled to <body> and positioned against the viewport, so a
 * table's scroll container can never clip it. It opens below the button,
 * aligned to the button's inline end (the right in English, the left in
 * Arabic), and flips above when there is no room.
 */

export type DropdownItem = {
  key: string;
  label: string;
  icon?: IconName;
  href?: string;
  external?: boolean;
  onSelect?: () => void;
  tone?: "default" | "danger";
  separatorBefore?: boolean;
};

const ITEM =
  "flex min-h-11 w-full items-center gap-2.5 rounded-sm px-3 text-start text-sm outline-none transition-colors duration-150 hover:bg-hover focus-visible:bg-hover focus-visible:shadow-[inset_0_0_0_2px_var(--a-focus)] sm:min-h-9";

export function Dropdown({
  label,
  items,
  text,
  icon = "more",
  align = "end",
}: {
  /** Accessible name of the button and the menu, e.g. "More actions for Amber Hour". */
  label: string;
  items: readonly DropdownItem[];
  /** Visible button text; without it the button is icon-only. */
  text?: string;
  icon?: IconName;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const menuId = useId();

  useEffect(() => setMounted(true), []);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const t = trigger.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    const rtl = getComputedStyle(trigger).direction === "rtl";
    const gap = 6;
    const margin = 8;

    /* Inline end is the right edge in LTR and the left edge in RTL. */
    let left = (align === "end") !== rtl ? t.right - m.width : t.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - m.width - margin));

    let top = t.bottom + gap;
    if (top + m.height > window.innerHeight - margin && t.top - gap - m.height >= margin) {
      top = t.top - gap - m.height;
    }
    setPosition({ top, left });
  }, [open, align]);

  useEffect(() => {
    if (!open || !position) return;
    menuRef.current
      ?.querySelector<HTMLElement>('[role="menuitem"]')
      ?.focus({ preventScroll: true });
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onViewportChange = () => close(false);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open, close]);

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (list.length === 0) return;
    const index = list.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => list[(i + list.length) % list.length]?.focus({ preventScroll: true });

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(index + 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        focusAt(index - 1);
        return;
      case "Home":
        event.preventDefault();
        focusAt(0);
        return;
      case "End":
        event.preventDefault();
        focusAt(list.length - 1);
        return;
      case "Escape":
      case "Tab":
        event.preventDefault();
        close(true);
        return;
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        const now = Date.now();
        const key = event.key.toLocaleLowerCase();
        const buffer = now - typeahead.current.at < 600 ? typeahead.current.text + key : key;
        typeahead.current = { text: buffer, at: now };
        const ordered = [...list.slice(index + 1), ...list.slice(0, index + 1)];
        ordered
          .find((el) => (el.textContent ?? "").trim().toLocaleLowerCase().startsWith(buffer))
          ?.focus({ preventScroll: true });
      }
    }
  }

  function renderItem(item: DropdownItem) {
    const classes = cn(ITEM, item.tone === "danger" ? "text-danger" : "text-ink");
    const content = (
      <>
        {item.icon ? <Icon name={item.icon} className="h-4 w-4 opacity-80" /> : null}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.external ? <Icon name="external" className="h-3.5 w-3.5 opacity-60" /> : null}
      </>
    );

    if (item.href && item.external) {
      return (
        <a role="menuitem" tabIndex={-1} href={item.href} target="_blank" rel="noreferrer" className={classes} onClick={() => close(false)}>
          {content}
        </a>
      );
    }
    if (item.href) {
      return (
        <Link role="menuitem" tabIndex={-1} href={item.href} className={classes} onClick={() => close(false)}>
          {content}
        </Link>
      );
    }
    return (
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        className={classes}
        onClick={() => {
          /* Focus goes back to the trigger first, so a dialog opened by this
             item returns focus there when it closes. */
          close(true);
          item.onSelect?.();
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={text ? undefined : label}
        title={text ? undefined : label}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={
          text
            ? buttonClasses({ size: "sm" })
            : "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line-strong bg-surface text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink sm:h-9 sm:w-9"
        }
      >
        {text ? (
          <>
            {text}
            <Icon name="chevronDown" className="h-4 w-4" />
          </>
        ) : (
          <Icon name={icon} className="h-5 w-5" />
        )}
      </button>

      {open && mounted
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              onKeyDown={onMenuKeyDown}
              style={{
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                visibility: position ? "visible" : "hidden",
              }}
              className="fixed z-[70] min-w-52 max-w-[calc(100vw-1rem)] rounded-md border border-line bg-raised p-1 text-ink shadow-raised"
            >
              {items.map((item) => (
                <Fragment key={item.key}>
                  {item.separatorBefore ? <div role="separator" className="my-1 h-px bg-line" /> : null}
                  {renderItem(item)}
                </Fragment>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
