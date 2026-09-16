/**
 * The storefront's two languages.
 *
 * WHY THIS EXISTS. The language control used to set `lang` and `dir` and
 * nothing else — the page stayed in English, which makes the control a
 * decoration rather than a feature. This is the dictionary it was always
 * meant to plug into.
 *
 * WHAT IS TRANSLATED. Everything the site itself says: navigation, the menu,
 * the hero, every section heading and its supporting line, the service
 * promises, the footer, and the labels around buying. What is NOT translated
 * is anything the owner types into /admin — product names, descriptions,
 * occasion names — because those live in the database in the language she
 * wrote them, and inventing Arabic for a product name is not a translation,
 * it is a guess.
 *
 * THE ARABIC IS MODERN STANDARD ARABIC, written to match the brand's quiet
 * register rather than translated literally. It should be read by a native
 * speaker before launch — the same caveat docs/ADMIN.md already records for
 * the admin's dictionary. The structure makes that a single-file edit, and
 * the type below guarantees nothing can be missed.
 */

export const en = {
  nav: {
    home: "Home",
    about: "About Calanthe",
    shop: "Shop",
    shopAll: "Shop all",
    shopByOccasion: "Shop by Occasion",
    readyToday: "Ready Made for Today",
    buildYourOwn: "Build Your Own",
    memberships: "Memberships",
    events: "Events",
    eventsAll: "Events all",
    guestFavors: "Guest Favors",
    eventArrangements: "Event Arrangements",
    account: "Account",
    search: "Search arrangements",
    cart: "Cart",
    wishlist: "Wishlist",
    viewAll: "View all",
    atelier: "Flower Atelier — UAE",
  },
  hero: {
    eyebrow: "Flower Atelier — UAE",
    headlineOne: "Where feelings",
    headlineTwo: "take form.",
    shopFlowers: "Shop Flowers",
    buildYourOwn: "Build Your Own",
  },
  band: {
    sendFlowersFor: "Send flowers for",
    sameDay: "Same-Day",
    luxury: "Luxury",
  },
  sections: {
    newArrivalsEyebrow: "New Arrivals",
    newArrivalsTitle: "Fresh from the atelier.",
    occasionsEyebrow: "Shop by Occasion",
    occasionsTitle: "For every unspoken thing.",
    bestSellersEyebrow: "Best Sellers",
    bestSellersTitle: "Loved, week after week.",
    touchTitle: "The Calanthe Touch",
    promiseTitle: "Promised on every order.",
    promiseAsk: "Questions before you order? A florist answers on",
    instagramLine: "Arrangements as they leave the atelier, most mornings.",
  },
  touch: {
    handTitle: "Hand-arranged daily",
    handCopy:
      "Every stem is chosen and placed by hand in our atelier, morning by morning.",
    wrapTitle: "Thoughtful presentation",
    wrapCopy: "Wrapped in embossed paper, tied and sealed with the Calanthe monogram.",
    deliverTitle: "Delivered with care",
    deliverCopy: "Kept cool and upright to your door, across all seven emirates.",
  },
  trust: {
    sameDayTitle: "Same-day delivery",
    sameDayCopy: "Ordered before 5pm, at their door today.",
    videoTitle: "Video approval",
    videoCopy: "See your arrangement on WhatsApp before it leaves.",
    freshTitle: "Freshness guarantee",
    freshCopy: "Composed the morning of delivery, never before.",
    emiratesTitle: "All seven Emirates",
    emiratesCopy: "One atelier, delivering across the UAE.",
  },
  empty: {
    eyebrow: "Made to order",
    title: "Every arrangement can be made to order.",
    body: "The next collection is being composed. Until it arrives, tell us the moment, the colours and your budget, and a florist will compose it for you.",
    messageFlorist: "Message a Florist",
  },
  footer: {
    shop: "Shop",
    help: "Help",
    contact: "Contact",
  },
  language: {
    label: "Language",
    english: "English",
    arabic: "العربية",
    toEnglish: "Switch to English",
    toArabic: "التبديل إلى العربية",
  },
  /* No `as const`: the leaves must infer as `string`, or `typeof en` becomes
     a set of exact English literals that no translation can satisfy. */
};

