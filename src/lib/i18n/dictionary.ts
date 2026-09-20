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
    byOccasion: "By occasion",
    skipToContent: "Skip to content",
  },
  strip: {
    emirates: "Delivering across all seven Emirates",
    video: "Video approval on every order",
    /* No same-day claim and no countdown: the atelier does not offer
       same-day delivery, so a ticker promising it was simply untrue. */
    composed: "Every arrangement composed by hand",
  },
  search: {
    label: "Search the atelier",
    placeholder: "Roses, birthday, Amber Hour…",
    close: "Close search",
    suggestionsTitle: "Popular right now",
    resultsTitle: "Arrangements",
    viewAll: "View all results",
    searchWhole: "Search the whole collection",
    noResultsTitle: "Nothing by that name.",
    noResultsBody:
      "Try an occasion, a flower, or the name of an arrangement — or tell a florist what you have in mind.",
    askFlorist: "Ask a florist on WhatsApp",
    browseAll: "Browse the collection",
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
    sameDayTitle: "Delivered on your day",
    sameDayCopy: "Choose the day and the window that suit them.",
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
  /**
   * The basket and the checkout.
   *
   * Short, functional strings — labels, buttons, states. Kept in one place
   * because they appear on the two screens where an untranslated word is
   * most expensive: the ones where money is involved.
   */
  cart: {
    title: "Your Cart",
    close: "Close cart",
    empty: "Your cart is waiting to bloom.",
    emptyBody: "Choose an arrangement, or have one composed for you.",
    shopFlowers: "Shop Flowers",
    buildYourOwn: "Build Your Own",
    loading: "Loading your cart",
    subtotal: "Subtotal",
    delivery: "Delivery",
    deliveryAtCheckout: "Calculated at checkout",
    deliveryFree: "Complimentary",
    checkout: "Checkout",
    continueShopping: "Continue shopping",
    remove: "Remove",
    removeItem: "Remove {name} from cart",
    increase: "Increase quantity of {name}",
    decrease: "Decrease quantity of {name}",
    quantity: "Quantity {n}",
    completeTheGift: "Complete the gift",
    freeDeliveryAway: "{amount} away from complimentary delivery",
    freeDeliveryReached: "Your delivery is complimentary",
    giftMessageIncluded: "Gift message included",
    droppedOne: "One arrangement is no longer available and has been removed.",
    droppedMany:
      "{n} arrangements are no longer available and have been removed.",
  },
  /** The customer account: sign in, create, verify, reset. */
  account: {
    eyebrow: "Your account",
    signInTitle: "Welcome back.",
    signInIntro:
      "Sign in to see your orders and the details we keep for your deliveries.",
    registerTitle: "Keep your details close.",
    registerIntro:
      "An account remembers your addresses and your past arrangements. You never need one to order — every bouquet can be sent as a guest.",
    forgotTitle: "Let's get you back in.",
    forgotIntro:
      "Tell us the address you signed up with and we will send a link to choose a new password.",
    resetTitle: "Choose a new password.",
    resetIntro: "Pick something you have not used elsewhere.",
    verifiedTitle: "Your email is confirmed.",
    verifiedIntro:
      "That is everything. You can sign in with your email and password from now on — we will not ask you to confirm again.",
    expiredTitle: "That link has expired.",
    incompleteTitle: "That link is incomplete.",
    incompleteIntro:
      "The reset link is missing its token. Ask for a new one and it will arrive within a minute or two.",
    name: "Your name",
    email: "Email",
    phoneOptional: "Phone (optional)",
    password: "Password",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    confirmNewPassword: "Confirm new password",
    passwordHint: "At least 10 characters.",
    signIn: "Sign in",
    createAccount: "Create account",
    creating: "Creating your account…",
    signingIn: "Signing you in…",
    sendLink: "Send the link",
    sendNewLink: "Send a new link",
    sending: "Sending…",
    saveNewPassword: "Save new password",
    saving: "Saving…",
    resend: "Resend the email",
    resent: "Sent again",
    backToSignIn: "Back to sign in",
    newHere: "New here?",
    haveAccount: "Already have an account?",
    forgotLink: "Forgotten your password?",
    rememberedIt: "Remembered it?",
    checkInbox: "Check {email} for a link to confirm your address. It expires in a few hours.",
    checkInboxNote:
      "Nothing is active until you confirm — you can still order as a guest in the meantime.",
    resetSentIfExists:
      "If that address has an account with us, a link to choose a new password is on its way. It expires in about an hour.",
    resendIfWaiting:
      "If that address is waiting to be confirmed, a new link is on its way.",
    passwordChanged: "Your password has been changed. You can sign in with it now.",
  },
  pages: {
    shopEyebrow: "The Collection",
    shopTitle: "Composed this morning, at your door today.",
    shopIntro:
      "Every arrangement is built stem by stem in the atelier — no two ever quite the same.",
    shopReadyEyebrow: "Ready made for today",
    shopReadyTitle: "Made this morning, gone by evening.",
    arrangementOne: "arrangement",
    arrangementMany: "arrangements",
    occasionsEyebrow: "Occasions",
    occasionsTitle: "For every unspoken thing.",
    occasionsIntro:
      "Some things are easier handed over than said. Begin with the moment, and we will compose the rest.",
    occasionOne: "occasion",
    occasionMany: "occasions",
  },
  footer: {
    shop: "Shop",
    help: "Help",
    contact: "Contact",
    about: "About",
    memberships: "Memberships",
    events: "Events",
    delivery: "Delivery Information",
    faqs: "FAQs",
    terms: "Terms & Conditions",
    privacy: "Privacy Policy",
    refunds: "Refund & Cancellation Policy",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    email: "Email",
    rights: "© 2026 Calanthe",
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
    byOccasion: "حسب المناسبة",
    skipToContent: "تخطٍّ إلى المحتوى",
  },
  strip: {
    emirates: "نوصّل إلى الإمارات السبع",
    video: "موافقتك بالفيديو على كل طلب",
    composed: "كل باقة تُنسَّق يدويًا",
  },
  search: {
    label: "ابحثي في الأتيليه",
    placeholder: "ورد، عيد ميلاد، ساعة العنبر…",
    close: "إغلاق البحث",
    suggestionsTitle: "الأكثر بحثًا الآن",
    resultsTitle: "الباقات",
    viewAll: "عرض كل النتائج",
    searchWhole: "ابحثي في المجموعة كاملة",
    noResultsTitle: "لا شيء بهذا الاسم.",
    noResultsBody:
      "جرّبي مناسبة، أو نوع زهرة، أو اسم باقة — أو أخبري منسّقة الزهور بما يدور في بالك.",
    askFlorist: "اسألي منسّقة الزهور على واتساب",
    browseAll: "تصفّحي المجموعة",
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
    sameDayTitle: "توصيل في يومك المختار",
    sameDayCopy: "اختاري اليوم والوقت المناسبين لهم.",
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
  cart: {
    title: "سلّتك",
    close: "إغلاق السلة",
    empty: "سلّتك تنتظر أن تُزهر.",
    emptyBody: "اختاري باقة جاهزة، أو دعينا نُنسّق واحدة خصيصًا لك.",
    shopFlowers: "تسوّقي الزهور",
    buildYourOwn: "صمّمي باقتك",
    loading: "جارٍ تحميل سلّتك",
    subtotal: "المجموع الفرعي",
    delivery: "التوصيل",
    deliveryAtCheckout: "يُحتسب عند إتمام الطلب",
    deliveryFree: "مجاني",
    checkout: "إتمام الطلب",
    continueShopping: "متابعة التسوّق",
    remove: "إزالة",
    removeItem: "إزالة {name} من السلة",
    increase: "زيادة كمية {name}",
    decrease: "إنقاص كمية {name}",
    quantity: "الكمية {n}",
    completeTheGift: "أتمّي الهدية",
    freeDeliveryAway: "يفصلك {amount} عن التوصيل المجاني",
    freeDeliveryReached: "توصيلك مجاني",
    giftMessageIncluded: "تتضمّن بطاقة إهداء",
    droppedOne: "باقة واحدة لم تعد متوفرة وقد أُزيلت.",
    droppedMany: "{n} باقات لم تعد متوفرة وقد أُزيلت.",
  },
  account: {
    eyebrow: "حسابك",
    signInTitle: "أهلًا بعودتك.",
    signInIntro: "سجّلي الدخول لمتابعة طلباتك والتفاصيل التي نحفظها لتوصيلاتك.",
    registerTitle: "احفظي تفاصيلك معنا.",
    registerIntro:
      "الحساب يحفظ عناوينك وباقاتك السابقة. ولستِ بحاجة إليه للطلب — كل باقة يمكن إرسالها كزائرة.",
    forgotTitle: "لنُعِدك إلى حسابك.",
    forgotIntro:
      "أخبرينا بالبريد الذي سجّلتِ به وسنرسل رابطًا لاختيار كلمة مرور جديدة.",
    resetTitle: "اختاري كلمة مرور جديدة.",
    resetIntro: "اختاري كلمة لم تستخدميها في مكان آخر.",
    verifiedTitle: "تم تأكيد بريدك.",
    verifiedIntro:
      "هذا كل شيء. يمكنك تسجيل الدخول ببريدك وكلمة المرور من الآن — ولن نطلب التأكيد مرة أخرى.",
    expiredTitle: "انتهت صلاحية هذا الرابط.",
    incompleteTitle: "هذا الرابط غير مكتمل.",
    incompleteIntro:
      "رابط إعادة التعيين ينقصه الرمز. اطلبي رابطًا جديدًا وسيصلك خلال دقيقة أو دقيقتين.",
    name: "الاسم",
    email: "البريد الإلكتروني",
    phoneOptional: "الهاتف (اختياري)",
    password: "كلمة المرور",
    newPassword: "كلمة المرور الجديدة",
    confirmPassword: "تأكيد كلمة المرور",
    confirmNewPassword: "تأكيد كلمة المرور الجديدة",
    passwordHint: "عشرة أحرف على الأقل.",
    signIn: "تسجيل الدخول",
    createAccount: "إنشاء حساب",
    creating: "جارٍ إنشاء حسابك…",
    signingIn: "جارٍ تسجيل دخولك…",
    sendLink: "إرسال الرابط",
    sendNewLink: "إرسال رابط جديد",
    sending: "جارٍ الإرسال…",
    saveNewPassword: "حفظ كلمة المرور",
    saving: "جارٍ الحفظ…",
    resend: "إعادة إرسال البريد",
    resent: "تم الإرسال مجددًا",
    backToSignIn: "العودة لتسجيل الدخول",
    newHere: "جديدة هنا؟",
    haveAccount: "لديك حساب بالفعل؟",
    forgotLink: "نسيتِ كلمة المرور؟",
    rememberedIt: "تذكّرتِها؟",
    checkInbox: "تفقّدي {email} لرابط تأكيد بريدك. تنتهي صلاحيته خلال ساعات.",
    checkInboxNote:
      "لا شيء يُفعَّل قبل التأكيد — ويمكنك الطلب كزائرة في هذه الأثناء.",
    resetSentIfExists:
      "إذا كان لهذا البريد حساب لدينا، فرابط اختيار كلمة مرور جديدة في طريقه إليك. تنتهي صلاحيته خلال ساعة تقريبًا.",
    resendIfWaiting: "إذا كان هذا البريد بانتظار التأكيد، فرابط جديد في طريقه إليك.",
    passwordChanged: "تم تغيير كلمة المرور. يمكنك تسجيل الدخول بها الآن.",
  },
  pages: {
    shopEyebrow: "المجموعة",
    shopTitle: "تُنسّق صباحًا، وتصل إلى بابك اليوم.",
    shopIntro: "كل باقة تُبنى ساقًا بساق في الأتيليه — ولا تتشابه اثنتان.",
    shopReadyEyebrow: "جاهز للتوصيل اليوم",
    shopReadyTitle: "تُنسّق صباحًا، وتنفد مساءً.",
    arrangementOne: "باقة",
    arrangementMany: "باقة",
    occasionsEyebrow: "المناسبات",
    occasionsTitle: "لكل ما لا يُقال.",
    occasionsIntro:
      "بعض الأشياء تُقدَّم أسهل مما تُقال. ابدئي باللحظة، ونتكفّل نحن بالباقي.",
    occasionOne: "مناسبة",
    occasionMany: "مناسبة",
  },
  footer: {
    shop: "المتجر",
    help: "المساعدة",
    contact: "تواصلي معنا",
    about: "عن كالانثي",
    memberships: "الاشتراكات",
    events: "المناسبات",
    delivery: "معلومات التوصيل",
    faqs: "الأسئلة الشائعة",
    terms: "الشروط والأحكام",
    privacy: "سياسة الخصوصية",
    refunds: "سياسة الاسترجاع والإلغاء",
    whatsapp: "واتساب",
    instagram: "إنستغرام",
    email: "البريد الإلكتروني",
    rights: "© 2026 كالانثي",
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
