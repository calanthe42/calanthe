# Calanthe — Arabic QA of the live site

**Site:** https://www.calanthe.ae (live, after PR #18) · **Date:** 3 October 2026
**How it was tested:** real browsers driven by Playwright — Chrome at 1440×900 (desktop) and Safari's engine (WebKit) on an iPhone 13 Pro Max profile (mobile). Arabic was switched on with the site's own language button, then every page was opened, scrolled to the end and screenshotted, and the main flows were clicked through: menus, search, product → cart, checkout, Build Your Own, events form.
**Read-only:** no form, enquiry or order was submitted. Checkout and the events form were only pressed empty to see the error messages; every POST was blocked in the browser.

**Pages covered (desktop + mobile):** home, shop, product (Quiet Devotion — the only product on sale), occasions, birthday, graduation, build your own, membership, events, about, delivery, FAQs, terms, privacy, refund policy, wishlist, account, login, checkout, 404 — plus the phone menu, desktop drop-downs, search, cart drawer and checkout errors.

Screenshots are in this folder, numbered as below.

---

## Summary

| Group | Count | Most important |
|---|---|---|
| Translation issues | 24 | "طقس" (ritual) for the membership; "الجلسات الحميمة" still on About; "جاهز للتوصيل اليوم" implies same-day; the shortcut band "أرسلوا الزهور لـ … الفاخرة" is broken Arabic |
| RTL / UI issues | 6 | Desktop hero headline sits on top of the bouquet; add-on rows aligned wrong; "AED 60+" plus sign on the wrong side |
| Mobile issues | 4 | **Delivery days cut off and unreachable** on checkout and product page; close ✕ overlaps the menu |
| Functional / content issues | 6 | **Product description is placeholder text ("example example…")**; product name only in English; legal pages are placeholders |
| Pages that passed | 13 | see the end |

The plural-address rewrite is live and holds: no verb on any page addresses one woman. Every match the scan raised (أبوظبي، اختياري، زهوري، يمكنني) is a correct word or first person.

---

## 1. Translation issues

Severity: **High** = wrong or misleading for an Emirati reader · **Medium** = unnatural / literal · **Low** = polish.

