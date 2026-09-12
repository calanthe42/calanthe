import { cn } from "@/lib/cn";

/**
 * The admin's icon set: one consistent 24px, 1.6-stroke line drawing each.
 *
 * Inline SVG rather than an icon package — the admin needs about forty
 * shapes, and a library of thousands would be weight carried on every page.
 * Server-renderable, so there is no hydration cost.
 *
 * Icons that point somewhere (chevrons, arrows, "leave") are mirrored in
 * right-to-left layouts automatically; symmetric ones are not.
 */

const PATHS = {
  dashboard: "M4 4h6v8H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 16h6v4H4z",
  flower:
    "M12 21v-7M12 14c-3 0-5-2.2-5-5.5V4l2.5 2L12 3l2.5 3L17 4v4.5c0 3.3-2 5.5-5 5.5ZM12 18c-2 0-3.6-.9-4.5-2.6M12 19.5c2.1 0 3.7-1 4.6-2.8",
  occasion:
    "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM8 3v4M16 3v4M4 10h16M12 17.6s-3-1.8-3-3.7a1.5 1.5 0 0 1 3-.5 1.5 1.5 0 0 1 3 .5c0 1.9-3 3.7-3 3.7Z",
  image: "M4 5h16v14H4zM4 15.5l4.5-4.5 4 4 2.5-2.5L20 17.5M15.5 9.5h.01",
  tag: "M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0ZM8 8h.01",
  bag: "M5 8h14l-1 12H6ZM9 8V6.5a3 3 0 0 1 6 0V8",
  users:
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.2a6.5 6.5 0 0 1 3 5.8",
  message: "M4 5h16v11H9.5L4 20ZM8 9.5h8M8 12.5h5",
  sparkles:
    "M11 3l1.8 4.9L18 9.5l-5.2 1.8L11 16l-1.8-4.7L4 9.5l5.2-1.6ZM18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z",
  truck:
    "M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  star: "M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.5l-5.1 2.7 1-5.7-4.1-4 5.7-.8Z",
  megaphone: "M4 10v4h3l8 4.5v-13L7 10ZM18.5 9.5a3.5 3.5 0 0 1 0 5M7 14l1.5 5",
  staff:
    "M4 5h16v14H4zM9 11.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 16.5a3 3 0 0 1 6 0M14.5 9.5h3.5M14.5 13h3.5",
  settings:
    "M4 7h9M17 7h3M15 5v4M4 12h3M11 12h9M9 10v4M4 17h11M19 17h1M17 15v4",
  store:
    "M4 9l1.5-5h13L20 9M4 9h16v1.5a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0 2.7 2.7 0 0 1-5.3 0V9M5 12.5V20h14v-7.5M10 20v-5h4v5",
  globe:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.5 12h17M12 3c2.4 2.5 3.5 5.5 3.5 9s-1.1 6.5-3.5 9c-2.4-2.5-3.5-5.5-3.5-9S9.6 5.5 12 3Z",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2.5v2M12 19.5v2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M2.5 12h2M19.5 12h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
  moon: "M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z",
  monitor: "M3 5h18v11H3zM8 20h8M12 16v4",
  logout: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  chevronRight: "M9 6l6 6-6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronDown: "M6 9l6 6 6-6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  check: "M5 12.5l4.5 4.5L19 7",
  alert: "M12 4l9 16H3ZM12 10v4M12 17h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01",
  checkCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12.5l2.7 2.7L16 9.8",
  edit: "M4 20h4L19 9l-4-4L4 16ZM13.5 6.5l4 4",
  eye: "M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  calendar: "M5 5h14v15H5zM8 3v4M16 3v4M5 10h14",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  trendUp: "M4 16l6-6 4 4 6-6M15 8h5v5",
  trendDown: "M4 8l6 6 4-4 6 6M15 16h5v-5",
  box: "M4 8l8-4 8 4v8l-8 4-8-4ZM4 8l8 4 8-4M12 12v8",
  filter: "M4 5h16l-6 7.5V19l-4 2v-8.5Z",
  photoOff: "M4 5h16v14H4zM4 4l16 16",
  phone:
    "M6.5 4h3l1.5 4-2 1.2a10 10 0 0 0 5.8 5.8L16 13l4 1.5v3a1.5 1.5 0 0 1-1.5 1.5A15 15 0 0 1 5 5.5 1.5 1.5 0 0 1 6.5 4Z",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  gift: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-1.5-3-5-3-5-1s3 1 5 1ZM12 7c1.5-3 5-3 5-1s-3 1-5 1Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0",
} as const;

export type IconName = keyof typeof PATHS | "more";

/* Shapes that point somewhere, and so flip in right-to-left layouts. */
const DIRECTIONAL = new Set<IconName>([
  "chevronRight",
  "chevronLeft",
  "arrowRight",
  "arrowLeft",
  "logout",
  "external",
  "trendUp",
  "trendDown",
  "message",
]);

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const classes = cn("h-5 w-5 shrink-0", DIRECTIONAL.has(name) && "rtl:-scale-x-100", className);

  if (name === "more") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden focusable="false" className={classes} fill="currentColor">
        <circle cx="5.5" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="18.5" cy="12" r="1.6" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      className={classes}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
