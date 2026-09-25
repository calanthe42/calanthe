# UI audit — 2026-09-25

`http://localhost:3100` · 18 device sizes · 6 pages · Chromium + WebKit

**2565 findings**, 129 distinct.

Screenshots: `docs/reports/ui-audit/<page>/<device>-<engine>.png`

## error (3)

| Page | Detail | Devices | Widths |
| --- | --- | --- | --- |
| checkout | Unhandled Promise Rejection: ChunkLoadError: Loading chunk 9515 failed.
(error: http://localhost:3100/_next/static/chunks/9515.ac1f48e6e7efd | 4 | 375, 390, 393, 430 |
| checkout | Fetch API cannot load http: /localhost:3100/checkout?_rsc=3VWDRFJDRULDBOY3 due to access control checks. | 1 | 320 |
| checkout | Failed to fetch RSC payload for http://localhost:3100/checkout. Falling back to browser navigation. TypeError: Load failed | 1 | 320 |

## tap-target (53)

| Page | Detail | Devices | Widths |
| --- | --- | --- | --- |
| product | a.inline-flex.min-h-11.items-center 34x44 | 54 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| home | a.inline-flex.min-h-11.items-center 40x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| home | a.inline-flex.min-h-11.items-center 34x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| home | a.inline-flex.min-h-11.items-center 43x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| home | a.inline-flex.min-h-11.items-center 35x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| home | a.inline-flex.min-h-11.items-center 36x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| shop | button.min-h-11.whitespace-nowrap.px-1 34x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| shop | button.min-h-11.whitespace-nowrap.px-1 40x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| shop | a.inline-flex.min-h-11.items-center 40x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| shop | a.inline-flex.min-h-11.items-center 34x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| shop | a.inline-flex.min-h-11.items-center 43x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| shop | a.inline-flex.min-h-11.items-center 35x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| shop | a.inline-flex.min-h-11.items-center 36x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| product | a.inline-flex.min-h-11.items-center 40x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| product | a.inline-flex.min-h-11.items-center 43x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| product | a.inline-flex.min-h-11.items-center 35x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| product | a.inline-flex.min-h-11.items-center 36x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| checkout | a.inline-flex.min-h-11.items-center 40x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| checkout | a.inline-flex.min-h-11.items-center 34x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| checkout | a.inline-flex.min-h-11.items-center 43x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| checkout | a.inline-flex.min-h-11.items-center 35x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| checkout | a.inline-flex.min-h-11.items-center 36x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| delivery | a.inline-flex.min-h-11.items-center 40x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| delivery | a.inline-flex.min-h-11.items-center 34x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| delivery | a.inline-flex.min-h-11.items-center 43x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| delivery | a.inline-flex.min-h-11.items-center 35x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| delivery | a.inline-flex.min-h-11.items-center 36x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| build-your-own | a.inline-flex.min-h-11.items-center 40x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| build-your-own | a.inline-flex.min-h-11.items-center 34x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| build-your-own | a.inline-flex.min-h-11.items-center 43x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| build-your-own | a.inline-flex.min-h-11.items-center 35x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| build-your-own | a.inline-flex.min-h-11.items-center 36x44 | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| shop | button.group/tab.relative.flex 41x44 | 23 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834 |
| home | a.relative.flex.h-11 42x44 | 4 | 1280, 1366, 1440, 1920 |
| home | button.inline-flex.min-h-11.items-center 32x44 | 4 | 1280, 1366, 1440, 1920 |
| home | button.inline-flex.min-h-11.items-center 19x44 | 4 | 1280, 1366, 1440, 1920 |
| shop | a.relative.flex.h-11 42x44 | 4 | 1280, 1366, 1440, 1920 |
| shop | button.inline-flex.min-h-11.items-center 32x44 | 4 | 1280, 1366, 1440, 1920 |
| shop | button.inline-flex.min-h-11.items-center 19x44 | 4 | 1280, 1366, 1440, 1920 |
| product | a.relative.flex.h-11 42x44 | 4 | 1280, 1366, 1440, 1920 |
| product | button.inline-flex.min-h-11.items-center 32x44 | 4 | 1280, 1366, 1440, 1920 |
| product | button.inline-flex.min-h-11.items-center 19x44 | 4 | 1280, 1366, 1440, 1920 |
| checkout | a.relative.flex.h-11 42x44 | 4 | 1280, 1366, 1440, 1920 |
| checkout | button.inline-flex.min-h-11.items-center 32x44 | 4 | 1280, 1366, 1440, 1920 |
| checkout | button.inline-flex.min-h-11.items-center 19x44 | 4 | 1280, 1366, 1440, 1920 |
| delivery | a.relative.flex.h-11 42x44 | 4 | 1280, 1366, 1440, 1920 |
| delivery | button.inline-flex.min-h-11.items-center 32x44 | 4 | 1280, 1366, 1440, 1920 |
| delivery | button.inline-flex.min-h-11.items-center 19x44 | 4 | 1280, 1366, 1440, 1920 |
| build-your-own | a.relative.flex.h-11 42x44 | 4 | 1280, 1366, 1440, 1920 |
| build-your-own | button.inline-flex.min-h-11.items-center 32x44 | 4 | 1280, 1366, 1440, 1920 |
| build-your-own | button.inline-flex.min-h-11.items-center 19x44 | 4 | 1280, 1366, 1440, 1920 |
| home | button.flex.h-11.w-11 44x44 | 2 | 320, 393 |
| product | button.flex.h-11.w-11 44x44 | 1 | 1920 |

## type-too-small (73)

| Page | Detail | Devices | Widths |
| --- | --- | --- | --- |
| home | a.skip-link.m-3.inline-flex@12px "Skip to content" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| home | p.hidden.font-brand.text-[0.6875rem]@11px "Delivering across all seven Emirates" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| home | a.relative.flex.h-11@12px "About Calanthe" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| home | p.font-brand.text-xs.font-medium@12px "Sealed by hand" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| home | a.inline-flex.min-h-11.items-center@14px "Delivery Information" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| shop | a.skip-link.m-3.inline-flex@12px "Skip to content" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| shop | p.hidden.font-brand.text-[0.6875rem]@11px "Delivering across all seven Emirates" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| shop | a.relative.flex.h-11@12px "About Calanthe" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| shop | p.font-brand.text-xs.font-medium@12px "The Collection" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| shop | p.font-brand.text-[0.625rem].font-medium@10px "10 arrangements" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| shop | button.min-h-11.whitespace-nowrap.px-1@11px "Under AED 300" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| shop | p.mt-1.5.font-brand.text-[0.625rem]@10px "View arrangement" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| shop | p.font-brand.text-[0.6875rem].font-medium@11px "Flower Atelier — UAE" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| shop | a.inline-flex.min-h-11.items-center@14px "Delivery Information" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| product | a.skip-link.m-3.inline-flex@12px "Skip to content" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| product | p.hidden.font-brand.text-[0.6875rem]@11px "Delivering across all seven Emirates" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| product | a.relative.flex.h-11@12px "About Calanthe" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| product | p.font-brand.text-xs.font-medium@12px "The Collection" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| product | span.text-xs.text-ink-muted@12px "As photographed" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| product | span.block.font-brand.text-xs@12px "Card and recipient" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| product | span.mt-1.block.text-sm@14px "Optional. Add a handwritten card and who" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| product | label.mb-2.block.font-brand@10px "Recipient name" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| checkout | a.skip-link.m-3.inline-flex@12px "Skip to content" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| checkout | p.hidden.font-brand.text-[0.6875rem]@11px "Delivering across all seven Emirates" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| checkout | a.relative.flex.h-11@12px "About Calanthe" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| checkout | label.mb-2.block.font-brand@10px "Recipient name" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| checkout | p.mt-1.text-sm.leading-relaxed@14px "Pay the courier when your flowers arrive" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| checkout | span.font-brand.text-xs.font-medium@12px "Show order summary" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| checkout | p.mt-4.text-sm.leading-relaxed@14px "Paid in cash when your flowers arrive." | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| checkout | button.items-center.justify-center.gap-2@13px "Place Order — AED 480" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| checkout | a.text-olive.underline.decoration-hairline@14px "Message a florist" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| delivery | a.skip-link.m-3.inline-flex@12px "Skip to content" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| delivery | p.hidden.font-brand.text-[0.6875rem]@11px "Delivering across all seven Emirates" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| delivery | a.relative.flex.h-11@12px "About Calanthe" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| delivery | span.rounded-sm.border.border-hairline@14px "10:00 – 13:00" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| delivery | p.font-brand.text-[0.6875rem].font-medium@11px "Flower Atelier — UAE" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| delivery | a.inline-flex.min-h-11.items-center@14px "Delivery Information" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| delivery | p.text-sm.text-cream/75@14px "© 2026 Calanthe" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| build-your-own | a.skip-link.m-3.inline-flex@12px "Skip to content" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| build-your-own | p.hidden.font-brand.text-[0.6875rem]@11px "Delivering across all seven Emirates" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| build-your-own | a.relative.flex.h-11@12px "About Calanthe" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| build-your-own | p.mt-1.text-sm.text-ink-muted@14px "Choose as many as you like." | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| build-your-own | span.mt-0.5.block.text-sm@14px "A palette picked on the morning" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| build-your-own | label.mb-2.block.font-brand@10px "Anything else about the colours?" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| build-your-own | label.flex.min-h-11.cursor-pointer@14px "Leave the card blank" | 27 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834, 1280, 1366, 1440, 1920 |
| home | p.text-center.font-brand.text-[0.6875rem]@11px "Every arrangement composed by hand" | 23 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834 |
| home | p.mb-4.font-brand.text-[0.6875rem]@11px "Flower Atelier — UAE" | 23 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834 |
| home | a.inline-flex.items-center.justify-center@13px "Shop the collection" | 23 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834 |
| home | p.font-brand.text-[0.6875rem].font-medium@11px "Send flowers for" | 23 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834 |
| shop | p.text-center.font-brand.text-[0.6875rem]@11px "Every arrangement composed by hand" | 23 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834 |
| product | p.text-center.font-brand.text-[0.6875rem]@11px "Every arrangement composed by hand" | 23 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834 |
| product | button.inline-flex.items-center.justify-center@13px "Add to Cart — AED 480" | 23 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834 |
| checkout | p.text-center.font-brand.text-[0.6875rem]@11px "Every arrangement composed by hand" | 23 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834 |
| delivery | p.text-center.font-brand.text-[0.6875rem]@11px "Every arrangement composed by hand" | 23 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834 |
| build-your-own | p.text-center.font-brand.text-[0.6875rem]@11px "Every arrangement composed by hand" | 23 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834 |
| build-your-own | span.text-xs.text-ink-muted@12px "Sent to someone else" | 23 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834 |
| build-your-own | p.font-brand.text-xs.font-medium@12px "Estimated total" | 23 | 320, 344, 360, 375, 390, 393, 402, 412, 420, 430, 440, 744, 834 |
| home | a.inline-flex.items-center.justify-center@11.2px "Build Your Own" | 12 | 320, 344, 360, 375, 390, 393 |
| home | a.inline-flex.items-center.justify-center@12px "Build Your Own" | 11 | 402, 412, 420, 430, 440, 744, 834 |
| home | p.text-center.font-brand.text-[0.6875rem]@12px "Every arrangement composed by hand" | 4 | 1280, 1366, 1440, 1920 |
| home | p.mb-4.font-brand.text-[0.6875rem]@12px "Flower Atelier — UAE" | 4 | 1280, 1366, 1440, 1920 |
| home | a.inline-flex.items-center.justify-center@13px "Build Your Own" | 4 | 1280, 1366, 1440, 1920 |
| home | p.font-brand.text-[0.6875rem].font-medium@12px "Send flowers for" | 4 | 1280, 1366, 1440, 1920 |
| home | p.font-brand.text-[0.6875rem].font-medium@11px "Flower Atelier — UAE" | 4 | 1280, 1366, 1440, 1920 |
| shop | p.text-center.font-brand.text-[0.6875rem]@12px "Every arrangement composed by hand" | 4 | 1280, 1366, 1440, 1920 |
| product | p.text-center.font-brand.text-[0.6875rem]@12px "Every arrangement composed by hand" | 4 | 1280, 1366, 1440, 1920 |
| product | p.-mt-1.text-base.text-ink-muted@14px "Used only to coordinate delivery. The pr" | 4 | 1280, 1366, 1440, 1920 |
| checkout | p.text-center.font-brand.text-[0.6875rem]@12px "Every arrangement composed by hand" | 4 | 1280, 1366, 1440, 1920 |
| delivery | p.text-center.font-brand.text-[0.6875rem]@12px "Every arrangement composed by hand" | 4 | 1280, 1366, 1440, 1920 |
| delivery | p.max-w-lg.text-base.leading-relaxed@14px "Before every delivery, your florist send" | 4 | 1280, 1366, 1440, 1920 |
| build-your-own | p.text-center.font-brand.text-[0.6875rem]@12px "Every arrangement composed by hand" | 4 | 1280, 1366, 1440, 1920 |
| build-your-own | p.mt-3.max-w-md.text-base@14px "Every budget is composed with the same c" | 4 | 1280, 1366, 1440, 1920 |
| build-your-own | span@14px "If a colour is not in season on the day," | 4 | 1280, 1366, 1440, 1920 |