| # | Sev | Where | Current text | Corrected Arabic | What to change |
|---|---|---|---|---|---|
| T1 | High | Membership page (title of step 1, tier copy, CTA), homepage ritual block | طقس أسبوعي · اختاروا طقسكم · ابدؤوا طقسكم · أغنى طقوسنا الأسبوعية | موعدكم الأسبوعي مع الزهور · اختاروا باقتكم · ابدؤوا اشتراككم · أغنى اشتراكاتنا الأسبوعية | "طقس" means a rite/ritual and carries a religious sense in Arabic. Use اشتراك / موعد أسبوعي everywhere "ritual" was translated. |
| T2 | High | About → Services → Events | للاحتفالات الخاصة والجلسات الحميمة والمناسبات الأكبر | للاحتفالات الخاصة والجلسات العائلية والمناسبات الأكبر | "حميمة" reads as intimate/romantic. Already fixed on the Events page, still on About. |
| T3 | High | Header menu, mobile menu, shop page eyebrow | جاهز للتوصيل اليوم | جاهز للطلب | Promises delivery today. Same-day delivery must never be mentioned. Same in English ("Ready Made for Today"). |
| T4 | High | Homepage, shortcut band directly under the hero | أرسلوا الزهور لـ · أعياد الميلاد · التخرّج · المولود الجديد · الحب · بلا مناسبة · الفاخرة | Lead-in: **زهور لكل مناسبة:** · last link: **الباقات الفاخرة** | "لـ" can't stand alone before a row of links, and the last link "الفاخرة" ("the luxurious") reads as "send flowers for the luxurious". Same lead-in in English is fine; the Arabic needs its own phrasing. |
| T5 | Medium | Homepage hero headline | حيث تتّخذ المشاعر شكلها. | حيث تتجسّد المشاعر. | Literal ("take form"). The About page already closes with "حيث تتجسّد المشاعر." — use one line for the brand line. |
| T6 | Medium | Homepage, seal section heading | لا شيء يخرج من هذا الأتيليه مفتوحًا. | كل ما يخرج من الأتيليه مختومٌ بعناية. | Literal and odd ("nothing leaves open"). |
| T7 | Medium | Homepage, seal section body | يُغلّف بورق مُحفّر، ويُربط بشريطنا المطبوع، ويُختم بالشعار — يُضغط والزهور ما زالت باردة من الأتيليه. | يُغلّف بورق منقوش، ويُربط بشريطنا المطبوع، ويُختم بشعارنا والزهور ما زالت باردة من الأتيليه. | "مُحفّر" is the wrong word for embossed; "يُضغط" has no clear subject. |
| T8 | Medium | Homepage, promise band | نعِدُ به في كل طلب. | وعودنا في كل طلب. | Fragment ("we promise it…"). |
| T9 | Medium | Homepage, promise band + delivery card | اختاروا اليوم والوقت المناسبين لهم. | اختاروا اليوم والوقت المناسبين لكم. | "لهم" (for them) has no referent here. |
| T10 | Medium | Homepage, video approval | شاهدوها قبل أن تصلكم. · وافقوا عليها، فتنطلق إليكم | شاهدوها قبل أن تصل. · وافقوا عليها، فتنطلق إلى وجهتها | A gift goes to the recipient, not to the buyer. |
| T11 | Medium | Homepage, Instagram line | باقات تغادر الأتيليه، في معظم الصباحات. | باقات تخرج من الأتيليه كل صباح تقريبًا. | Literal word order. |
| T12 | Medium | Occasions page intro | بعض الأشياء تُقدَّم أسهل مما تُقال. | بعض المشاعر يسهل إهداؤها أكثر من قولها. | Ungrammatical comparison. |
| T13 | Medium | Build Your Own, budget note | التنسيق الأصغر ببساطة أكثر هدوءًا. | والتنسيق الأصغر أهدأ حضورًا فحسب. | Literal ("is simply quieter"). |
| T14 | Medium | Membership (tiers, steps) and BYO | سيقان موسمية · نحجز لكم مسار التوصيل والسيقان | زهور موسمية · نحجز لكم موعد التوصيل والزهور | "سيقان" (stems) is florist jargon; customers say زهور. Use it in customer copy. |
| T15 | Medium | Membership, most-loved tier badge | المفضّلة | الأكثر طلبًا | "المفضّلة" is also the wishlist's name in the menu. |
| T16 | Medium | Events, booth text | ومنضدته هي حيث تُنسَّق الزهور في الحال. | وعلى منضدته تُنسَّق الزهور أمام الضيوف. | Literal structure. |
| T17 | Medium | Events, arrangements list | قطع وسط الطاولات، منخفضة أو لافتة الارتفاع | تنسيقات لوسط الطاولات، منخفضة أو عالية | "لافتة الارتفاع" is unnatural. |
| T18 | Medium | Events, favors heading | شيء يأخذه الجميع معه. | هدية يحملها كل ضيف معه. | Vague. |
| T19 | Low | Events form, occasion chip | مناسبة للشركات | مناسبة مؤسسية | Shorter, standard term. |
| T20 | Low | Product page, card section | اختياري. أضيفوا بطاقة مكتوبة بخط اليد، ومن سيستلمها. | اختياري. أضيفوا بطاقة بخط اليد، واسم من سيستلمها. | "ومن سيستلمها" is missing its noun. |
| T21 | Low | Footer vs page title | سياسة الاسترجاع والإلغاء (footer) / سياسة الاسترداد والإلغاء (page) | سياسة الاسترداد والإلغاء (both) | Same page, two names. |
| T22 | Low | Homepage promise band link | …يجيبكم منسّق الزهور عبر WhatsApp | …يجيبكم منسّق الزهور عبر واتساب | The only Latin "WhatsApp" left in running Arabic text (the footer already says واتساب). |
| T23 | Low | Wishlist empty state | انقروا على القلب… | اضغطوا على القلب… | "انقروا" is mouse language; most customers are on phones. |
| T24 | Low | Membership "How it works" heading | كيف تعمل | كيف تعمل العضوية | Incomplete on its own. |

**Decision for you, not a mistake:** prices show as **AED 650** (Latin). Emirati Arabic sites usually write **650 درهم** or **650 د.إ**. Say if you want it changed; it touches every price on the site.

**Not visible as text, but read aloud by screen readers in English (Arabic page):**

| Where | Current | Corrected |
|---|---|---|
| Occasion tiles (home, occasions) image descriptions | Birthday arrangements · Graduation arrangements · New Born arrangements · Love arrangements · Just Because arrangements | باقات أعياد الميلاد · باقات التخرّج · باقات المولود الجديد · باقات الحب · باقات بلا مناسبة |
| Menu button | Open menu / Close menu | فتح القائمة / إغلاق القائمة |
| Language button | Switch to English | التبديل إلى الإنجليزية |
| Heart on product cards | Add Quiet Devotion to wishlist | أضيفوا Quiet Devotion إلى المفضّلة |
| Browser's own "required field" bubble (events form) | Please fill out this field. | يُرجى تعبئة هذا الحقل. (set as a custom message) |

---

## 2. RTL / UI issues

