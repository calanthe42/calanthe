type IconProps = {
  className?: string;
};

/* Thin-line 24px icons, 1.5 stroke, currentColor — quiet luxury. */

export function IconHeart({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 20s-7-4.53-9.33-9.06C1.06 7.79 3.1 4.5 6.4 4.5c2.02 0 3.6 1.14 4.6 2.6.5.73.87 1.15 1 1.15s.5-.42 1-1.15c1-1.46 2.58-2.6 4.6-2.6 3.3 0 5.34 3.29 3.73 6.44C19 15.47 12 20 12 20Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconBag({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M5.5 8.5h13l-.9 11a1.5 1.5 0 0 1-1.5 1.38H7.9a1.5 1.5 0 0 1-1.5-1.38l-.9-11Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 11V6.5a3.5 3.5 0 0 1 7 0V11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconUser({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 20c.8-3.2 3.6-5 7-5s6.2 1.8 7 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
