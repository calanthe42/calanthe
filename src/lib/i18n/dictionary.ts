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

import type { CheckoutErrorCode } from "@/lib/checkout-fields";

export const en = {
  /**
   * BUILD YOUR OWN — every word on the page.
   *
   * The consultation was written straight into the component in English, so
   * an Arabic visitor met an Arabic shell wrapped round an English form.
   * Colour names, budgets and step titles are content, not chrome: they all
   * live here now, and `ar` below is typed against this object, so a missing
   * Arabic string is a compile error rather than an English word on an
   * Arabic page.
   */
  /**
   * NAMES THAT LIVE IN THE DATABASE.
   *
   * Occasions and flower types are rows, not copy, so they arrive in English
   * whatever the reader's language — and they appear in the header on every
   * page, which is why an Arabic visitor kept meeting "Birthday" inside an
   * Arabic menu. Until the collections carry a translated name of their own,
   * the slug is looked up here and the stored name is the fallback, so a new
   * occasion still shows rather than vanishing.
   */
  occasionNames: {
    birthday: "Birthday",
    graduation: "Graduation",
    "new-born": "New Born",
    love: "Love",
    "just-because": "Just Because",
  } as Record<string, string>,
  flowerNames: {
    roses: "Roses",
    peonies: "Peonies",
    orchids: "Orchids",
    tulips: "Tulips",
    lilies: "Lilies",
    wildflowers: "Wildflowers",
  } as Record<string, string>,

  byo: {
    eyebrow: "Bespoke",
    title: "Made for them, by you.",
    /* The homepage banner animates the title as two lines, so each half is
       its own string; `title` stays the one a screen reader hears. */
    titleLine1: "Made for them,",
    titleLine2: "by you.",
    createYours: "Create Yours",
    intro: "Choose your budget, colours and preferences. We'll take care of the flowers.",
    steps: {
      budget: "Your budget",
      colours: "Colours",
      vase: "A vase?",
      card: "The card",
      notes: "For the florist",
      gift: "Who is it for?",
      contact: "Where to reach you",
    },
    budgetOther: "Another amount",
    budgetOtherLabel: "Your budget in AED",
    budgetNote:
      "Every budget is composed with the same care — a smaller arrangement is simply a quieter one.",
    coloursHint: "Choose as many as you like.",
    colourNames: {
      whitesCreams: "Whites & Creams",
      blushRose: "Blush & Rose",
      peachApricot: "Peach & Apricot",
      sunlitYellows: "Sunlit Yellows",
      burntOrangeRust: "Burnt Orange & Rust",
      redsBurgundies: "Reds & Burgundies",
      lilacPurples: "Lilac & Purples",
      greensFoliage: "Greens & Foliage",
    },
    floristChoice: "Let the florist choose",
    floristChoiceNote: "A palette picked on the morning",
    floristChoiceAnswer: "Florist's choice",
    colourNoteLabel: "Anything else about the colours?",
    colourNotePlaceholder: "A shade you love, a colour to avoid, something to match…",
    colourSeasonNote:
      "If a colour is not in season on the day, we will contact you before composing and agree the closest thing to it.",
    vaseYes: "Yes, in a vase",
    vaseNo: "No",
    vaseNoNote: "Flower bag",
    vaseAnswerYes: "With a vase",
    vaseAnswerNo: "Flower bag",
    cardPlaceholder: "Write the card message here…",
    cardLeaveBlank: "Leave the card blank",
    cardAnswerBlank: "Left blank",
    cardAnswerWritten: "Written",
    notesHint: "Optional.",
    notesPlaceholder:
      "Allergies, flowers to avoid, a style you love — anything that helps.",
    notesAnswer: "Noted",
    giftYes: "It's a gift",
    giftYesNote: "Sent to someone else",
    giftNo: "For myself",
    giftNoNote: "Delivered to me",
    giftAnswerYes: "A gift",
    giftAnswerNo: "For yourself",
    recipientName: "Their name",
    recipientPhone: "Their phone",
    recipientPhoneNote:
      "Used only to coordinate delivery. The price is never shown to them.",
    place: "Where is it going?",
    placeSelf: "Your delivery address",
    placePlaceholder: "Al Reem Island, Abu Dhabi",
    placeNote:
      "An area is enough for now — Delivery confirms the exact address with you.",
    yourName: "Your name",
    yourPhone: "Your phone",
    yourEmail: "Your email",
    summaryTitle: "Your arrangement",
    summaryBudget: "Budget",
    summaryColours: "Colours",
    summaryColourNote: "Colour note",
    summaryVase: "Vase",
    summaryCard: "Card",
    summaryNotes: "Notes",
    summaryFor: "For",
    summaryTotal: "Estimated total",
    summaryEmpty: "Not chosen yet",
    summaryNone: "None",
    send: "Send to a Florist",
    sending: "Sending…",
    sendNote:
      "Sends your request to the atelier. Nothing is ordered and nothing is charged until a florist confirms it with you.",
    seasonal:
      "Flowers are subject to seasonal availability. Our florists may substitute stems of equal or greater value while keeping the palette and spirit of your arrangement.",
    sentTitle: "Your request is with the atelier.",
    sentBody:
      "A florist will be in touch to confirm the arrangement, the delivery and the total of {total} before composing. Nothing has been charged.",
    sentReference: "Reference {reference}",
    whatsapp: "Continue on WhatsApp",
    alsoWhatsapp: "Also message on WhatsApp",
    editChoices: "Edit My Choices",
    budgetFrom: "From {min}",
    notesLabel: "Notes for the florist",
    audience: "Who is it for?",
    backToShop: "Back to the shop",
    errors: {
      budget: "Choose a budget, or type one of your own.",
      budgetMin: "The smallest arrangement we compose is {min}.",
      colours: "Choose a palette, or let the florist choose.",
      vase: "Let us know whether it goes in a vase.",
      card: "Write the card, or choose to leave it blank.",
      gift: "Tell us who it is for.",
      name: "Please tell us your name.",
      phone: "Please add a phone number we can reach you on.",
      email: "Please add an email address.",
      recipientName: "Please add the recipient's name.",
    },
  },

  nav: {
    home: "Home",
    about: "About Calanthe",
    shop: "Shop",
    shopAll: "Shop all",
    shopByOccasion: "Shop by Occasion",
    readyToday: "Ready to Order",
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
    emirates: "Delivering across Abu Dhabi",
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
    bestSellersQuote: "The arrangements our couriers know by heart.",
    bestSellersAttribution: "The Atelier",
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
    deliverCopy: "Kept cool and upright to your door, across Abu Dhabi.",
  },
  trust: {
    sameDayTitle: "Delivered on your day",
    sameDayCopy: "Choose the day and the window that suit them.",
    videoTitle: "Video approval",
    videoCopy: "See your arrangement on WhatsApp before it leaves.",
    freshTitle: "Freshness guarantee",
    freshCopy: "Composed the morning of delivery, never before.",
    emiratesTitle: "Across Abu Dhabi",
    emiratesCopy: "One atelier, delivering across Abu Dhabi.",
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
    /* Same Arabic plural problem as checkout.itemCount, same fix. */
    dropped: {
      one: "One arrangement is no longer available and has been removed.",
      two: "{n} arrangements are no longer available and have been removed.",
      few: "{n} arrangements are no longer available and have been removed.",
      many: "{n} arrangements are no longer available and have been removed.",
      other: "{n} arrangements are no longer available and have been removed.",
    },
  },
  /**
   * THE CHROME.
   *
   * Labels a screen reader reads out and nothing else, plus the few words on
   * a product card. They were written into the components in English, so the
   * Arabic site announced "Main", "Search", "Cart", "Close cart" to anyone
   * using a screen reader — the readers least able to work around it.
   */
  ui: {
    navMain: "Main navigation",
    navMobile: "Mobile navigation",
    home: "Calanthe — home",
    membershipAndEvents: "Membership and events",
    cart: "Cart",
    close: "Close",
    shopShortcuts: "Shop shortcuts",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    wishlistAdd: "Add {name} to wishlist",
    wishlistRemove: "Remove {name} from wishlist",
    wishlistSaved: "{name} saved to your wishlist",
    wishlistRemoved: "{name} removed from your wishlist",
    occasionAlt: "{name} arrangements",
    requiredField: "Please fill in this field.",
    productCategories: "Product categories",
    whatsappChat: "Chat with us on WhatsApp",
    monogram: "Calanthe monogram",

    /* On every product card in every grid. */
    from: "from",
    viewArrangement: "View arrangement",
    badgeNew: "New",
    badgeFeatured: "Featured",
    /* The header cart button, read by a screen reader. */
    cartWith: "Cart, {items}",
    cartEmpty: "Cart, empty",
    addAddon: "Add {addon} to {product}, {price}",
  },
  /**
   * The product categories, as the shop's top tab row shows them. They match
   * the labels the owner sees in /admin, which is why they live in code — but
   * the customer reads them too, so they need Arabic.
   */
  categoryNames: {
    bouquet: "Bouquets",
    "vase-arrangement": "Vase Arrangements",
    "box-arrangement": "Box Arrangements",
    basket: "Baskets",
    "single-stem": "Single Stems",
    plant: "Plants",
    "event-piece": "Event Pieces",
  } as Record<string, string>,
  /**
   * The two lead forms: a membership enquiry and an event enquiry.
   *
   * Both were written in English inside their components, which made them the
   * longest untranslated stretch on the site after the checkout — and both
   * are forms an Arabic reader is being asked to fill in and commit to.
   */
  enquiryForm: {
    /* Membership. */
    membershipThanks: "Thank you — a florist will be in touch.",
    membershipDone:
      "We have your {plan} enquiry. Nothing has been charged and no membership has started — we will agree the details with you first.",
    membershipTitle: "Begin your ritual.",
    membershipIntro:
      "Tell us how you would like it to arrive and a florist will call to agree the details. Nothing is charged here.",
    howOften: "How often",
    whichDay: "Which day suits you",
    whereItGoes: "Where it should go",
    startFrom: "Start from (optional)",
    areaOrAddress: "Area or address (optional)",
    areaPlaceholder: "Jumeirah, Dubai",
    anythingToKnow: "Anything we should know (optional)",
    anythingPlaceholder: "Colours you love, anything to avoid, where to leave them…",

    /* Events. */
    eventThanks: "Thank you — we have your event.",
    eventDone:
      "A florist will be in touch to talk through the venue, the palette and the scale. Nothing is committed and nothing has been charged.",
    whatKind: "What kind of occasion",
    company: "Company (optional)",
    date: "Date",
    guests: "Guests",
    venue: "Venue or area",
    venuePlaceholder: "Four Seasons, Jumeirah",
    alreadyKnow: "Anything you already know (optional)",
    alreadyKnowPlaceholder: "Palette, style, the feeling of the day…",

    /* Shared. */
    yourName: "Your name",
    phone: "Phone",
    email: "Email",
    reference: "Reference {number}",
    send: "Send enquiry",
    sending: "Sending…",
    messageUs: "Message us",

    frequency: {
      WEEKLY: "Weekly",
      FORTNIGHTLY: "Fortnightly",
      MONTHLY: "Monthly",
    } as Record<string, string>,
    place: {
      home: "Home",
      office: "Office",
      gift: "A gift for someone",
    } as Record<string, string>,
    /* The stored value stays the English abbreviation; only the chip changes. */
    weekdays: {
      Sun: "Sun",
      Mon: "Mon",
      Tue: "Tue",
      Wed: "Wed",
      Thu: "Thu",
      Fri: "Fri",
      Sat: "Sat",
    } as Record<string, string>,
    eventKinds: {
      Wedding: "Wedding",
      "Private celebration": "Private celebration",
      Corporate: "Corporate",
      "Launch or opening": "Launch or opening",
      "Something else": "Something else",
    } as Record<string, string>,
  },
  /**
   * WHAT THE PHOTOGRAPHS SAY.
   *
   * Alt text is copy: it is what the page reads aloud to someone who cannot
   * see the image, and to a search engine. It was written in English beside
   * each <FloralImage>, so on the Arabic site every photograph described
   * itself in the wrong language to the readers who depend on it most.
   */
  alt: {
    /* The homepage hero: the first image on the site, and its LCP. */
    hero: "A Calanthe arrangement of garden roses, daisies and coral blossom in a white vase",
    bestSellers: "White lilies with a Calanthe lily hang tag tied among them",
    byoPetal: "A lily petal lit from behind, blush against warm light",
    emptyCatalogue: "A white rose arrangement",
    packagingTerracotta:
      "A Calanthe terracotta sleeve printed with orchids, holding blush roses, white lisianthus and eucalyptus",
    packagingOlive:
      "A Calanthe olive bag printed tone on tone with orchids, holding white and blush roses",
    packagingBurgundy:
      "A Calanthe burgundy bag with a terracotta ribbon handle, holding white and blush roses with eucalyptus",
    sealBag: "A Calanthe arrangement in its burgundy bag against deep green velvet",
    aboutBag: "A Calanthe arrangement in its burgundy bag, against deep green velvet",
    aboutOrchid: "Calanthe orchid buds, the flower the brand is named after",
    aboutRibbon: "Terracotta ribbon printed with the Calanthe wordmark and monogram",
    aboutTag: "A die-cut lily hang tag resting among white lilies",
    aboutTissue: "Monogrammed tissue paper closed with a Calanthe sticker",
    aboutCard:
      "A burgundy Calanthe greeting card, debossed with lilies, its gold tab pressed with the monogram",
    aboutBloom: "A bloom opening, lit from within — Calanthe's key visual",
    eventArrangement: "A Calanthe event arrangement",
    eventFavors: "Calanthe guest favors, wrapped by hand",

    /* The four packaging details on the About page carry a caption too. */
    labelRibbon: "Printed ribbon",
    labelTag: "Lily hang tag",
    labelTissue: "Tissue and seal",
    labelCard: "Debossed card",
  },
  /**
   * THE THREE LEGAL PAGES, WHICH ARE STILL EMPTY.
   *
   * Every one of the twenty sections across Terms, Privacy and Refunds has
   * the same body: "Placeholder copy - the client's approved wording for this
   * section will be placed here before launch." So there is no legal text on
   * this site yet, in either language, and none is invented here — writing
   * plausible-sounding terms would be worse than having none, because it
   * would read as though someone had approved them.
   *
   * What IS translated is the structure: the page titles, the section
   * headings, and the notice saying the wording has not arrived. When the
   * client's counsel supplies the real text it needs to arrive in Arabic too,
   * and that is a translation for a lawyer, not for this file.
   */
  legal: {
    placeholderNotice:
      "Placeholder structure — final wording arrives with the client's legal copy.",
    placeholderBody:
      "This section is waiting for the wording approved by the client's counsel.",
    terms: {
      title: "Terms & Conditions",
      headings: {
        orders: "Orders and acceptance",
        prices: "Prices and payment",
        delivery: "Delivery",
        substitutions: "Substitutions",
        cancellations: "Cancellations",
        liability: "Liability",
        contact: "Contact",
      },
    },
    privacy: {
      title: "Privacy Policy",
      headings: {
        collect: "What we collect",
        use: "How we use it",
        sharing: "Sharing",
        storage: "Storage and security",
        rights: "Your rights",
        cookies: "Cookies",
        contact: "Contact",
      },
    },
    refunds: {
      title: "Refund & Cancellation Policy",
      headings: {
        cancelling: "Cancelling an order",
        changes: "Changes to an order",
        quality: "Quality concerns",
        method: "Refund method and timing",
        perishable: "Perishable goods",
        contact: "Contact",
      },
    },
  },
  /** The membership page. The hero reuses `ritual`, which the homepage band
   *  also uses, so the two never drift apart. */
  membership: {
    nothingCharged:
      "Nothing is charged here. A florist confirms the details with you before any membership begins.",
    andThen: "And then",
    whichDay: "Which day suits you?",
    whichDayBody:
      "One day a week is yours. We reserve your route and your stems, and a florist confirms it with you before anything begins.",
    howItWorks: "How it works",
    steps: [
      {
        title: "Choose your ritual",
        copy: "Pick the tier that suits your table — change it any time.",
      },
      {
        title: "Pick your day",
        copy: "One day a week is yours. We reserve your route and your stems.",
      },
      {
        title: "We deliver, weekly",
        copy: "A fresh composition arrives at your door, four times a month.",
      },
    ],
    questionsAnswered: "Questions, answered",
    arrivesEvery: "Your flowers will arrive every {day}.",
    dayFull: {
      Sun: "Sunday",
      Mon: "Monday",
      Tue: "Tuesday",
      Wed: "Wednesday",
      Thu: "Thursday",
      Fri: "Friday",
      Sat: "Saturday",
    } as Record<string, string>,
  },
  /**
   * THE BOOTH, on the Events page.
   *
   * From the client's booth deliverable (Energia Arabia, 2026): a modular
   * stall of five wall panels, sculpted display vessels, two lamps, a stage
   * and a counter, recomposed into six arrangements. The copy says only what
   * that document says — modular, assembled on site, flowers arranged on the
   * spot at the counter — and names each arrangement by what can be seen in
   * it rather than by its panel codes.
   */
  booth: {
    eyebrow: "The Calanthe booth",
    title: "Step inside the booth.",
    body: "Velvet arches, a panelled door, a standing mirror and our sculpted vessels, in the colours of the atelier. Modular by design, it is assembled on site, and its counter is where flowers are arranged on the spot.",
    viewsLabel: "Booth views",
    views: {
      pano: "360°",
      indoor: "Indoor",
      outdoor: "Outdoor",
      set: "Set III",
    },
    captions: {
      pano: "Drag to look around the booth.",
      indoor: "The full set, indoors.",
      outdoor: "The full set, outdoors.",
      set: "The arch, the Calanthe panel and the counter.",
    },
    alts: {
      indoor: "The Calanthe booth set indoors",
      outdoor: "The Calanthe booth set outdoors, in a garden",
      set: "Set III of the Calanthe booth",
    },
    stepInside: "Step inside",
    opening: "Opening the booth…",
    hint: "Drag to look around",
    viewLabel: "360° view of the Calanthe booth. Drag, or use the turn buttons.",
    turnLeft: "Turn left",
    turnRight: "Turn right",
    expand: "Full screen",
    collapse: "Close full screen",
    unsupported: "This device cannot show the 360° view here.",
    openExternal: "Open the 360° view",

    arrangementsEyebrow: "The booth, arranged",
    arrangementsTitle: "One booth, six arrangements.",
    arrangementsBody:
      "The five panels, the display vessels, two lamps and the counter recompose to suit the space, from the full stage to a single pair of panels.",
    sets: [
      {
        label: "Set I",
        name: "The full stage",
        pieces: "Every panel on the stage, with the vessels, both lamps and the counter.",
      },
      {
        label: "Set II",
        name: "The arch and the door",
        pieces: "The draped arch and the panelled door.",
      },
      {
        label: "Set III",
        name: "The arch and the Calanthe panel",
        pieces: "The draped arch and the velvet Calanthe panel.",
      },
      {
        label: "Set IV",
        name: "The Calanthe panel and the floral panel",
        pieces: "The Calanthe panel, the floral panel and the standing mirror.",
      },
      {
        label: "Set V",
        name: "The door and the floral panel",
        pieces: "The panelled door and the floral panel.",
      },
      {
        label: "Set VI",
        name: "The door and the mirror",
        pieces: "The panelled door and the standing mirror.",
      },
    ],
    /* The two pictures that replaced stock photography further down. */
    vesselsAlt: "Flowers in Calanthe’s sculpted vessels, in garden light",
    counterAlt: "The olive counter with a vase of roses",
  },
  /** The events page. */
  events: {
    eyebrow: "Events",
    line1: "Flowers for",
    line2: "the whole room.",
    intro:
      "Floral styling and arrangements for private celebrations, intimate gatherings and larger occasions — planned with you, composed by the atelier, delivered and set on the day.",
    enquireWhatsapp: "Enquire on WhatsApp",
    seeWhatWeDo: "See what we do",

    arrangementsEyebrow: "Event arrangements",
    arrangementsTitle: "Composed for the space, not the catalogue.",
    arrangementsBody:
      "We work from your venue, your palette and the feeling you want the room to have — then build to it.",
    arrangements: [
      "Table centrepieces, low or statement height",
      "Entrance and welcome arrangements",
      "Ceremony and backdrop florals",
      "Installations for larger venues",
    ],

    favorsEyebrow: "Guest favors",
    favorsTitle: "Something for everyone to take home.",
    favorsBody:
      "Thoughtfully presented floral gifts finished with Calanthe's signature packaging and personal touches — made in the quantities your day needs.",
    favors: [
      "Single-stem favors, wrapped and tied by hand",
      "Miniature vase arrangements for each place setting",
      "Personalised cards, written out rather than printed",
      "Signature Calanthe packaging in your event's palette",
    ],

    beginEyebrow: "Begin",
    beginTitle: "Tell us about the day.",
    beginBody:
      "Send the date, the venue and roughly how many guests. We will come back with a proposal and a quote.",

    boothLink: "Step inside the booth",
    archAlt: "The Calanthe booth: the Calanthe panel, the arched mirror and the counter",
  },

  /* The homepage's way into the Events page. */
  eventsInvite: {
    eyebrow: "Events & guest favors",
    title: "For the days everyone gathers.",
    body: "A booth that arrives in six arrangements, flowers for the whole room, and guest favors finished in our signature packaging.",
    favors: "See guest favors",
  },
  /**
   * THE ABOUT PAGE.
   *
   * The longest piece of brand writing on the site, and it was English from
   * top to bottom. The one thing to be careful with is the etymology: the
   * brand is named after an orchid whose name is Greek, so `kalos` and
   * `anthos` are the words themselves and stay in Latin script in both
   * languages — only the glosses beside them are translated.
   */
  about: {
    eyebrow: "Abu Dhabi",
    title: "About Calanthe",
    intro:
      "Calanthe is an Abu Dhabi-based floral brand created around the art of thoughtful giving.",

    beliefEyebrow: "Our belief",
    beliefTitle: "More than a beautiful gesture.",
    beliefBody1:
      "We believe flowers carry emotion, mark meaningful moments and express what words sometimes cannot.",
    beliefBody2:
      "Our arrangements combine classical elegance with a contemporary creative touch, bringing together carefully selected flowers, refined compositions and distinctive details. From intimate gestures to important celebrations, each Calanthe creation is designed with intention.",

    servicesEyebrow: "What we do",
    servicesTitle: "Our services",
    services: {
      signature: {
        name: "Signature Florals",
        copy: "Handcrafted bouquets and vase arrangements for everyday gestures and special occasions.",
      },
      bespoke: {
        name: "Bespoke Florals",
        copy: "Personalised arrangements created around a preferred budget, colour palette, message or occasion.",
      },
      events: {
        name: "Events",
        copy: "Floral styling and arrangements for private celebrations, intimate gatherings and larger occasions.",
      },
      memberships: {
        name: "Memberships",
        copy: "Recurring floral deliveries designed to bring fresh flowers into homes or businesses throughout the month.",
      },
      gifting: {
        name: "Gifting",
        copy: "Thoughtfully presented floral gifts finished with Calanthe's signature packaging and personal touches.",
      },
      corporate: {
        name: "Corporate",
        copy: "Florals and gifting solutions for offices, businesses, clients and corporate occasions.",
      },
    },

    nameEyebrow: "The name",
    /* The Greek stays; the gloss after the dash is what changes. */
    nameLine1: "kalos — beautiful.",
    nameLine2: "anthos — flower.",
    nameBody:
      "Calanthe is an orchid, and its name is Greek. More than a flower, it reflects a philosophy of beauty that is quiet, timeless and deeply meaningful — which is the standard every arrangement that leaves this atelier is held to.",
    /* "{letter}" is the C of the monogram, set in the brand face. */
    monogramNote:
      "The mark is built from the same flower: petals and leaves simplified, arranged symmetrically, and resolved until the outline reads as a {letter}.",

    detailsEyebrow: "The details",
    detailsTitle: "Down to the ribbon.",
    detailsBody:
      "Everything that reaches you is part of the gift — the tag, the tissue, the card, the ribbon that ties it.",

    closingLine: "Where feelings take form.",
  },
  /**
   * THE TWO FAQ LISTS.
   *
   * These were `siteFaq` and `membershipFaq` in lib/data.ts, in English only,
   * and the FAQ page is nothing but this list — so it had no Arabic at all.
   *
   * The payment answer names cards and Tabby: those are being built, and the
   * cash-on-delivery checkout is the interim state, not the product.
   *
   * Same-day delivery is never mentioned anywhere on the site, at the owner's
   * instruction. The old first answer promised it ("Order before 5pm and we
   * deliver the same day"), so it now describes choosing a day at checkout.
   */
  faq: {
    site: [
      {
        q: "When will my flowers arrive?",
        a: "You choose the delivery day and the time window at checkout, and your arrangement is composed on the morning of that day. The picker offers only the days and windows the atelier can still reach.",
      },
      {
        q: "How fresh are the arrangements?",
        a: "Every arrangement is composed by hand on the morning of its delivery — never the night before — and travels cool and upright.",
      },
      {
        q: "What if a flower is out of season?",
        a: "Flowers are subject to seasonal availability. Our florists may substitute stems of equal or greater value while keeping the palette and spirit of your arrangement.",
      },
      {
        q: "Can I see my arrangement before it is delivered?",
        a: "Yes — your florist sends a photo or video on WhatsApp for your approval before every delivery.",
      },
      {
        q: "How can I pay?",
        a: "Card, Apple Pay and Google Pay are accepted at checkout, and Tabby instalments are coming soon. The recipient never sees the price.",
      },
    ],
    membership: [
      {
        q: "Can I pause or skip a week?",
        a: "Yes — pause, skip or resume any time from your account, up to 24 hours before your delivery day.",
      },
      {
        q: "What flowers will I receive?",
        a: "Each week our florists compose around the best stems of the season, in the palette you prefer. No two weeks are the same.",
      },
      {
        q: "Which areas do you deliver to?",
        a: "Abu Dhabi, for now. Your delivery day is reserved for your area's route, keeping stems in the cold chain until your door.",
      },
      {
        q: "Can I gift a membership?",
        a: "Beautifully. Choose gifting at checkout and we'll include a hand-written first-week card.",
      },
    ],
  },
  /**
   * The membership tiers, whose names stay as the brand set them. Keyed by
   * `tier.id`, which the type declares as a plain string, so the map is
   * widened and the row stays the fallback.
   */
  tierCopy: {
    essential: {
      blurb: "A single seasonal arrangement, composed weekly.",
      includes: [
        "4 deliveries a month",
        "Seasonal stems, florist's choice",
        "Kraft-wrapped, hand-tied",
      ],
    },
    signature: {
      blurb: "Our fullest weekly ritual — the atelier's signature scale.",
      includes: [
        "4 deliveries a month",
        "Premium seasonal stems",
        "Vase included with the first delivery",
        "Priority delivery window",
      ],
    },
    grand: {
      blurb: "Statement arrangements for entrances, tables and offices.",
      includes: [
        "4 deliveries a month",
        "Grand-scale arrangements",
        "Dedicated florist",
        "Same-morning refresh on request",
      ],
    },
  } as Record<string, { blurb: string; includes: readonly string[] }>,
  /** The two help pages. */
  help: {
    eyebrow: "Help",
    deliveryTitle: "Delivery, across Abu Dhabi.",
    deliveryIntro:
      "Choose the day and the window that suit them, anywhere in Abu Dhabi. Delivery is complimentary on every order.",
    deliveryWindows: "Delivery windows",
    approvalNote:
      "Before every delivery, your florist sends a photo or video of the finished arrangement on WhatsApp, and waits for your word before it leaves.",
    faqsTitle: "Questions, answered.",
  },
  /**
   * WHEN SOMETHING BREAKS.
   *
   * An error boundary is the worst place to be in the wrong language: the
   * reader already does not know what happened, and the page is telling her
   * in English what went wrong and what to do about it.
   */
  errors: {
    eyebrow: "Something bloomed wrong",
    title: "A petal fell out of place.",
    segmentBody:
      "This part of the page did not load. Everything else still works — try again, or carry on browsing while we put it right.",
    rootBody: "Something interrupted this page. It has been noted — please try again.",
    tryAgain: "Try Again",
    browseCollection: "Browse the Collection",
    whatsappInstead: "Order on WhatsApp instead",
    returnHome: "Return Home",
    notFoundTitle: "This page has wilted.",
    notFoundBody: "The address you followed is no longer in bloom — but the atelier is.",
    legal: "Legal",
  },
  /** The wrapping section on the homepage. */
  seal: {
    eyebrow: "Sealed by hand",
    line1: "Nothing leaves",
    line2: "this atelier open.",
    body: "Wrapped in embossed paper, tied with our printed ribbon, and closed with the monogram — pressed while the flowers are still cool from the studio.",
    shop: "Shop the collection",
    how: "How we wrap",
  },
  /** The membership band on the homepage. */
  ritual: {
    eyebrow: "A Weekly Ritual",
    title: "The Calanthe Membership",
    body: "Fresh flowers, thoughtfully arranged and delivered to your door every week.",
    cta: "Discover Membership",
  },
  /** The membership tiers. */
  tiers: {
    mostLoved: "Most loved",
    perDelivery: "/ delivery",
    fourAMonth: "4 deliveries a month",
    begin: "Begin {name}",
    dialog: "Begin the {name} membership",
    /* The eyebrow above the enquiry form. */
    label: "{name}",
  },
  /**
   * The homepage's "see it before it's delivered" section. It read its words
   * from VIDEO_APPROVAL in lib/data.ts, so it was English on the Arabic
   * homepage — and a scanner looking for text in markup could not see it.
   */
  videoApproval: {
    eyebrow: "Before it leaves the atelier",
    title: "See it before it's delivered.",
    copy: "When your arrangement is finished, your florist sends you a photo or video on WhatsApp. Nothing is delivered until you love it.",
    steps: [
      "We compose your arrangement by hand",
      "You receive a photo or video on WhatsApp",
      "Approve it, and it's on its way",
    ],
  },
  /**
   * Membership tier names, for display only. The English name is still what
   * the enquiry records, so the owner's list reads the same whatever language
   * the customer used.
   */
  tierNames: {
    essential: "Essential",
    signature: "Signature",
    grand: "Grand",
  } as Record<string, string>,
  /** An occasion page whose collection is still empty. */
  occasionEmpty: {
    title: "The {name} collection is being composed.",
    body: "Until it arrives, a florist can compose one for this moment. Tell us who it is for, the colours and your budget.",
  },
  /**
   * THE BROWSER TAB.
   *
   * Page titles were plain `metadata` constants in English, so the Arabic
   * site kept an English tab. They are read here now by generateMetadata.
   * Descriptions stay English on purpose: search engines crawl without the
   * language cookie, so they only ever see the English page.
   */
  meta: {
    home: "CALANTHE — Flower Atelier, UAE",
    about: "About",
    account: "Your account",
    order: "Order",
    signIn: "Sign in",
    register: "Create an account",
    forgotPassword: "Forgotten password",
    resetPassword: "Choose a new password",
    verify: "Confirm your email",
    buildYourOwn: "Build Your Own",
    checkout: "Checkout",
    delivery: "Delivery Information",
    events: "Events",
    faqs: "FAQs",
    membership: "Membership",
    occasions: "Occasions",
    shop: "Shop",
    wishlist: "Wishlist",
    privacy: "Privacy Policy",
    terms: "Terms & Conditions",
    refunds: "Refund & Cancellation Policy",
  },
  /** The wishlist. */
  wishlist: {
    eyebrow: "Kept Close",
    title: "Wishlist",
    emptyTitle: "Hearts you leave here never wilt.",
    emptyBody: "Tap the heart on any arrangement to keep it close.",
  },
  /** The shop's filter bar and its empty state. */
  shop: {
    all: "All",
    anyPrice: "Any price",
    sortFeatured: "Featured",
    sortNew: "New",
    sortPriceAsc: "Price, low to high",
    sortPriceDesc: "Price, high to low",
    nothingFound: "No arrangements found for “{query}”.",
    nothingYet: "Nothing blooms here yet.",
    noResults:
      "Try a different occasion, flower or price — or look through the whole collection.",
    exploreAll: "Explore all arrangements",
    alsoFromAtelier: "Also from the atelier",
    sameSpirit: "Composed in the same spirit.",
    atelier: "The Atelier",
    /*
     * The price bands. "AED" stays as it is in both languages — the admin
     * dictionary already renders every amount as "AED 480" in Arabic too, so
     * a price written any other way here would be the odd one out.
     */
    priceBands: {
      "under-300": "Under AED 300",
      "300-600": "AED 300 – 600",
      "over-600": "Over AED 600",
    } as Record<string, string>,
  },
  /**
   * THE PRODUCT PAGE.
   *
   * Everything the page says about an arrangement, as opposed to everything
   * the owner typed about it. The product's own name and description come
   * from the database in whichever language she wrote them, and are left
   * alone — but "Size", "Something extra", "Add to Cart" and the three
   * promises under the price are the site talking, and they were all in
   * English on the Arabic page.
   */
  product: {
    eyebrow: "The Collection",
    breadcrumbShop: "Shop",
    breadcrumbLabel: "Breadcrumb",

    /* "Composed for birthdays and love." */
    composedFor: "Composed for",
    listAnd: " and ",
    listComma: ", ",

    withExtras: {
      one: " with {n} extra",
      two: " with {n} extras",
      few: " with {n} extras",
      many: " with {n} extras",
      other: " with {n} extras",
    },

    promiseComposed: "Composed to order, and delivered on the day you choose.",
    promiseApproval: "A photo or video on WhatsApp for your approval before it leaves.",
    promiseReach: "Delivered across Abu Dhabi.",

    size: "Size",
    extras: "Something extra",
    deliveryDay: "Delivery day",

    cardSection: "Card and recipient",
    cardAdded: "Added. You can change it at checkout too.",
    cardOptional: "Optional. Add a handwritten card and who is receiving it.",
    cardMessage: "Card message",
    cardPlaceholder: "Write the words they'll keep…",
    recipientName: "Recipient name",
    recipientPhone: "Recipient phone",
    phonePlaceholder: "050 123 4567",
    recipientNote: "Used only to coordinate delivery. The price is never shown to them.",

    addToCart: "Add to Cart",
    addToCartWithTotal: "Add to Cart — {total}",

    gallery: "Photographs of {name}",
    galleryView: "View {n}",
  },
  /**
   * Sizes and add-ons. Like the emirates, these are configuration in code
   * rather than content the owner typed, so they are translated: an Arabic
   * customer choosing between "Standard", "Deluxe" and "Premium" is reading
   * three English words at the moment she picks what to spend.
   */
  sizeNames: {
    standard: "Standard",
    deluxe: "Deluxe",
    premium: "Premium",
  } as Record<string, string>,
  sizeNotes: {
    standard: "As photographed",
    deluxe: "A third fuller",
    premium: "Twice the stems",
  } as Record<string, string>,
  addonNames: {
    vase: "Vase",
    chocolates: "Chocolates",
    balloon: "Balloon",
    cake: "Bento Cake",
    teddy: "Teddy Bear",
    polaroid: "Polaroid Card",
  } as Record<string, string>,
  /**
   * WHAT THE SERVER SAYS BACK.
   *
   * These are returned by the server actions in backend/actions, and they are
   * the messages a customer sees when something is refused: a password that
   * did not match, a basket that has gone stale, a rate limit. Every one of
   * them used to be an English string written at the point of failure, so an
   * Arabic customer filled in an Arabic form and was refused in English — on
   * sign-in and at checkout, the two places where being refused and not
   * understanding why is the end of the visit.
   *
   * The action returns a key from here; the words are chosen by whichever
   * dictionary the request's cookie selects.
   */
  server: {
    /** Filled into `rateLimited` below. `waitHint` decides which. */
    wait: {
      moment: "Please wait a moment and try again.",
      minutes: {
        one: "Please try again in {n} minute.",
        two: "Please try again in {n} minutes.",
        few: "Please try again in {n} minutes.",
        many: "Please try again in {n} minutes.",
        other: "Please try again in {n} minutes.",
      },
      hours: {
        one: "Please try again in about {n} hour.",
        two: "Please try again in about {n} hours.",
        few: "Please try again in about {n} hours.",
        many: "Please try again in about {n} hours.",
        other: "Please try again in about {n} hours.",
      },
    },
    checkout: {
      rateLimited: "Too many orders from this device. {wait}",
      basketEmpty: "Your basket is empty.",
      nameRequired: "Please tell us your name.",
      emailInvalid: "That email address does not look right.",
      phoneFormat: "Enter your phone in international format, e.g. +971501234567.",
      addressRequired: "Please give us a delivery address.",
      slotRequired: "Please choose a delivery time.",
      recipientPhoneInvalid: "The recipient's phone number does not look right.",
      dateRequired: "Please choose a delivery date.",
      datePassed: "That delivery date has already passed.",
      catalogueUnreachable: "We could not reach the catalogue. Please try again.",
      productUnavailable:
        "One of the arrangements in your basket is no longer available. Please review your basket.",
      pricingRejected:
        "We could not price that basket. Please review your items and try again.",
      creationFailed:
        "We could not place your order. Nothing has been charged — please try again.",
      paymentUnavailable:
        "Online payment is not available right now. Please message us on WhatsApp to place your order.",
    },
    account: {
      credentialsRequired: "Enter your email and password.",
      signInRateLimited: "Too many sign-in attempts. {wait}",
      signInFailed: "We could not sign you in. Please try again.",
      staffAccount: "This is a staff account. Please use the admin sign-in.",
      signInRejected:
        "That email and password did not match, or the account is not yet verified.",
      nameRequired: "Please tell us your name.",
      emailInvalid: "Please check your email address.",
      passwordTooShort: "Please use at least {min} characters.",
      passwordMismatch: "Those passwords do not match.",
      registerRateLimited: "Too many accounts created from here. {wait}",
      registerFailed: "We could not create that account just now. Please try again.",
      verifyLinkInvalid: "That verification link is not valid.",
      linkUsedOrExpired: "That link has expired or has already been used.",
      resetLinkInvalid: "That reset link is not valid.",
      phoneTaken:
        "That phone number is already on an account. Sign in instead, or leave the phone blank and add it later.",
    },
    /**
     * The two lead forms — Build Your Own, and an event or membership
     * enquiry. Same story as the rest of this section: the questions were in
     * Arabic and the reason for refusing an answer was in English.
     */
    enquiry: {
      rateLimited: "That is a lot of enquiries at once. {wait}",
      nameRequired: "Please tell us your name.",
      emailInvalid: "Please check your email address.",
      phoneFormat: "Please include your phone number with its country code, like +9715…",
      recordFailed:
        "We could not record that just now. Please try again, or message us on WhatsApp.",
      budgetRequired: "Please choose a budget.",
      eventTypeRequired: "Please tell us what kind of occasion it is.",
      dateInvalid: "Please check the date.",
      dateRequired: "Please choose the date of the event.",
      guestsRequired: "Please tell us roughly how many guests.",
      venueRequired: "Please tell us the venue or area.",
      frequencyRequired: "Please choose how often the flowers should arrive.",
      deliveryPreferenceRequired: "Please choose where the flowers should go.",
      startDateInvalid: "Please check the start date.",
      startDatePast: "Please choose a start date from today onward.",
    },
  },
  /**
   * CHECKOUT — the page that takes the money, and the last one to be
   * translated.
   *
   * Every string here was written into the component in English. An Arabic
   * customer reached the checkout and met "Checkout", "Delivery day", "Time
   * window", "Subtotal", "Cash on delivery" and a Place Order button, in
   * English, on a right-to-left page. She could not have told from the page
   * whether she was paying now or on delivery. That is the one screen where
   * a language gap costs an order rather than a little polish.
   */
  checkout: {
    eyebrow: "Checkout",
    title: "Almost there.",

    forWhom: "Who are the flowers for?",
    whenWhere: "When and where",
    yourDetails: "Your details",
    payment: "Payment",

    audience: "Who the order is for",
    gift: "It is a gift",
    myself: "For myself",

    recipientName: "Recipient name",
    recipientNamePlaceholder: "Their name",
    recipientPhone: "Recipient phone (optional)",
    phonePlaceholder: "050 123 4567",
    surprise: "Keep it a surprise. Contact me, not them, about the delivery.",

    emirate: "Delivery emirate",
    emiratePlaceholder: "Choose your emirate",
    emirateOption: "{name} — {fee} delivery",
    emirateOptionFree: "{name} — complimentary delivery",
    deliveryFree: "Delivery is complimentary on this order.",
    deliveryFreeAway: "{amount} more for complimentary delivery.",
    address: "Delivery address",
    addressPlaceholder: "Villa or apartment, street, area",
    day: "Delivery day",
    window: "Time window",

    name: "Your name",
    namePlaceholder: "Full name",
    phone: "Your phone",
    email: "Email for order updates",
    emailPlaceholder: "you@example.com",

    cardTitle: "Card, Apple Pay or Google Pay",
    cardBody: "Paid securely through Stripe. Your card details go straight to Stripe and never reach us.",
    paymentLoading: "Loading secure payment…",
    paymentFailed: "The payment did not go through. Nothing has been charged — please check your details or try another card.",

    yourOrder: "Your order",
    withCard: "With a handwritten card",
    subtotal: "Subtotal",
    delivery: "Delivery",
    deliveryTo: "Delivery to {name}",
    complimentary: "Complimentary",
    chooseEmirate: "Choose an emirate",
    total: "Total",
    paidByCard: "Paid securely by card, Apple Pay or Google Pay.",

    showSummary: "Show order summary",
    hideSummary: "Hide order summary",

    place: "Pay Now",
    placeWithTotal: "Pay Now — {total}",
    placing: "Processing your payment…",
    placingShort: "Processing…",

    questions: "Questions first?",
    messageFlorist: "Message a florist",

    /*
     * The sticky bar on a phone: "2 arrangements · Dubai".
     *
     * Every case Arabic distinguishes, not just one-and-the-rest — see
     * lib/i18n/plural.ts. English fills them all with the same two words
     * because `Intl.PluralRules` only ever selects `one` or `other` for it.
     */
    itemCount: {
      one: "{n} arrangement",
      two: "{n} arrangements",
      few: "{n} arrangements",
      many: "{n} arrangements",
      other: "{n} arrangements",
    },
    pickEmirate: "choose an emirate",

    formInvalid: "A few details need a second look. They are marked above.",
    dayGone: "Your delivery day is no longer available. Choose another.",
    dayInvalid: "Choose a day we can still deliver on.",

    orderRef: "Order {number}",
    placedTitle: "Your flowers are in our hands.",
    placedBody:
      "Your payment has been received. Before your arrangement leaves the atelier, your florist sends a photo or video on WhatsApp for your approval.",
    viewOrders: "View Your Orders",
    continueShopping: "Continue Shopping",

    /** Typed against CheckoutErrorCode, so a new rule needs its Arabic. */
    errors: {
      recipientNameRequired: "Tell us who is receiving the flowers.",
      phoneInvalid: "Check the number, for example 050 123 4567.",
      zoneRequired: "Choose the emirate we are delivering to.",
      nameRequired: "Tell us your name.",
      phoneRequired: "We need a number to confirm the order on WhatsApp.",
      emailRequired: "We send order updates to this address.",
      emailInvalid: "That email address does not look complete.",
      addressRequired: "Where should we deliver?",
    } satisfies Record<CheckoutErrorCode, string>,
  },
  /**
   * The delivery day picker. `buildDays` deliberately knows no language, so
   * these are the only words it needs — the weekday and the date beside
   * them are formatted by Intl in the reader's own locale.
   */
  schedule: {
    today: "Today",
    tomorrow: "Tomorrow",
    passed: "Passed",
    tooSoon: "Too soon",
  },
  /**
   * The emirates. They live in `deliveryZones` in English because the fee
   * table is code rather than content — but an emirate has a real Arabic
   * name every reader here knows, so it is not left in English the way a
   * product name is.
   */
  zoneNames: {
    dubai: "Dubai",
    "abu-dhabi": "Abu Dhabi",
    sharjah: "Sharjah",
    ajman: "Ajman",
    "umm-al-quwain": "Umm Al Quwain",
    "ras-al-khaimah": "Ras Al Khaimah",
    fujairah: "Fujairah",
  } as Record<string, string>,
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
    /* Neutral on purpose: it must not imply the address has an account,
       or the sign-in page becomes a way to test which ones do. */
    resendLink: "Didn't get your confirmation email?",
    rememberedIt: "Remembered it?",
    checkInbox:
      "Check {email} for a link to confirm your address. It expires in a few hours.",
    checkInboxNote:
      "Nothing is active until you confirm — you can still order as a guest in the meantime.",
    resetSentIfExists:
      "If that address has an account with us, a link to choose a new password is on its way. It expires in about an hour.",
    resendIfWaiting:
      "If that address is waiting to be confirmed, a new link is on its way.",
    passwordChanged: "Your password has been changed. You can sign in with it now.",
    /* The customer's own order history. */
    orders: "Your orders",
    noOrders: "No orders yet",
    noOrdersBody: "When you order, it will appear here with its progress.",
    visitShop: "Visit the shop",
    signInForOrders:
      "Sign in to see your orders. You do not need an account to buy — every arrangement can be ordered as a guest.",
    orderEyebrow: "Your order",
    pleaseSignIn: "Please sign in.",
    signInForOrder:
      "Sign in to see this order. Orders are only ever shown to the account that placed them.",
    placedOn: "Placed {date}",
    whatYouOrdered: "What you ordered",
    deliveryFree: "Free",
    payableOnDelivery: "Awaiting payment.",
    paymentState: "Payment: {status}",
    deliveryHeading: "Delivery",
    deliveryTo: "To {name}",
    backToOrders: "Back to your orders",
    /**
     * The order's state, in the same words the atelier uses for it in /admin
     * (see admin/i18n/ar.ts). It used to be rendered by lower-casing the
     * stored enum — "out for delivery" — which is English by construction and
     * cannot be translated at all.
     */
    fulfilment: {
      NEW: "New",
      CONFIRMED: "Confirmed",
      PREPARING: "Preparing",
      READY: "Ready",
      OUT_FOR_DELIVERY: "Out for delivery",
      DELIVERED: "Delivered",
      CANCELLED: "Cancelled",
    } as Record<string, string>,
    payment: {
      PENDING: "Awaiting payment",
      AUTHORIZED: "Authorized",
      PAID: "Paid",
      FAILED: "Payment failed",
      REFUNDED: "Refunded",
      PARTIALLY_REFUNDED: "Partially refunded",
    } as Record<string, string>,
  },
  pages: {
    shopEyebrow: "The Collection",
    shopTitle: "Composed this morning, at your door on the day you choose.",
    shopIntro:
      "Every arrangement is built stem by stem in the atelier — no two ever quite the same.",
    shopReadyEyebrow: "Ready to order",
    shopReadyTitle: "Made this morning, gone by evening.",
    /* Five forms, because Arabic selects from five — see lib/i18n/plural.ts.
       These were one-and-the-rest, and the Arabic for both was the same word,
       so a grid of three read "3 باقة" where "3 باقات" belongs. */
    arrangementCount: {
      one: "{n} arrangement",
      two: "{n} arrangements",
      few: "{n} arrangements",
      many: "{n} arrangements",
      other: "{n} arrangements",
    },
    occasionsEyebrow: "Occasions",
    occasionsTitle: "For every unspoken thing.",
    occasionsIntro:
      "Some things are easier handed over than said. Begin with the moment, and we will compose the rest.",
    occasionCount: {
      one: "{n} occasion",
      two: "{n} occasions",
      few: "{n} occasions",
      many: "{n} occasions",
      other: "{n} occasions",
    },
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
  occasionNames: {
    birthday: "أعياد الميلاد",
    graduation: "التخرّج",
    "new-born": "المولود الجديد",
    love: "الحب",
    "just-because": "بلا مناسبة",
  } as Record<string, string>,
  flowerNames: {
    roses: "ورد",
    peonies: "فاوانيا",
    orchids: "أوركيد",
    tulips: "توليب",
    lilies: "زنبق",
    wildflowers: "زهور برية",
  } as Record<string, string>,

  byo: {
    eyebrow: "تصميم خاص",
    title: "صُنع لهم، بأيديكم.",
    titleLine1: "صُنع لهم،",
    titleLine2: "بأيديكم.",
    createYours: "صمّموا باقتكم",
    intro: "اختاروا الميزانية والألوان وتفضيلاتكم، ونتولّى نحن الزهور.",
    steps: {
      budget: "الميزانية",
      colours: "الألوان",
      vase: "مع مزهرية؟",
      card: "البطاقة",
      notes: "ملاحظات لمنسّق الزهور",
      gift: "لمن هي؟",
      contact: "كيف نتواصل معكم",
    },
    budgetOther: "مبلغ آخر",
    budgetOtherLabel: "الميزانية بالدرهم",
    budgetNote: "كل ميزانية تُنسَّق بالعناية نفسها — والتنسيق الأصغر أهدأ حضورًا فحسب.",
    coloursHint: "اختاروا ما تشاؤون.",
    colourNames: {
      whitesCreams: "أبيض وكريمي",
      blushRose: "وردي فاتح",
      peachApricot: "خوخي ومشمشي",
      sunlitYellows: "أصفر مشمس",
      burntOrangeRust: "برتقالي محروق وصدئي",
      redsBurgundies: "أحمر وعنابي",
      lilacPurples: "ليلكي وبنفسجي",
      greensFoliage: "أخضر وأوراق",
    },
    floristChoice: "اتركوا الاختيار لمنسّق الزهور",
    floristChoiceNote: "لوحة ألوان تُختار صباح التنسيق",
    floristChoiceAnswer: "اختيار منسّق الزهور",
    colourNoteLabel: "هل من شيء آخر عن الألوان؟",
    colourNotePlaceholder: "درجة تحبّونها، لون تتجنّبونه، أو شيء يجب أن يتناسق معه…",
    colourSeasonNote:
      "إذا لم يكن اللون متوفرًا في موسمه ذلك اليوم، سنتواصل معكم قبل التنسيق ونتفق على أقرب بديل له.",
    vaseYes: "نعم، في مزهرية",
    vaseNo: "لا",
    vaseNoNote: "حقيبة زهور",
    vaseAnswerYes: "مع مزهرية",
    vaseAnswerNo: "حقيبة زهور",
    cardPlaceholder: "اكتبوا رسالة البطاقة هنا…",
    cardLeaveBlank: "اتركوا البطاقة فارغة",
    cardAnswerBlank: "تُركت فارغة",
    cardAnswerWritten: "مكتوبة",
    notesHint: "اختياري.",
    notesPlaceholder: "حساسية، زهور تُتجنَّب، أسلوب تحبّونه — أي شيء يساعدنا.",
    notesAnswer: "مسجّلة",
    giftYes: "إنها هدية",
    giftYesNote: "تُرسل إلى شخص آخر",
    giftNo: "لنفسي",
    giftNoNote: "تُسلَّم إليّ",
    giftAnswerYes: "هدية",
    giftAnswerNo: "لنفسي",
    recipientName: "اسم المستلم",
    recipientPhone: "هاتف المستلم",
    recipientPhoneNote: "يُستخدم لتنسيق التوصيل فقط، ولا يظهر السعر له أبدًا.",
    place: "إلى أين تُرسل؟",
    placeSelf: "عنوان التوصيل",
    placePlaceholder: "جزيرة الريم، أبوظبي",
    placeNote: "تكفي المنطقة الآن — يؤكّد فريق التوصيل العنوان الدقيق معكم.",
    yourName: "الاسم",
    yourPhone: "رقم الهاتف",
    yourEmail: "البريد الإلكتروني",
    summaryTitle: "تنسيقكم",
    summaryBudget: "الميزانية",
    summaryColours: "الألوان",
    summaryColourNote: "ملاحظة اللون",
    summaryVase: "المزهرية",
    summaryCard: "البطاقة",
    summaryNotes: "ملاحظات",
    summaryFor: "لمن",
    summaryTotal: "الإجمالي التقديري",
    summaryEmpty: "لم يُختر بعد",
    summaryNone: "لا شيء",
    send: "أرسلوا إلى الأتيليه",
    sending: "جارٍ الإرسال…",
    sendNote:
      "يُرسل طلبكم إلى الأتيليه. لا يُنفَّذ أي طلب ولا يُخصم أي مبلغ حتى يؤكّده منسّق الزهور معكم.",
    seasonal:
      "تخضع الزهور للتوفّر الموسمي. قد يستبدل منسّق الزهور بعض السيقان بأخرى مساوية أو أعلى قيمة، مع الحفاظ على لوحة الألوان وروح التنسيق.",
    sentTitle: "وصل طلبكم إلى الأتيليه.",
    sentBody:
      "سيتواصل معكم منسّق الزهور لتأكيد التنسيق والتوصيل والإجمالي البالغ {total} قبل البدء. لم يُخصم أي مبلغ.",
    sentReference: "الرقم المرجعي {reference}",
    whatsapp: "أكملوا عبر واتساب",
    alsoWhatsapp: "راسلونا أيضًا على واتساب",
    editChoices: "تعديل الاختيارات",
    budgetFrom: "من {min}",
    notesLabel: "ملاحظات لمنسّق الزهور",
    audience: "لمن هي؟",
    backToShop: "العودة إلى المتجر",
    errors: {
      budget: "اختاروا ميزانية، أو اكتبوا مبلغًا خاصًا بكم.",
      budgetMin: "أصغر تنسيق نقوم بتنسيقه هو {min}.",
      colours: "اختاروا لوحة ألوان، أو اتركوا الاختيار لمنسّق الزهور.",
      vase: "أخبرونا إن كانت في مزهرية.",
      card: "اكتبوا البطاقة، أو اختاروا تركها فارغة.",
      gift: "أخبرونا لمن هي.",
      name: "يُرجى كتابة الاسم.",
      phone: "يُرجى إضافة رقم هاتف للتواصل.",
      email: "يُرجى إضافة بريد إلكتروني.",
      recipientName: "يُرجى إضافة اسم المستلم.",
    },
  },

  nav: {
    home: "الرئيسية",
    about: "عن كالانثي",
    shop: "المتجر",
    shopAll: "كل المتجر",
    shopByOccasion: "التسوق حسب المناسبة",
    readyToday: "جاهز للطلب",
    buildYourOwn: "صمّموا باقتكم",
    memberships: "العضويات",
    events: "الفعاليات",
    eventsAll: "كل الفعاليات",
    guestFavors: "هدايا الضيوف",
    eventArrangements: "تنسيقات الفعاليات",
    account: "حسابي",
    search: "ابحثوا عن باقة",
    cart: "الحقيبة",
    wishlist: "المفضّلة",
    viewAll: "عرض الكل",
    atelier: "أتيليه الزهور — الإمارات",
    byOccasion: "حسب المناسبة",
    skipToContent: "الانتقال إلى المحتوى",
  },
  strip: {
    emirates: "نوصّل في أنحاء أبوظبي",
    video: "موافقتكم بالفيديو على كل طلب",
    composed: "كل باقة تُنسَّق يدويًا",
  },
  search: {
    label: "ابحثوا في الأتيليه",
    placeholder: "ورد، عيد ميلاد، ساعة العنبر…",
    close: "إغلاق البحث",
    suggestionsTitle: "الأكثر بحثًا الآن",
    resultsTitle: "الباقات",
    viewAll: "عرض كل النتائج",
    searchWhole: "ابحثوا في المجموعة كاملة",
    noResultsTitle: "لا شيء بهذا الاسم.",
    noResultsBody:
      "جرّبوا مناسبة، أو نوع زهرة، أو اسم باقة — أو أخبروا منسّق الزهور بما يدور في بالكم.",
    askFlorist: "اسألوا منسّق الزهور على واتساب",
    browseAll: "تصفّحوا المجموعة",
  },
  hero: {
    eyebrow: "أتيليه الزهور — الإمارات",
    headlineOne: "حيث تتجسّد",
    headlineTwo: "المشاعر.",
    shopFlowers: "تسوّقوا الزهور",
    buildYourOwn: "صمّموا باقتكم",
  },
  band: {
    sendFlowersFor: "زهور لكل مناسبة:",
    luxury: "الباقات الفاخرة",
  },
  sections: {
    newArrivalsEyebrow: "وصل حديثًا",
    newArrivalsTitle: "نضِرة من الأتيليه.",
    occasionsEyebrow: "التسوق حسب المناسبة",
    occasionsTitle: "لكل ما لا يُقال.",
    bestSellersEyebrow: "الأكثر طلبًا",
    bestSellersQuote: "الباقات التي يحفظها مندوبونا عن ظهر قلب.",
    bestSellersAttribution: "الأتيليه",
    bestSellersTitle: "محبوبة، أسبوعًا بعد أسبوع.",
    touchTitle: "لمسة كالانثي",
    promiseTitle: "وعودنا في كل طلب.",
    promiseAsk: "لديكم سؤال قبل الطلب؟ يجيبكم منسّق الزهور عبر",
    instagramLine: "باقات تخرج من الأتيليه كل صباح تقريبًا.",
  },
  touch: {
    handTitle: "تُنسّق يدويًا كل يوم",
    handCopy: "كل ساق تُنتقى وتُنسّق يدويًا في الأتيليه، صباحًا بعد صباح.",
    wrapTitle: "تقديم يليق بها",
    wrapCopy: "تُغلّف بورق مزخرف، وتُربط وتُختم بشعار كالانثي.",
    deliverTitle: "تُوصَّل بعناية",
    deliverCopy: "تبقى نضِرة وقائمة حتى باب المستلِم، في أنحاء أبوظبي.",
  },
  trust: {
    sameDayTitle: "توصيل في اليوم الذي تختارونه",
    sameDayCopy: "اختاروا اليوم والوقت المناسبين لكم.",
    videoTitle: "موافقتكم بالفيديو",
    videoCopy: "شاهدوا الباقة عبر واتساب قبل أن تغادر.",
    freshTitle: "ضمان النضارة",
    freshCopy: "تُنسّق صباح التوصيل، لا قبل ذلك.",
    emiratesTitle: "في أنحاء أبوظبي",
    emiratesCopy: "أتيليه واحد، يوصّل في أنحاء أبوظبي.",
  },
  empty: {
    eyebrow: "حسب الطلب",
    title: "كل باقة يمكن أن تُصنع خصيصًا لكم.",
    body: "المجموعة القادمة قيد التنسيق. وحتى تصل، أخبرونا بالمناسبة والألوان والميزانية، وينسّقها لكم منسّق الزهور.",
    messageFlorist: "تواصلوا مع منسّق الزهور",
  },
  cart: {
    title: "السلة",
    close: "إغلاق السلة",
    empty: "السلة تنتظر أن تُزهر.",
    emptyBody: "اختاروا باقة جاهزة، أو دعونا ننسّق واحدة خصيصًا لكم.",
    shopFlowers: "تسوّقوا الزهور",
    buildYourOwn: "صمّموا باقتكم",
    loading: "جارٍ تحميل السلة",
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
    completeTheGift: "أكملوا الهدية",
    freeDeliveryAway: "يفصلكم {amount} عن التوصيل المجاني",
    freeDeliveryReached: "التوصيل مجاني",
    giftMessageIncluded: "تتضمّن بطاقة إهداء",
    dropped: {
      one: "باقة واحدة لم تعد متوفرة وقد أُزيلت.",
      two: "باقتان لم تعودا متوفرتين وقد أُزيلتا.",
      few: "{n} باقات لم تعد متوفرة وقد أُزيلت.",
      many: "{n} باقة لم تعد متوفرة وقد أُزيلت.",
      other: "{n} باقة لم تعد متوفرة وقد أُزيلت.",
    },
  },
  ui: {
    navMain: "التنقّل الرئيسي",
    navMobile: "التنقّل على الهاتف",
    home: "كالانثي — الصفحة الرئيسية",
    membershipAndEvents: "العضوية والفعاليات",
    cart: "السلة",
    close: "إغلاق",
    shopShortcuts: "اختصارات المتجر",
    openMenu: "فتح القائمة",
    closeMenu: "إغلاق القائمة",
    wishlistAdd: "أضيفوا {name} إلى المفضّلة",
    wishlistRemove: "إزالة {name} من المفضّلة",
    wishlistSaved: "حُفظت {name} في المفضّلة",
    wishlistRemoved: "أُزيلت {name} من المفضّلة",
    occasionAlt: "باقات {name}",
    requiredField: "يُرجى تعبئة هذا الحقل.",
    productCategories: "فئات المنتجات",
    whatsappChat: "تواصلوا معنا على واتساب",
    monogram: "شعار كالانثي",

    from: "من",
    viewArrangement: "عرض الباقة",
    badgeNew: "جديد",
    badgeFeatured: "مميّز",
    cartWith: "السلة، {items}",
    cartEmpty: "السلة فارغة",
    addAddon: "أضيفوا {addon} إلى {product}، {price}",
  },
  categoryNames: {
    bouquet: "باقات",
    "vase-arrangement": "تنسيقات المزهريات",
    "box-arrangement": "تنسيقات الصناديق",
    basket: "سلال",
    "single-stem": "سيقان مفردة",
    plant: "نباتات",
    "event-piece": "قطع الفعاليات",
  },
  enquiryForm: {
    membershipThanks: "شكرًا لكم — سيتواصل معكم منسّق الزهور.",
    membershipDone:
      "وصلنا طلبكم للعضوية {plan}. لم يُخصم أي مبلغ ولم تبدأ أي عضوية — سنتفق معكم على التفاصيل أولًا.",
    membershipTitle: "ابدؤوا اشتراككم.",
    membershipIntro:
      "أخبرونا كيف تودّون أن تصلكم الزهور، وسيتصل بكم منسّق الزهور للاتفاق على التفاصيل. ولا يُخصم شيء هنا.",
    howOften: "كم مرة",
    whichDay: "أي يوم يناسبكم",
    whereItGoes: "إلى أين تُرسل",
    startFrom: "البداية من (اختياري)",
    areaOrAddress: "المنطقة أو العنوان (اختياري)",
    areaPlaceholder: "جزيرة الريم، أبوظبي",
    anythingToKnow: "أي شيء ينبغي أن نعرفه (اختياري)",
    anythingPlaceholder: "الألوان التي تحبّونها، وما يُفضّل تجنّبه، وأين تُترك…",

    eventThanks: "شكرًا لكم — وصلتنا تفاصيل مناسبتكم.",
    eventDone:
      "سيتواصل معكم منسّق الزهور للحديث عن المكان ولوحة الألوان والحجم. لا شيء مُلزِم، ولم يُخصم أي مبلغ.",
    whatKind: "ما نوع المناسبة",
    company: "الشركة (اختياري)",
    date: "التاريخ",
    guests: "عدد الضيوف",
    venue: "المكان أو المنطقة",
    venuePlaceholder: "قصر الإمارات، أبوظبي",
    alreadyKnow: "أي تفاصيل تعرفونها من الآن (اختياري)",
    alreadyKnowPlaceholder: "لوحة الألوان، والطابع، وإحساس اليوم…",

    yourName: "الاسم",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    reference: "المرجع {number}",
    send: "إرسال الطلب",
    sending: "جارٍ الإرسال…",
    messageUs: "راسلونا",

    frequency: {
      WEEKLY: "أسبوعيًا",
      FORTNIGHTLY: "كل أسبوعين",
      MONTHLY: "شهريًا",
    },
    place: {
      home: "المنزل",
      office: "المكتب",
      gift: "هدية لشخص ما",
    },
    weekdays: {
      Sun: "الأحد",
      Mon: "الاثنين",
      Tue: "الثلاثاء",
      Wed: "الأربعاء",
      Thu: "الخميس",
      Fri: "الجمعة",
      Sat: "السبت",
    },
    eventKinds: {
      Wedding: "حفل زفاف",
      "Private celebration": "احتفال خاص",
      Corporate: "مناسبة مؤسسية",
      "Launch or opening": "إطلاق أو افتتاح",
      "Something else": "شيء آخر",
    },
  },
  alt: {
    hero: "تنسيق كالانثي من ورود الحدائق والأقحوان وزهور مرجانية في مزهرية بيضاء",
    bestSellers: "زنابق بيضاء مع بطاقة كالانثي مربوطة بينها",
    byoPetal: "بتلة زنبقة مُضاءة من الخلف، بلون وردي فاتح في ضوء دافئ",
    emptyCatalogue: "تنسيق من الورد الأبيض",
    packagingTerracotta:
      "غلاف كالانثي بلون التيراكوتا مطبوع بزهور الأوركيد، يحمل ورودًا وردية فاتحة وليزيانثوس أبيض وأغصان الأوكالبتوس",
    packagingOlive:
      "حقيبة كالانثي بلون الزيتون مطبوعة بزهور الأوركيد بالدرجة نفسها، تحمل ورودًا بيضاء ووردية فاتحة",
    packagingBurgundy:
      "حقيبة كالانثي العنّابية بمقبض من شريط التيراكوتا، تحمل ورودًا بيضاء ووردية فاتحة مع أغصان الأوكالبتوس",
    sealBag: "تنسيق كالانثي في حقيبته العنّابية على مخمل أخضر غامق",
    aboutBag: "تنسيق كالانثي في حقيبته العنّابية، على مخمل أخضر غامق",
    aboutOrchid: "براعم أوركيد الكالانثي، الزهرة التي سُمّيت العلامة باسمها",
    aboutRibbon: "شريط بلون التيراكوتا مطبوع باسم كالانثي وشعارها",
    aboutTag: "بطاقة مقصوصة بشكل زنبقة بين زنابق بيضاء",
    aboutTissue: "ورق تغليف مطبوع بالشعار مُغلق بملصق كالانثي",
    aboutCard:
      "بطاقة تهانٍ عنّابية من كالانثي، منقوشة بالزنابق، ولسانها الذهبي مضغوط بالشعار",
    aboutBloom: "زهرة تتفتّح، مُضاءة من الداخل — الصورة الأساسية لكالانثي",
    eventArrangement: "تنسيق فعاليات من كالانثي",
    eventFavors: "هدايا الضيوف من كالانثي، مُغلّفة يدويًا",

    labelRibbon: "شريط مطبوع",
    labelTag: "بطاقة زنبقة",
    labelTissue: "ورق وختم",
    labelCard: "بطاقة منقوشة",
  },
  legal: {
    placeholderNotice: "هيكل مبدئي — الصياغة النهائية تصل مع النص القانوني المعتمد.",
    placeholderBody: "هذا القسم بانتظار الصياغة المعتمدة من المستشار القانوني.",
    terms: {
      title: "الشروط والأحكام",
      headings: {
        orders: "الطلبات وقبولها",
        prices: "الأسعار والدفع",
        delivery: "التوصيل",
        substitutions: "الاستبدال",
        cancellations: "الإلغاء",
        liability: "المسؤولية",
        contact: "التواصل",
      },
    },
    privacy: {
      title: "سياسة الخصوصية",
      headings: {
        collect: "البيانات التي نجمعها",
        use: "كيف نستخدمها",
        sharing: "مشاركة البيانات",
        storage: "التخزين والأمان",
        rights: "حقوقكم",
        cookies: "ملفات تعريف الارتباط",
        contact: "التواصل",
      },
    },
    refunds: {
      title: "سياسة الاسترداد والإلغاء",
      headings: {
        cancelling: "إلغاء الطلب",
        changes: "تعديل الطلب",
        quality: "ملاحظات الجودة",
        method: "طريقة الاسترداد ومدته",
        perishable: "المنتجات سريعة التلف",
        contact: "التواصل",
      },
    },
  },
  membership: {
    nothingCharged:
      "لا يُخصم شيء هنا. يؤكّد منسّق الزهور التفاصيل معكم قبل أن تبدأ أي عضوية.",
    andThen: "وبعد ذلك",
    whichDay: "أي يوم يناسبكم؟",
    whichDayBody:
      "يوم واحد في الأسبوع يكون لكم. نحجز لكم موعد التوصيل والزهور، ويؤكّد منسّق الزهور ذلك معكم قبل أن يبدأ شيء.",
    howItWorks: "كيف تعمل العضوية",
    steps: [
      {
        title: "اختاروا باقتكم الأسبوعية",
        copy: "اختاروا الفئة التي تناسب طاولتكم — وغيّروها متى شئتم.",
      },
      {
        title: "اختاروا يومكم",
        copy: "يوم واحد في الأسبوع يكون لكم. نحجز لكم موعد التوصيل والزهور.",
      },
      {
        title: "نوصّل أسبوعيًا",
        copy: "يصل تنسيق نضِر إلى بابكم، أربع مرات في الشهر.",
      },
    ],
    questionsAnswered: "أسئلة، وأجوبتها",
    /* "أيام الخميس" — on Thursdays — is how a weekly day is said. */
    arrivesEvery: "تصلكم الزهور أيام {day}.",
    dayFull: {
      Sun: "الأحد",
      Mon: "الاثنين",
      Tue: "الثلاثاء",
      Wed: "الأربعاء",
      Thu: "الخميس",
      Fri: "الجمعة",
      Sat: "السبت",
    },
  },
  booth: {
    eyebrow: "جناح كالانثي",
    title: "ادخلوا إلى الجناح.",
    body: "أقواس مخملية، وباب بحشوات، ومرآة قائمة، وأوانينا المنحوتة، بألوان الأتيليه. صُمّم الجناح من وحدات تُركَّب في الموقع، وعلى منضدته تُنسَّق الزهور أمام الضيوف.",
    viewsLabel: "مشاهد الجناح",
    views: {
      pano: "360°",
      indoor: "داخلي",
      outdoor: "خارجي",
      set: "التشكيل الثالث",
    },
    captions: {
      pano: "اسحبوا للتجوّل في أرجاء الجناح.",
      indoor: "التشكيل الكامل في مكان داخلي.",
      outdoor: "التشكيل الكامل في الهواء الطلق.",
      set: "القوس ولوحة كالانثي والمنضدة.",
    },
    alts: {
      indoor: "جناح كالانثي في مكان داخلي",
      outdoor: "جناح كالانثي في الهواء الطلق، في حديقة",
      set: "التشكيل الثالث لجناح كالانثي",
    },
    stepInside: "ادخلوا الجناح",
    opening: "جارٍ فتح الجناح…",
    hint: "اسحبوا للنظر حولكم",
    viewLabel: "عرض 360° لجناح كالانثي. اسحبوا، أو استخدموا زرَّي الاستدارة.",
    turnLeft: "استدارة لليسار",
    turnRight: "استدارة لليمين",
    expand: "ملء الشاشة",
    collapse: "إغلاق ملء الشاشة",
    unsupported: "لا يمكن لهذا الجهاز عرض الجولة بزاوية 360° هنا.",
    openExternal: "افتحوا عرض 360°",

    arrangementsEyebrow: "الجناح بتشكيلاته",
    arrangementsTitle: "جناح واحد، ستة تشكيلات.",
    arrangementsBody:
      "تتبدّل مواضع اللوحات الخمس وأواني العرض والمصباحين والمنضدة لتناسب المكان، من المنصّة الكاملة إلى لوحتين فقط.",
    sets: [
      {
        label: "التشكيل الأول",
        name: "المنصّة الكاملة",
        pieces: "اللوحات كلها على المنصّة، مع الأواني والمصباحين والمنضدة.",
      },
      {
        label: "التشكيل الثاني",
        name: "القوس والباب",
        pieces: "القوس بستارته، والباب ذو الحشوات.",
      },
      {
        label: "التشكيل الثالث",
        name: "القوس ولوحة كالانثي",
        pieces: "القوس بستارته، ولوحة كالانثي المخملية.",
      },
      {
        label: "التشكيل الرابع",
        name: "لوحة كالانثي واللوحة المزهرة",
        pieces: "لوحة كالانثي، واللوحة المنقوشة بالزهور، والمرآة القائمة.",
      },
      {
        label: "التشكيل الخامس",
        name: "الباب واللوحة المزهرة",
        pieces: "الباب ذو الحشوات، واللوحة المنقوشة بالزهور.",
      },
      {
        label: "التشكيل السادس",
        name: "الباب والمرآة",
        pieces: "الباب ذو الحشوات، والمرآة القائمة.",
      },
    ],
    vesselsAlt: "زهور في أواني كالانثي المنحوتة، في ضوء الحديقة",
    counterAlt: "المنضدة الزيتونية وعليها مزهرية ورود",
  },
  events: {
    eyebrow: "الفعاليات",
    line1: "زهور تملأ",
    line2: "المكان كلّه.",
    intro:
      "تصميم وتنسيقات زهور للاحتفالات الخاصة والجلسات العائلية والمناسبات الأكبر — نخطّطها معكم، وينسّقها الأتيليه، ونوصلها ونرتّبها يوم المناسبة.",
    enquireWhatsapp: "استفسروا عبر واتساب",
    seeWhatWeDo: "اطّلعوا على أعمالنا",

    arrangementsEyebrow: "تنسيقات الفعاليات",
    arrangementsTitle: "تُنسّق للمكان، لا للكتالوج.",
    arrangementsBody:
      "نبدأ من المكان، ولوحة الألوان، والإحساس الذي تريدونه للمكان — ونبني عليه.",
    arrangements: [
      "تنسيقات لوسط الطاولات، منخفضة أو عالية",
      "تنسيقات المداخل والترحيب",
      "زهور المراسم والخلفيات",
      "تركيبات للقاعات الكبيرة",
    ],

    favorsEyebrow: "هدايا الضيوف",
    favorsTitle: "هدية يحملها كل ضيف معه.",
    favorsBody:
      "هدايا زهور مُقدّمة بعناية، بتغليف كالانثي المميّز ولمسات شخصية — وبالكميات التي تحتاجها مناسبتكم.",
    favors: [
      "هدايا بساق واحدة، مُغلّفة ومربوطة يدويًا",
      "تنسيقات مزهريات مصغّرة لكل مقعد",
      "بطاقات شخصية، مكتوبة باليد لا مطبوعة",
      "تغليف كالانثي المميّز بلوحة ألوان مناسبتكم",
    ],

    beginEyebrow: "البداية",
    beginTitle: "أخبرونا عن المناسبة.",
    beginBody: "أرسلوا التاريخ والمكان وعدد الضيوف تقريبًا، ونعود إليكم بمقترح وعرض سعر.",

    boothLink: "ادخلوا إلى الجناح",
    archAlt: "جناح كالانثي: لوحة كالانثي والمرآة المقوّسة والمنضدة",
  },

  eventsInvite: {
    eyebrow: "الفعاليات وهدايا الضيوف",
    title: "للأيام التي يجتمع فيها الجميع.",
    body: "جناحٌ يأتي بستة تشكيلات، وزهورٌ تملأ المكان كلّه، وهدايا للضيوف بتغليف كالانثي المميّز.",
    favors: "اكتشفوا هدايا الضيوف",
  },
  about: {
    eyebrow: "أبوظبي",
    title: "عن كالانثي",
    intro: "كالانثي علامة زهور مقرّها أبوظبي، قامت على فنّ الإهداء المُعبِّر.",

    beliefEyebrow: "ما نؤمن به",
    beliefTitle: "أكثر من لفتة جميلة.",
    beliefBody1:
      "نعتقد أن الزهور تحمل المشاعر، وتُخلّد اللحظات ذات المعنى، وتقول ما تعجز عنه الكلمات أحيانًا.",
    beliefBody2:
      "تجمع تنسيقاتنا بين الأناقة الكلاسيكية ولمسة إبداعية معاصرة، فتجتمع فيها زهور منتقاة بعناية، وتركيبات مصقولة، وتفاصيل مميّزة. ومن أبسط اللفتات إلى أكبر الاحتفالات، يُصمَّم كل عمل من كالانثي بعنايةٍ وقصد.",

    servicesEyebrow: "ما نقدّمه",
    servicesTitle: "خدماتنا",
    services: {
      signature: {
        name: "التنسيقات المميّزة",
        copy: "باقات وتنسيقات مزهريات مُنسّقة يدويًا للّفتات اليومية والمناسبات الخاصة.",
      },
      bespoke: {
        name: "التنسيقات الخاصة",
        copy: "تنسيقات تُصمّم حول ميزانية معيّنة، أو لوحة ألوان، أو رسالة، أو مناسبة.",
      },
      events: {
        name: "الفعاليات",
        copy: "تصميم وتنسيقات زهور للاحتفالات الخاصة والجلسات العائلية والمناسبات الأكبر.",
      },
      memberships: {
        name: "العضويات",
        copy: "توصيلات زهور منتظمة لتبقى الزهور النضِرة في المنازل والأعمال على مدار الشهر.",
      },
      gifting: {
        name: "الإهداء",
        copy: "هدايا زهور مُقدّمة بعناية، بتغليف كالانثي المميّز ولمسات شخصية.",
      },
      corporate: {
        name: "القطاع المؤسّسي",
        copy: "زهور وحلول إهداء للمكاتب والشركات والعملاء والمناسبات المؤسّسية.",
      },
    },

    nameEyebrow: "الاسم",
    nameLine1: "kalos — جميل.",
    nameLine2: "anthos — زهرة.",
    nameBody:
      "كالانثي زهرة أوركيد، واسمها يوناني. وهي أكثر من زهرة: فهي تعكس فلسفة جمال هادئة، لا يطويها زمن، وعميقة المعنى — وهذا هو المعيار الذي يُقاس به كل تنسيق يخرج من هذا الأتيليه.",
    monogramNote:
      "الشعار مبنيّ من الزهرة نفسها: بتلات وأوراق مُبسّطة، مرتّبة بتناظر، ومصقولة حتّى يبدو الخطّ الخارجي كحرف {letter}.",

    detailsEyebrow: "التفاصيل",
    detailsTitle: "حتّى الشريط.",
    detailsBody:
      "كل ما يصلكم جزء من الهدية — البطاقة المعلّقة، وورق التغليف، وبطاقة الإهداء، والشريط الذي يربطها.",

    closingLine: "حيث تتجسّد المشاعر.",
  },
  faq: {
    site: [
      {
        q: "متى تصل زهوري؟",
        a: "تختارون يوم التوصيل والفترة الزمنية عند إتمام الطلب، ويُنسّق طلبكم صباح ذلك اليوم. ولا تظهر إلا الأيام والفترات التي يمكن للأتيليه التوصيل فيها.",
      },
      {
        q: "ما مدى نضارة الباقات؟",
        a: "تُنسّق كل باقة يدويًا صباح يوم توصيلها — وليس في الليلة السابقة — وتُنقل باردة ومنتصبة.",
      },
      {
        q: "وماذا لو كانت إحدى الزهور خارج موسمها؟",
        a: "تخضع الزهور للتوفّر الموسمي، وقد يستبدل منسّقو الزهور بعض السيقان بأخرى مساوية أو أعلى قيمة، مع الحفاظ على لوحة الألوان وروح التنسيق.",
      },
      {
        q: "هل يمكنني رؤية التنسيق قبل توصيله؟",
        a: "نعم — يرسل لكم منسّق الزهور صورة أو مقطعًا على واتساب لتوافقوا عليه قبل كل توصيلة.",
      },
      {
        q: "كيف يمكنني الدفع؟",
        a: "نقبل الدفع بالبطاقة وApple Pay وGoogle Pay عند إتمام الطلب، ويتوفّر التقسيط عبر تابي قريبًا. ولا يرى المستلِم السعر أبدًا.",
      },
    ],
    membership: [
      {
        q: "هل يمكنني إيقاف أسبوع أو تخطيه؟",
        a: "نعم — يمكنكم الإيقاف أو التخطّي أو الاستئناف في أي وقت من حسابكم، حتّى 24 ساعة قبل يوم التوصيل.",
      },
      {
        q: "أي زهور سأستلم؟",
        a: "كل أسبوع ينسّق فريقنا أجمل زهور الموسم، بلوحة الألوان التي تفضّلونها. ولا يتشابه أسبوعان.",
      },
      {
        q: "إلى أي المناطق توصّلون؟",
        a: "إلى أبوظبي حاليًا. ويُحجز يوم التوصيل لمسار منطقتكم، لتبقى الزهور مبرّدة حتّى الباب.",
      },
      {
        q: "هل يمكنني إهداء عضوية؟",
        a: "بكل سرور. اختاروا الإهداء عند إتمام الطلب، ونُرفق بطاقة مكتوبة بخط اليد مع الأسبوع الأول.",
      },
    ],
  },
  tierCopy: {
    essential: {
      blurb: "تنسيق موسمي واحد، يُنسّق أسبوعيًا.",
      includes: [
        "4 توصيلات شهريًا",
        "زهور موسمية، باختيار منسّق الزهور",
        "مُغلّفة بورق الكرافت، مربوطة يدويًا",
      ],
    },
    signature: {
      blurb: "أغنى اشتراكاتنا الأسبوعية — الحجم المميّز للأتيليه.",
      includes: [
        "4 توصيلات شهريًا",
        "زهور موسمية فاخرة",
        "مزهرية مع التوصيلة الأولى",
        "أولوية في فترة التوصيل",
      ],
    },
    grand: {
      blurb: "تنسيقات لافتة للمداخل والطاولات والمكاتب.",
      includes: [
        "4 توصيلات شهريًا",
        "تنسيقات كبيرة الحجم",
        "منسّق زهور مخصّص",
        "تجديد في الصباح نفسه عند الطلب",
      ],
    },
  },
  help: {
    eyebrow: "مساعدة",
    deliveryTitle: "التوصيل، في أنحاء أبوظبي.",
    deliveryIntro:
      "اختاروا اليوم والفترة المناسبين للمستلِم، في أي مكان في أبوظبي. والتوصيل مجاني على جميع الطلبات.",
    deliveryWindows: "فترات التوصيل",
    approvalNote:
      "قبل كل توصيلة، يرسل لكم منسّق الزهور صورة أو مقطعًا للتنسيق النهائي على واتساب، وينتظر موافقتكم قبل أن يخرج.",
    faqsTitle: "أسئلة، وأجوبتها.",
  },
  errors: {
    eyebrow: "حدث خطأ ما",
    title: "سقطت بتلة من مكانها.",
    segmentBody:
      "لم يُحمَّل هذا الجزء من الصفحة، وكل ما عداه يعمل — حاولوا مرة أخرى، أو تابعوا التصفّح ريثما نُصلحه.",
    rootBody: "حدث ما قطع تحميل هذه الصفحة. سجّلنا ذلك — حاولوا مرة أخرى.",
    tryAgain: "حاولوا مرة أخرى",
    browseCollection: "تصفّحوا المجموعة",
    whatsappInstead: "اطلبوا عبر واتساب بدلًا من ذلك",
    returnHome: "العودة إلى الرئيسية",
    notFoundTitle: "هذه الصفحة ذبلت.",
    notFoundBody: "العنوان الذي اتّبعتموه لم يعد مُزهرًا — أمّا الأتيليه فما زال.",
    legal: "قانوني",
  },
  seal: {
    eyebrow: "مختوم باليد",
    line1: "لا شيء يخرج",
    line2: "من الأتيليه إلا مختومًا.",
    body: "يُغلّف بورق منقوش، ويُربط بشريطنا المطبوع، ويُختم بشعارنا والزهور ما زالت باردة من الأتيليه.",
    shop: "تسوّقوا المجموعة",
    how: "كيف نُغلّف",
  },
  ritual: {
    eyebrow: "موعدكم الأسبوعي مع الزهور",
    title: "عضوية كالانثي",
    body: "زهور نضِرة، مُنسّقة بعناية، تصل إلى بابكم كل أسبوع.",
    cta: "اكتشفوا العضوية",
  },
  tiers: {
    mostLoved: "الأكثر طلبًا",
    perDelivery: "/ لكل توصيلة",
    fourAMonth: "4 توصيلات شهريًا",
    begin: "ابدؤوا العضوية {name}",
    dialog: "بدء العضوية {name}",
    label: "العضوية {name}",
  },
  videoApproval: {
    eyebrow: "قبل أن تغادر الأتيليه",
    title: "شاهدوها قبل أن تصل.",
    copy: "عندما تكتمل الباقة، يرسل لكم منسّق الزهور صورة أو مقطعًا على واتساب. ولا نوصّل شيئًا حتّى ينال إعجابكم.",
    steps: [
      "نُنسّق الباقة يدويًا",
      "تصلكم صورة أو مقطع على واتساب",
      "وافقوا عليها، فتنطلق إلى وجهتها",
    ],
  },
  tierNames: {
    essential: "الأساسية",
    signature: "المميّزة",
    grand: "الكبرى",
  },
  occasionEmpty: {
    title: "مجموعة {name} قيد التنسيق.",
    body: "وحتّى تصل، يمكن لمنسّق الزهور أن ينسّق واحدة لهذه اللحظة. أخبرونا لمن هي، والألوان، والميزانية.",
  },
  meta: {
    home: "CALANTHE — أتيليه الزهور، الإمارات",
    about: "عن كالانثي",
    account: "حسابي",
    order: "الطلب",
    signIn: "تسجيل الدخول",
    register: "إنشاء حساب",
    forgotPassword: "نسيت كلمة المرور",
    resetPassword: "كلمة مرور جديدة",
    verify: "تأكيد البريد الإلكتروني",
    buildYourOwn: "صمّموا باقتكم",
    checkout: "إتمام الطلب",
    delivery: "معلومات التوصيل",
    events: "الفعاليات",
    faqs: "الأسئلة الشائعة",
    membership: "العضوية",
    occasions: "المناسبات",
    shop: "المتجر",
    wishlist: "قائمة الأمنيات",
    privacy: "سياسة الخصوصية",
    terms: "الشروط والأحكام",
    refunds: "سياسة الاسترداد والإلغاء",
  },
  wishlist: {
    eyebrow: "قريبة إلى القلب",
    title: "قائمة الأمنيات",
    emptyTitle: "ما تحفظونه هنا لا يذبل أبدًا.",
    emptyBody: "اضغطوا على القلب في أي باقة لتبقى قريبة منكم.",
  },
  shop: {
    all: "الكل",
    anyPrice: "أي سعر",
    sortFeatured: "المميّزة",
    sortNew: "الأحدث",
    sortPriceAsc: "السعر: من الأقل إلى الأعلى",
    sortPriceDesc: "السعر: من الأعلى إلى الأقل",
    nothingFound: "لا توجد باقات باسم «{query}».",
    nothingYet: "لا شيء يُزهر هنا بعد.",
    noResults: "جرّبوا مناسبة أو زهرة أو سعرًا مختلفًا — أو تصفّحوا المجموعة كاملة.",
    exploreAll: "تصفّحوا جميع الباقات",
    alsoFromAtelier: "من الأتيليه أيضًا",
    sameSpirit: "مُنسّقة بالروح ذاتها.",
    atelier: "الأتيليه",
    priceBands: {
      "under-300": "أقل من AED 300",
      "300-600": "من AED 300 إلى 600",
      "over-600": "أكثر من AED 600",
    },
  },
  product: {
    eyebrow: "المجموعة",
    breadcrumbShop: "المتجر",
    breadcrumbLabel: "مسار التنقل",

    composedFor: "تناسب",
    listAnd: " و",
    listComma: "، ",

    withExtras: {
      one: " مع إضافة واحدة",
      two: " مع إضافتين",
      few: " مع {n} إضافات",
      many: " مع {n} إضافة",
      other: " مع {n} إضافة",
    },

    promiseComposed: "تُنسّق خصيصًا لكم، وتُوصّل في اليوم الذي تختارونه.",
    promiseApproval: "صورة أو مقطع على واتساب لتوافقوا عليه قبل أن يخرج.",
    promiseReach: "نوصّل في أنحاء أبوظبي.",

    size: "الحجم",
    extras: "لمسة إضافية",
    deliveryDay: "يوم التوصيل",

    cardSection: "البطاقة والمستلِم",
    cardAdded: "أُضيفت. ويمكنكم تعديلها عند إتمام الطلب أيضًا.",
    cardOptional: "اختياري. أضيفوا بطاقة بخط اليد، واسم من سيستلمها.",
    cardMessage: "نص البطاقة",
    cardPlaceholder: "اكتبوا كلمات يحتفظون بها…",
    recipientName: "اسم المستلِم",
    recipientPhone: "هاتف المستلِم",
    phonePlaceholder: "050 123 4567",
    recipientNote: "يُستخدم لتنسيق التوصيل فقط. ولا يظهر لهم السعر أبدًا.",

    addToCart: "أضيفوا إلى السلة",
    addToCartWithTotal: "أضيفوا إلى السلة — {total}",

    gallery: "صور {name}",
    galleryView: "الصورة {n}",
  },
  sizeNames: {
    standard: "أساسي",
    deluxe: "فاخر",
    premium: "استثنائي",
  },
  sizeNotes: {
    standard: "كما في الصورة",
    deluxe: "أكبر بمقدار الثلث",
    premium: "ضعف عدد السيقان",
  },
  addonNames: {
    vase: "مزهرية",
    chocolates: "شوكولاتة",
    balloon: "بالون",
    cake: "كيكة بنتو",
    teddy: "دبدوب",
    polaroid: "بطاقة بولارويد",
  },
  server: {
    wait: {
      moment: "انتظروا لحظة ثم حاولوا مرة أخرى.",
      minutes: {
        one: "حاولوا مرة أخرى بعد دقيقة.",
        two: "حاولوا مرة أخرى بعد دقيقتين.",
        few: "حاولوا مرة أخرى بعد {n} دقائق.",
        many: "حاولوا مرة أخرى بعد {n} دقيقة.",
        other: "حاولوا مرة أخرى بعد {n} دقيقة.",
      },
      hours: {
        one: "حاولوا مرة أخرى بعد ساعة تقريبًا.",
        two: "حاولوا مرة أخرى بعد ساعتين تقريبًا.",
        few: "حاولوا مرة أخرى بعد {n} ساعات تقريبًا.",
        many: "حاولوا مرة أخرى بعد {n} ساعة تقريبًا.",
        other: "حاولوا مرة أخرى بعد {n} ساعة تقريبًا.",
      },
    },
    checkout: {
      rateLimited: "طلبات كثيرة من هذا الجهاز. {wait}",
      basketEmpty: "السلة فارغة.",
      nameRequired: "يُرجى كتابة الاسم.",
      emailInvalid: "البريد الإلكتروني يبدو غير صحيح.",
      phoneFormat: "اكتبوا الرقم بالصيغة الدولية، مثال: +971501234567.",
      addressRequired: "أضيفوا عنوان التوصيل.",
      slotRequired: "اختاروا وقت التوصيل.",
      recipientPhoneInvalid: "رقم هاتف المستلِم يبدو غير صحيح.",
      dateRequired: "اختاروا تاريخ التوصيل.",
      datePassed: "تاريخ التوصيل هذا قد مضى.",
      catalogueUnreachable: "لم نتمكن من الوصول إلى المجموعة. حاولوا مرة أخرى.",
      productUnavailable: "إحدى الباقات في السلة لم تعد متوفرة. يُرجى مراجعة السلة.",
      pricingRejected: "لم نتمكن من حساب قيمة السلة. راجعوا العناصر وحاولوا مرة أخرى.",
      creationFailed: "لم نتمكن من تأكيد طلبكم، ولم يُخصم أي مبلغ — حاولوا مرة أخرى.",
      paymentUnavailable: "الدفع الإلكتروني غير متاح حاليًا. يُرجى مراسلتنا على واتساب لإتمام طلبكم.",
    },
    account: {
      credentialsRequired: "اكتبوا البريد الإلكتروني وكلمة المرور.",
      signInRateLimited: "محاولات دخول كثيرة. {wait}",
      signInFailed: "لم نتمكن من تسجيل الدخول. حاولوا مرة أخرى.",
      staffAccount: "هذا حساب لفريق العمل. استخدموا صفحة دخول لوحة الإدارة.",
      signInRejected:
        "البريد الإلكتروني وكلمة المرور غير متطابقين، أو أن الحساب لم يُفعَّل بعد.",
      nameRequired: "يُرجى كتابة الاسم.",
      emailInvalid: "تحقّقوا من البريد الإلكتروني.",
      passwordTooShort: "استخدموا {min} أحرف على الأقل.",
      passwordMismatch: "كلمتا المرور غير متطابقتين.",
      registerRateLimited: "حسابات كثيرة أُنشئت من هنا. {wait}",
      registerFailed: "لم نتمكن من إنشاء الحساب الآن. حاولوا مرة أخرى.",
      verifyLinkInvalid: "رابط التأكيد غير صالح.",
      linkUsedOrExpired: "انتهت صلاحية الرابط أو أنّه استُخدم من قبل.",
      resetLinkInvalid: "رابط إعادة التعيين غير صالح.",
      phoneTaken:
        "رقم الهاتف هذا مستخدم في حساب آخر. سجّلوا الدخول، أو اتركوا حقل الهاتف فارغًا وأضيفوه لاحقًا.",
    },
    enquiry: {
      rateLimited: "هذا عدد كبير من الطلبات في وقت واحد. {wait}",
      nameRequired: "يُرجى كتابة الاسم.",
      emailInvalid: "تحقّقوا من البريد الإلكتروني.",
      phoneFormat: "اكتبوا رقم الهاتف مع رمز الدولة، مثل +9715…",
      recordFailed: "لم نتمكن من تسجيل ذلك الآن. حاولوا مرة أخرى، أو راسلونا على واتساب.",
      budgetRequired: "اختاروا الميزانية.",
      eventTypeRequired: "أخبرونا بنوع المناسبة.",
      dateInvalid: "تحقّقوا من التاريخ.",
      dateRequired: "اختاروا تاريخ المناسبة.",
      guestsRequired: "أخبرونا بعدد الضيوف تقريبًا.",
      venueRequired: "أخبرونا بالمكان أو المنطقة.",
      frequencyRequired: "اختاروا عدد مرات وصول الزهور.",
      deliveryPreferenceRequired: "اختاروا إلى أين تُرسل الزهور.",
      startDateInvalid: "تحقّقوا من تاريخ البداية.",
      startDatePast: "اختاروا تاريخ بداية من اليوم أو بعده.",
    },
  },
  checkout: {
    eyebrow: "إتمام الطلب",
    title: "بقيت خطوة واحدة.",

    forWhom: "لمن هذه الزهور؟",
    whenWhere: "الموعد والمكان",
    yourDetails: "بياناتكم",
    payment: "الدفع",

    audience: "لمن هذا الطلب",
    gift: "هدية",
    myself: "لنفسي",

    recipientName: "اسم المستلِم",
    recipientNamePlaceholder: "الاسم",
    recipientPhone: "هاتف المستلِم (اختياري)",
    phonePlaceholder: "050 123 4567",
    surprise: "أبقوها مفاجأة. تواصلوا معي بشأن التوصيل، لا مع المستلِم.",

    emirate: "إمارة التوصيل",
    emiratePlaceholder: "اختاروا الإمارة",
    emirateOption: "{name} — التوصيل {fee}",
    emirateOptionFree: "{name} — توصيل مجاني",
    deliveryFree: "التوصيل مجاني على هذا الطلب.",
    deliveryFreeAway: "يفصلكم {amount} عن التوصيل المجاني.",
    address: "عنوان التوصيل",
    addressPlaceholder: "فيلا أو شقة، الشارع، المنطقة",
    day: "يوم التوصيل",
    window: "الفترة الزمنية",

    name: "الاسم",
    namePlaceholder: "الاسم الكامل",
    phone: "رقم الهاتف",
    email: "البريد الإلكتروني لتحديثات الطلب",
    emailPlaceholder: "you@example.com",

    cardTitle: "البطاقة أو Apple Pay أو Google Pay",
    cardBody: "دفع آمن عبر Stripe. تذهب بيانات بطاقتكم مباشرة إلى Stripe ولا تصل إلينا أبدًا.",
    paymentLoading: "جارٍ تحميل الدفع الآمن…",
    paymentFailed: "لم تتم عملية الدفع، ولم يُخصم أي مبلغ. يُرجى التحقق من البيانات أو تجربة بطاقة أخرى.",

    yourOrder: "طلبكم",
    withCard: "مع بطاقة مكتوبة بخط اليد",
    subtotal: "المجموع الفرعي",
    delivery: "التوصيل",
    deliveryTo: "التوصيل إلى {name}",
    complimentary: "مجاني",
    chooseEmirate: "اختاروا الإمارة",
    total: "الإجمالي",
    paidByCard: "دفع آمن بالبطاقة أو Apple Pay أو Google Pay.",

    showSummary: "إظهار ملخّص الطلب",
    hideSummary: "إخفاء ملخّص الطلب",

    place: "ادفعوا الآن",
    placeWithTotal: "ادفعوا الآن — {total}",
    placing: "جارٍ إتمام الدفع…",
    placingShort: "جارٍ الدفع…",

    questions: "لديكم سؤال أولًا؟",
    messageFlorist: "راسلوا منسّق الزهور",

    itemCount: {
      one: "باقة واحدة",
      two: "باقتان",
      few: "{n} باقات",
      many: "{n} باقة",
      other: "{n} باقة",
    },
    pickEmirate: "اختاروا الإمارة",

    formInvalid: "بعض البيانات تحتاج مراجعة، وقد أشرنا إليها أعلاه.",
    dayGone: "يوم التوصيل الذي اخترتموه لم يعد متاحًا. اختاروا يومًا آخر.",
    dayInvalid: "اختاروا يومًا يمكننا التوصيل فيه.",

    orderRef: "الطلب {number}",
    placedTitle: "زهوركم بين أيدينا الآن.",
    placedBody:
      "وصلتنا دفعتكم. وقبل أن يخرج التنسيق من الأتيليه، يرسل لكم منسّق الزهور صورة أو مقطعًا على واتساب لتوافقوا عليه.",
    viewOrders: "عرض طلباتكم",
    continueShopping: "متابعة التسوّق",

    errors: {
      recipientNameRequired: "أخبرونا من سيستلم الزهور.",
      phoneInvalid: "تحقّقوا من الرقم، مثال: 050 123 4567.",
      zoneRequired: "اختاروا الإمارة التي نوصّل إليها.",
      nameRequired: "يُرجى كتابة الاسم.",
      phoneRequired: "نحتاج رقمًا لتأكيد الطلب على واتساب.",
      emailRequired: "نرسل تحديثات الطلب إلى هذا البريد.",
      emailInvalid: "البريد الإلكتروني يبدو غير مكتمل.",
      addressRequired: "إلى أين نوصّل؟",
    },
  },
  schedule: {
    today: "اليوم",
    tomorrow: "غدًا",
    passed: "انتهت",
    tooSoon: "قريبة جدًا",
  },
  zoneNames: {
    dubai: "دبي",
    "abu-dhabi": "أبوظبي",
    sharjah: "الشارقة",
    ajman: "عجمان",
    "umm-al-quwain": "أم القيوين",
    "ras-al-khaimah": "رأس الخيمة",
    fujairah: "الفجيرة",
  },
  account: {
    eyebrow: "حسابي",
    signInTitle: "أهلًا بعودتكم.",
    signInIntro: "سجّلوا الدخول لمتابعة طلباتكم والتفاصيل التي نحفظها لتوصيلاتكم.",
    registerTitle: "احفظوا تفاصيلكم معنا.",
    registerIntro:
      "الحساب يحفظ العناوين والباقات السابقة. ولا تحتاجونه للطلب — يمكن إرسال أي باقة دون حساب.",
    forgotTitle: "لنُعِدكم إلى حسابكم.",
    forgotIntro: "أخبرونا بالبريد الذي سجّلتم به، وسنرسل رابطًا لاختيار كلمة مرور جديدة.",
    resetTitle: "اختاروا كلمة مرور جديدة.",
    resetIntro: "اختاروا كلمة لم تستخدموها في مكان آخر.",
    verifiedTitle: "تم تأكيد البريد الإلكتروني.",
    verifiedIntro:
      "هذا كل شيء. يمكنكم تسجيل الدخول بالبريد وكلمة المرور من الآن — ولن نطلب التأكيد مرة أخرى.",
    expiredTitle: "انتهت صلاحية هذا الرابط.",
    incompleteTitle: "هذا الرابط غير مكتمل.",
    incompleteIntro:
      "رابط إعادة التعيين ينقصه الرمز. اطلبوا رابطًا جديدًا وسيصلكم خلال دقيقة أو دقيقتين.",
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
    creating: "جارٍ إنشاء الحساب…",
    signingIn: "جارٍ تسجيل الدخول…",
    sendLink: "إرسال الرابط",
    sendNewLink: "إرسال رابط جديد",
    sending: "جارٍ الإرسال…",
    saveNewPassword: "حفظ كلمة المرور",
    saving: "جارٍ الحفظ…",
    resend: "إعادة إرسال البريد",
    resent: "تم الإرسال مجددًا",
    backToSignIn: "العودة لتسجيل الدخول",
    newHere: "ليس لديكم حساب؟",
    haveAccount: "لديكم حساب بالفعل؟",
    forgotLink: "نسيتم كلمة المرور؟",
    resendLink: "لم يصلكم بريد التأكيد؟",
    rememberedIt: "تذكّرتموها؟",
    checkInbox: "تفقّدوا {email} لرابط تأكيد البريد. تنتهي صلاحيته خلال ساعات.",
    checkInboxNote: "لا شيء يُفعَّل قبل التأكيد — ويمكنكم الطلب دون حساب في هذه الأثناء.",
    resetSentIfExists:
      "إذا كان لهذا البريد حساب لدينا، فرابط اختيار كلمة مرور جديدة في طريقه إليكم. تنتهي صلاحيته خلال ساعة تقريبًا.",
    resendIfWaiting: "إذا كان هذا البريد بانتظار التأكيد، فرابط جديد في طريقه إليكم.",
    passwordChanged: "تم تغيير كلمة المرور. يمكنكم تسجيل الدخول بها الآن.",
    orders: "طلباتكم",
    noOrders: "لا توجد طلبات بعد",
    noOrdersBody: "عندما تطلبون، سيظهر الطلب هنا مع مراحل تقدّمه.",
    visitShop: "زيارة المتجر",
    signInForOrders:
      "سجّلوا الدخول لعرض طلباتكم. ولا تحتاجون حسابًا للشراء — يمكن طلب أي باقة دون حساب.",
    orderEyebrow: "طلبكم",
    pleaseSignIn: "يُرجى تسجيل الدخول.",
    signInForOrder:
      "سجّلوا الدخول لعرض هذا الطلب. ولا تُعرض الطلبات إلا للحساب الذي أنشأها.",
    placedOn: "طُلب في {date}",
    whatYouOrdered: "ما طلبتموه",
    deliveryFree: "مجانًا",
    payableOnDelivery: "بانتظار الدفع.",
    paymentState: "الدفع: {status}",
    deliveryHeading: "التوصيل",
    deliveryTo: "إلى {name}",
    backToOrders: "العودة إلى طلباتكم",
    fulfilment: {
      NEW: "جديد",
      CONFIRMED: "مؤكَّد",
      PREPARING: "قيد التحضير",
      READY: "جاهز",
      OUT_FOR_DELIVERY: "خرج للتوصيل",
      DELIVERED: "تم التسليم",
      CANCELLED: "ملغى",
    },
    payment: {
      PENDING: "بانتظار الدفع",
      AUTHORIZED: "مُصرَّح به",
      PAID: "مدفوع",
      FAILED: "فشل الدفع",
      REFUNDED: "مُسترَد",
      PARTIALLY_REFUNDED: "مُسترَد جزئيًا",
    },
  },
  pages: {
    shopEyebrow: "المجموعة",
    shopTitle: "تُنسّق صباحًا، وتصل إلى الباب في اليوم الذي تختارونه.",
    shopIntro: "كل باقة تُبنى ساقًا بساق في الأتيليه — ولا تتشابه اثنتان.",
    shopReadyEyebrow: "جاهز للطلب",
    shopReadyTitle: "تُنسّق صباحًا، وتنفد مساءً.",
    arrangementCount: {
      one: "باقة واحدة",
      two: "باقتان",
      few: "{n} باقات",
      many: "{n} باقة",
      other: "{n} باقة",
    },
    occasionsEyebrow: "المناسبات",
    occasionsTitle: "لكل ما لا يُقال.",
    occasionsIntro:
      "بعض المشاعر يسهل إهداؤها أكثر من قولها. ابدؤوا باللحظة، ونتكفّل نحن بالباقي.",
    occasionCount: {
      one: "مناسبة واحدة",
      two: "مناسبتان",
      few: "{n} مناسبات",
      many: "{n} مناسبة",
      other: "{n} مناسبة",
    },
  },
  footer: {
    shop: "المتجر",
    help: "المساعدة",
    contact: "تواصلوا معنا",
    about: "عن كالانثي",
    memberships: "العضويات",
    events: "الفعاليات",
    delivery: "معلومات التوصيل",
    faqs: "الأسئلة الشائعة",
    terms: "الشروط والأحكام",
    privacy: "سياسة الخصوصية",
    refunds: "سياسة الاسترداد والإلغاء",
    whatsapp: "واتساب",
    instagram: "إنستغرام",
    email: "البريد الإلكتروني",
    rights: "© 2026 كالانثي",
  },
  language: {
    label: "اللغة",
    english: "English",
    arabic: "العربية",
    toEnglish: "التبديل إلى الإنجليزية",
    toArabic: "التبديل إلى العربية",
  },
};

export type Locale = "en" | "ar";
export type Dictionary = typeof en;

export const dictionaries: Record<Locale, Dictionary> = { en, ar };

export function dictionaryFor(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en;
}