/** Arabic must provide every key English does — enforced by the type. */
export const ar: typeof en = {
  nav: {
    home: "الرئيسية",
    about: "عن كالانثي",
    shop: "المتجر",
    shopAll: "كل المتجر",
    shopByOccasion: "التسوق حسب المناسبة",
    readyToday: "جاهز للتوصيل اليوم",
    buildYourOwn: "صمّمي باقتك",
    memberships: "الاشتراكات",
    events: "المناسبات",
    eventsAll: "كل المناسبات",
    guestFavors: "هدايا الضيوف",
    eventArrangements: "تنسيقات المناسبات",
    account: "حسابي",
    search: "ابحثي عن باقة",
    cart: "الحقيبة",
    wishlist: "المفضّلة",
    viewAll: "عرض الكل",
    atelier: "أتيليه الزهور — الإمارات",
  },
  hero: {
    eyebrow: "أتيليه الزهور — الإمارات",
    headlineOne: "حيث تتّخذ المشاعر",
    headlineTwo: "شكلها.",
    shopFlowers: "تسوّقي الزهور",
    buildYourOwn: "صمّمي باقتك",
  },
  band: {
    sendFlowersFor: "أرسلي الزهور لـ",
    sameDay: "توصيل اليوم",
    luxury: "الفاخرة",
  },
  sections: {
    newArrivalsEyebrow: "وصل حديثًا",
    newArrivalsTitle: "طازجة من الأتيليه.",
    occasionsEyebrow: "التسوق حسب المناسبة",
    occasionsTitle: "لكل ما لا يُقال.",
    bestSellersEyebrow: "الأكثر طلبًا",
    bestSellersTitle: "محبوبة، أسبوعًا بعد أسبوع.",
    touchTitle: "لمسة كالانثي",
    promiseTitle: "نعِدُ به في كل طلب.",
    promiseAsk: "لديك سؤال قبل الطلب؟ تجيبك منسّقة الزهور عبر",
    instagramLine: "باقات تغادر الأتيليه، في معظم الصباحات.",
  },
  touch: {
    handTitle: "تُنسّق يدويًا كل يوم",
    handCopy: "كل ساق تُنتقى وتُنسّق يدويًا في الأتيليه، صباحًا بعد صباح.",
    wrapTitle: "تقديم يليق بها",
    wrapCopy: "تُغلّف بورق مزخرف، وتُربط وتُختم بشعار كالانثي.",
    deliverTitle: "تُوصَّل بعناية",
    deliverCopy: "تبقى منتعشة وقائمة حتى بابك، في الإمارات السبع.",
  },
  trust: {
    sameDayTitle: "توصيل في اليوم نفسه",
    sameDayCopy: "اطلبي قبل الخامسة مساءً، وتصل اليوم.",
    videoTitle: "موافقتك بالفيديو",
    videoCopy: "شاهدي باقتك عبر واتساب قبل أن تغادر.",
    freshTitle: "ضمان النضارة",
    freshCopy: "تُنسّق صباح التوصيل، لا قبل ذلك.",
    emiratesTitle: "الإمارات السبع",
    emiratesCopy: "أتيليه واحد، يوصّل في أنحاء الدولة.",
  },
  empty: {
    eyebrow: "حسب الطلب",
    title: "كل باقة يمكن أن تُصنع خصيصًا لك.",
    body: "المجموعة القادمة قيد التنسيق. وحتى تصل، أخبرينا بالمناسبة والألوان والميزانية، وتنسّقها لك إحدى منسّقات الزهور.",
    messageFlorist: "تواصلي مع منسّقة الزهور",
  },
  footer: {
    shop: "المتجر",
    help: "المساعدة",
    contact: "تواصلي معنا",
  },
  language: {
    label: "اللغة",
    english: "English",
    arabic: "العربية",
    toEnglish: "Switch to English",
    toArabic: "التبديل إلى العربية",
  },
};

export type Locale = "en" | "ar";
export type Dictionary = typeof en;

export const dictionaries: Record<Locale, Dictionary> = { en, ar };

export function dictionaryFor(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en;
}