| # | Sev | Where | Problem | Screenshot |
|---|---|---|---|---|
| R1 | High | Homepage hero, desktop | In Arabic the headline moves to the right — exactly where the bouquet is in the photo — so white text sits on white daisies and red roses and is hard to read. The photo isn't mirrored with the layout. | 06 |
| R2 | High | Product page, add-ons (desktop + mobile) | Each row reads "checkbox … [name + price bunched on the left]". The name should sit at the start (right) and the price at the end (left); the labels are forced `text-align: left`. | 03 |
| R3 | Medium | Product page add-ons, cart "complete the gift" | Prices show **AED 60+** — the plus sign is pushed to the wrong end by the RTL direction. Should read **+ AED 60**. | 03, 04 |
| R4 | Medium | Checkout + product page, time windows | Windows show as "13:00 – 10:00", "17:00 – 13:00" — read right-to-left that is correct, but many readers see a backwards range. Clearer: **من 10:00 إلى 13:00**. | 01 |
| R5 | Low | FAQ page and membership FAQ | Question buttons are set to `text-align: left`. Invisible while a question fits on one line; a question that wraps on a narrow phone aligns its second line to the left. | 07 |
| R6 | Low | Cart quantity stepper | Shows "+ 1 −" with + on the left. In RTL the increase button is normally at the start (right). | 04 |

---

## 3. Mobile issues

| # | Sev | Where | Problem | Screenshot |
|---|---|---|---|---|
| M1 | **Critical** | Checkout → delivery day, and product page → delivery day | The row of days is wider than the screen and runs off the left edge. Thursday and Friday are cut off and **cannot be scrolled to** — the row grew instead of scrolling inside itself. A customer cannot pick those days. | 01 |
| M2 | Medium | Phone menu | When the menu list is scrolled, the close ✕ stays put and sits on top of "الرئيسية"; the search field scrolls up under it. | 05 |
| M3 | Low | Phone menu | "التسوق حسب المناسبة" appears twice — inside المتجر and again as its own line. | 05 |
| M4 | Low | Checkout | Emirate line says "أبوظبي — التوصيل AED 30" while the line below says delivery is free on this order (basket over AED 350). Confusing; show "مجاني" in the line when it is free. | 01 |

---

## 4. Functional / content issues

| # | Sev | Where | Problem |
|---|---|---|---|
| F1 | **Critical** | Product page "Quiet Devotion" (both sizes) | The description is placeholder text: "example exampleexample exampleexample…". It comes from the product record in the admin, not from the translation. | 
| F2 | High | Product name everywhere (card, product page, cart, checkout) | "Quiet Devotion" is English only — products have no Arabic name field yet, so the Arabic page shows English names. |
| F3 | High | Shop | Only **one** product is on sale. |
| F4 | High | Terms, Privacy, Refund policy | All three are placeholder pages: "هيكل مبدئي — الصياغة النهائية تصل مع النص القانوني المعتمد" under every heading. Needed before card payments. |
| F5 | Medium | Membership + Delivery, Help | Delivery is free over AED 350 — the client's WhatsApp note ("For this the delivery is for free") may mean Abu Dhabi delivery is always free. Needs her answer. |
| F6 | Low | Safari, moving between pages | The test logged "access control checks" errors on Safari page-to-page navigation. The server answers those requests correctly, and the errors match the test leaving pages quickly, so this is **not confirmed** as a real bug. Worth one look on a real iPhone. |

What worked: language toggle (header and phone menu) switches the whole site to RTL; search finds results and shows the Arabic "لا شيء بهذا الاسم." empty state; add to cart, cart drawer, checkout validation messages (all Arabic), Build Your Own steps and summary (no English left), WhatsApp links (all go to the same number), desktop drop-downs stay on screen at 1100–1440 px, no page scrolls sideways, no broken images or failed requests, 404 page in Arabic.

---

## 5. Pages that passed

No translation, RTL or layout problem found on these, desktop or mobile:

- Occasions → Birthday, Graduation (empty-collection pages)
- Build Your Own (after today's fix — no English left, summary in Arabic)
- Events (apart from wording T16–T19)
- Delivery
- Wishlist (apart from T23)
- Account and Login
- Checkout empty state ("السلة تنتظر أن تُزهر.")
- 404 page
- Search overlay
- Desktop drop-down menus
- Footer
- Cart drawer (apart from R3/R6)
- Language switch

---

## Suggested fix order

1. **M1** delivery days cut off (blocks orders on Thursday/Friday) and **F1** placeholder description.
2. **T1–T4** (ritual, intimate, same-day, broken hero line) and **R1–R3**.
3. The rest of the translation table, then screen-reader labels.
4. F2/F4 need content from the client: Arabic product names and the approved legal text.
