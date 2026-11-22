import { EXTRA_SHOPS } from "./extra-stalls.ts";
import { FREE_TIER_ENABLED } from "./runtime-flags.ts";

/** Shop WhatsApp: Jordan mobile 077, 078, or 079 in E.164. */
export const SHOP_WHATSAPP = /^\+9627[789]\d{7}$/;
export const WHATSAPP_REQUIRED = "Add a valid Jordan WhatsApp number (07…) · أضف رقم واتساب أردني صحيح (07…)";

export type PlanId = "free" | "basic" | "pro" | "premium";

export function normalizePlan(plan: string | null | undefined): PlanId {
  if (plan === "grow" || plan === "pro") return "pro";
  if (plan === "basic" || plan === "premium" || plan === "free") return plan;
  return FREE_TIER_ENABLED ? "free" : "basic";
}

/** What buyers see. Free stays badge-less only while the Free tier flag is on. */
export function displayPlan(plan: string | null | undefined): PlanId {
  if (plan === "pro" || plan === "grow") return "pro";
  if (plan === "premium") return "premium";
  if (plan === "free" && FREE_TIER_ENABLED) return "free";
  return "basic";
}
export type CategoryId =
  | "food"
  | "handicrafts"
  | "jewelry"
  | "farmers-market"
  | "misc"
  | "beauty"
  | "clothes"
  | "all";

export type ItemOption = {
  en: string;
  ar: string;
  extra?: number;
  off?: boolean;
  reason?: "unavailable" | "stock" | "sold";
  back?: string;
};
export type ItemChoice = { en: string; ar: string; options: ItemOption[] };

export type Product = {
  id: string;
  name: string;
  nameAr: string;
  price: number;
  /** Shown instead of a number when the seller has no fixed price. */
  priceMode?: "price" | "na" | "inquire";
  desc: string;
  descAr: string;
  images: string[];
  group?: string;
  groupAr?: string;
  choices?: ItemChoice[];
  chart?: string;
  video?: string;
  paused?: boolean;
  hideReason?: "unavailable" | "stock" | "sold";
  hideBack?: string;
};

export type Review = {
  user: string;
  area: string;
  score: number;
  comment: string;
  reply?: string;
};

export type Shop = {
  slug: string;
  name: string;
  nameAr: string;
  area: string;
  areaAr: string;
  category: CategoryId;
  categories?: CategoryId[];
  /** Stored aisle is not a launch category. Skip buyer aisle filters; do not rewrite it. */
  offAisle?: boolean;
  plan: PlanId;
  phone: string;
  avatar: string;
  cover?: string;
  bio?: string;
  bioAr?: string;
  hours?: string;
  isOpen?: boolean | null;
  /** When closed, buyers can still send WhatsApp. Omitted means yes. */
  contactWhenClosed?: boolean;
  views?: number;
  likes?: number;
  followers?: number;
  /** Times people sent an order or inquiry on WhatsApp. */
  waOrders?: number;
  custom?: { en: string; ar: string };
  rating?: number;
  reviewCount?: number;
  socials?: { label: string; href: string }[];
  delivery?: { amman: string; outside: string; intl?: string };
  /** delivery, pickup, or both. Buyer picks on Order now. */
  handoff?: "delivery" | "pickup" | "both";
  keywords?: string[];
  since?: string;
  joinedAt?: number;
  campaign?: { code: string; progress: string };
  products: Product[];
  reviews?: Review[];
  mode: "inquire" | "invoice" | "both";
  /** Seller option: inquire tab asks for a quantity and shows a total. */
  askQty?: boolean;
  /** Optional note shown while the stall is open. */
  openNote?: string;
  openNoteAr?: string;
  /** Optional note shown while the stall is closed. */
  closedNote?: string;
  closedNoteAr?: string;
  /** Other sellers may message this stall inside Souq Battuta. */
  allowSellerMail?: boolean;
  km: number;
  createdAt?: number;
  demo?: boolean;
  hidden?: boolean;
};

export const PLANS: Record<
  PlanId,
  {
    id: PlanId;
    name: string;
    nameAr: string;
    price: string;
    priceNote: string;
    badge: "none" | "yellow" | "green" | "blue";
    stampLabel: string;
    listings: number;
    images: number;
    helloPerDay: number;
    descChars: number;
    options: boolean;
    monthly: number;
    bundles: { 3: number; 6: number; 12: number };
    video: boolean;
    openClosed: boolean;
    views: boolean;
    reviews: boolean;
    socials: boolean;
    keywords: number;
    campaign: boolean;
    invoice: boolean;
    photo: boolean;
    customTemplate: boolean;
    blurb: string;
    blurbAr: string;
  }
> = {
  free: {
    id: "free",
    name: "Free",
    nameAr: "مجاني",
    price: "0 JOD",
    priceNote: "Kept for old test accounts",
    badge: "none",
    stampLabel: "",
    listings: 5,
    images: 4,
    helloPerDay: 1,
    descChars: 200,
    options: false,
    monthly: 0,
    bundles: { 3: 0, 6: 0, 12: 0 },
    video: false,
    openClosed: false,
    views: false,
    reviews: false,
    socials: false,
    keywords: 0,
    campaign: false,
    invoice: false,
    photo: false,
    customTemplate: false,
    blurb: "A shop with a duck. Five items. One main photo and three extra. Inquiry on WhatsApp.",
    blurbAr: "دكان مع البطة. خمسة أصناف. صورة رئيسية وثلاث إضافية. استفسار واتساب.",
  },
  basic: {
    id: "basic",
    name: "Basic",
    nameAr: "أساسي",
    price: "5 JOD/mo",
    priceNote: "Member stamp",
    badge: "yellow",
    stampLabel: "Member",
    listings: 10,
    images: 4,
    helloPerDay: 2,
    descChars: 200,
    options: false,
    monthly: 5,
    bundles: { 3: 13.5, 6: 25.5, 12: 48 },
    video: false,
    openClosed: true,
    views: true,
    reviews: false,
    socials: true,
    keywords: 5,
    campaign: false,
    invoice: false,
    photo: true,
    customTemplate: false,
    blurb: "Your photo, yellow duck stamp, Open/Closed. One main photo and three extra. Still inquiry-only on WhatsApp.",
    blurbAr: "صورتك، ختم البط الأصفر، مفتوح/مغلق. صورة رئيسية وثلاث إضافية. الاستفسار على واتساب فقط.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    nameAr: "برو",
    price: "15 JOD/mo",
    priceNote: "Pro stamp",
    badge: "green",
    stampLabel: "Pro",
    listings: 30,
    images: 6,
    helloPerDay: 4,
    descChars: 300,
    options: true,
    monthly: 15,
    bundles: { 3: 40.5, 6: 76.5, 12: 144 },
    video: true,
    openClosed: true,
    views: true,
    reviews: true,
    socials: true,
    keywords: 15,
    campaign: true,
    invoice: true,
    photo: true,
    customTemplate: false,
    blurb: "Green crown, 30 items, one main photo and five more, reviews, and sizes or colors you name yourself.",
    blurbAr: "تاج أخضر، 30 صنفاً، صورة رئيسية وخمس إضافية، تقييمات، ومقاسات أو ألوان تسميها أنت.",
  },
  premium: {
    id: "premium",
    name: "Premium",
    nameAr: "مميّز",
    price: "30 JOD/mo",
    priceNote: "Premium stamp",
    badge: "blue",
    stampLabel: "Premium",
    listings: 100,
    images: 6,
    helloPerDay: 6,
    descChars: 500,
    options: true,
    monthly: 30,
    bundles: { 3: 81, 6: 153, 12: 288 },
    video: true,
    openClosed: true,
    views: true,
    reviews: true,
    socials: true,
    keywords: 25,
    campaign: true,
    invoice: true,
    photo: true,
    customTemplate: true,
    blurb: "Navy crown, 100 items, one main photo and three extra, a video, search on the shop, and sizes or colors you name yourself.",
    blurbAr: "تاج كحلي، 100 صنف، صورة رئيسية وثلاث إضافية، فيديو، بحث في الدكان، ومقاسات أو ألوان تسميها أنت.",
  },
};

export const SELLER_CATEGORY_IDS = ["food", "handicrafts", "jewelry", "farmers-market", "misc", "beauty", "clothes"] as const;
export const LAUNCH_CATEGORY_IDS: CategoryId[] = [...SELLER_CATEGORY_IDS];
export const OFFERED_PLANS: PlanId[] = FREE_TIER_ENABLED ? ["free", "basic", "pro", "premium"] : ["basic", "pro", "premium"];

export const PLAN_TOOLS: { id: string; en: string; ar: string; plans: PlanId[]; live: boolean }[] = [
  { id: "multi-photo", en: "Pick several photos at once", ar: "اختيار عدة صور مرة واحدة", plans: ["free", "basic", "pro", "premium"], live: false },
  { id: "duplicate", en: "Duplicate an item", ar: "نسخ صنف", plans: ["free", "basic", "pro", "premium"], live: false },
  { id: "quick-replies", en: "Order quick replies", ar: "ردود سريعة على الطلب", plans: ["free", "basic", "pro", "premium"], live: false },
];

export function isSellerCategory(id: string): id is Exclude<CategoryId, "all"> {
  return (SELLER_CATEGORY_IDS as readonly string[]).includes(id);
}

export function isCategoryId(id: string): id is CategoryId {
  return isSellerCategory(id) || id === "all";
}

export const CATEGORIES: {
  id: CategoryId;
  en: string;
  ar: string;
  icon: string;
}[] = [
  { id: "food", en: "Food", ar: "طعام", icon: "/brand/icons/icon-food.jpg" },
  { id: "handicrafts", en: "Handicrafts", ar: "حرف يدوية", icon: "/brand/icons/icon-handicrafts.jpg" },
  { id: "jewelry", en: "Jewelry", ar: "مجوهرات", icon: "/brand/icons/icon-jewelry.jpg" },
  { id: "farmers-market", en: "Farmers Market", ar: "سوق المزارعين", icon: "/brand/icons/icon-farmers-market.jpg" },
  { id: "misc", en: "Misc", ar: "متنوع", icon: "/brand/icons/icon-misc.jpg" },
  { id: "beauty", en: "Beauty", ar: "جمال", icon: "/brand/icons/icon-beauty.jpg" },
  { id: "clothes", en: "Clothes", ar: "ملابس", icon: "/brand/icons/icon-clothes.jpg" },
  { id: "all", en: "All", ar: "الكل", icon: "/brand/icons/icon-all.jpg" },
];

const duck = "/brand/avatars/seller-duck.jpg?v=2";

export const SHOPS: Shop[] = [
  {
    slug: "ahlan-bakery",
    name: "Ahlan Bakery",
    nameAr: "أهلان بيكري",
    area: "Sweifieh",
    areaAr: "الصويفية",
    category: "food",
    plan: "basic",
    phone: "",
    avatar: duck,
    since: "March 2026",
    km: 1.2,
    mode: "inquire",
    products: [
      {
        id: "knafeh",
        name: "Knafeh",
        nameAr: "كنافة",
        price: 5,
        desc: "Fresh morning tray. Cheese or cream.",
        descAr: "صينية الصباح. جبنة أو قشطة.",
        images: ["/brand/shops/knafeh.jpg", "/brand/shops/knafeh-slice.jpg", "/brand/shops/knafeh-tray.jpg"],
      },
      {
        id: "kaak",
        name: "Ka'ak",
        nameAr: "كعك",
        price: 3,
        desc: "Sesame rings from the morning oven.",
        descAr: "كعك سمسم من فرن الصبح.",
        images: ["/brand/shops/kaak.jpg", "/brand/shops/bread.jpg"],
      },
      {
        id: "manakish",
        name: "Manakish",
        nameAr: "مناقيش",
        price: 2.5,
        desc: "Za'atar or cheese.",
        descAr: "زعتر أو جبنة.",
        images: ["/brand/shops/manakish.jpg", "/brand/shops/pita.jpg"],
      },
      {
        id: "dates",
        name: "Date cookies",
        nameAr: "معمول",
        price: 4,
        desc: "Ma'amoul, powdered sugar.",
        descAr: "معمول بالسكر الناعم.",
        images: ["/brand/shops/maamoul.jpg"],
      },
      {
        id: "bread",
        name: "Fresh bread",
        nameAr: "خبز طازج",
        price: 6,
        desc: "Round loaves, still warm.",
        descAr: "أرغفة دافئة.",
        images: ["/brand/shops/bread.jpg", "/brand/shops/pita.jpg"],
      },
    ],
  },
  {
    slug: "alchemist-clay",
    name: "Alchemist Clay",
    nameAr: "خزف الكيميائي",
    area: "Weibdeh",
    areaAr: "الويبدة",
    category: "handicrafts",
    plan: "basic",
    phone: "",
    avatar: "/brand/shops/clay-studio.jpg",
    cover: "/brand/shops/clay-wheel.jpg",
    bio: "Wheel-thrown bowls and lamps from a Weibdeh room. Small batches, no two alike.",
    bioAr: "أوانٍ وقناديل من غرفة في الويبدة. دفعات صغيرة، كل قطعة وحدها.",
    hours: "Sat–Thu · 11:00–19:00",
    isOpen: true,
    views: 0,
    since: "January 2026",
    km: 3.1,
    mode: "inquire",
    askQty: true,
    products: [
      {
        id: "amphora",
        name: "Amphora vase",
        nameAr: "زهرية",
        price: 42,
        desc: "Terracotta, sage drip glaze.",
        descAr: "فخار بتطليعة سالفيا.",
        images: ["/brand/shops/clay-wheel.jpg", "/brand/shops/clay-studio.jpg"],
      },
      {
        id: "mug",
        name: "Drip mug",
        nameAr: "كوز",
        price: 14,
        desc: "Peach and sage glaze. Daily cup.",
        descAr: "تطليعة خوخ وسالفيا.",
        images: ["/brand/shops/mug.jpg", "/brand/shops/clay-studio.jpg"],
      },
      {
        id: "lamp",
        name: "Oil lamp",
        nameAr: "قنديل",
        price: 28,
        desc: "Levantine form, new fire.",
        descAr: "شكل شامي، نار جديدة.",
        images: ["/brand/shops/lamp.jpg"],
      },
      {
        id: "bowl",
        name: "Serving bowl",
        nameAr: "زبدية",
        price: 36,
        desc: "Wide, for maqluba night.",
        descAr: "واسعة لليلة مقلوبة.",
        images: ["/brand/shops/clay-studio.jpg", "/brand/shops/mug.jpg"],
      },
      {
        id: "set",
        name: "Four cups",
        nameAr: "أربع كاسات",
        price: 48,
        desc: "A mismatched family.",
        descAr: "عائلة غير متطابقة.",
        images: ["/brand/shops/mug.jpg"],
      },
    ],
  },
  {
    slug: "namos-kitchen",
    name: "Namos Kitchen",
    nameAr: "مطبخ ناموس",
    area: "Jabal Amman",
    areaAr: "جبل عمّان",
    category: "food",
    plan: "pro",
    phone: "",
    avatar: "/brand/shops/namos.jpg",
    cover: "/brand/shops/maqluba.jpg",
    bio: "Home-cooked Arabic food from our family kitchen. Maqluba, mlokhieh, kibbeh — discovery on your road.",
    bioAr: "طبخ بيت من مطبخ العيلة. مقلوبة، ملوخية، كبة — الاكتشاف على طريقك.",
    hours: "Sat–Thu · 10:00–20:00",
    isOpen: true,
    views: 0,
    likes: 22,
    rating: 4.8,
    reviewCount: 36,
    socials: [
      { label: "Instagram", href: "https://instagram.com" },
      { label: "Facebook", href: "https://facebook.com" },
    ],
    delivery: { amman: "2 JOD", outside: "5 JOD", intl: "discuss on WhatsApp" },
    keywords: ["maqluba", "home food", "jabal amman", "mlokhieh"],
    since: "November 2025",
    km: 2.0,
    mode: "both",
    campaign: { code: "NAMOS", progress: "44 / 60 الجبر" },
    products: [
      {
        id: "maqluba",
        name: "Maqluba",
        nameAr: "مقلوبة",
        price: 18,
        desc: "Inverted rice, roasted vegetables. Family tray.",
        descAr: "رز مقلوب وخضار مشوية. صينية عيلة.",
        images: ["/brand/shops/maqluba.jpg", "/brand/shops/namos.jpg"],
        group: "Mains",
      },
      {
        id: "mlokhieh",
        name: "Mlokhieh",
        nameAr: "ملوخية",
        price: 14,
        desc: "With rice and lemon.",
        descAr: "مع رز وليمون.",
        images: ["/brand/shops/mlokhieh.jpg"],
        group: "Mains",
      },
      {
        id: "kibbeh",
        name: "Kibbeh",
        nameAr: "كبة",
        price: 10,
        desc: "Fried, yogurt on the side.",
        descAr: "مقلية مع لبن.",
        images: ["/brand/shops/kibbeh.jpg"],
        group: "Mains",
      },
      {
        id: "pita",
        name: "Pita & labneh",
        nameAr: "خبز ولبنة",
        price: 6,
        desc: "Olive oil, chili.",
        descAr: "زيت حار.",
        images: ["/brand/shops/pita.jpg"],
        group: "Sides",
      },
    ],
    reviews: [],
  },
  {
    slug: "beit-al-tiraz",
    name: "Beit al-Tiraz",
    nameAr: "بيت الطراز",
    area: "Abdoun",
    areaAr: "عبدون",
    category: "beauty",
    plan: "premium",
    phone: "",
    avatar: "/brand/shops/tiraz-atelier.jpg",
    cover: "/brand/shops/hanging.jpg",
    bio: "Atelier for Levantine embroidery, silk hangings, and guest-room cloth. Made in Abdoun, shown like a small museum.",
    bioAr: "مشغل للتطريز الشامي والحرير. في عبدون، معروض كمتحف صغير.",
    hours: "Sun–Thu · 12:00–21:00",
    isOpen: true,
    views: 0,
    followers: 240,
    waOrders: 86,
    rating: 4.9,
    reviewCount: 18,
    socials: [
      { label: "Instagram", href: "https://instagram.com" },
      { label: "Pinterest", href: "https://pinterest.com" },
    ],
    delivery: { amman: "3 JOD", outside: "8 JOD", intl: "quoted on WhatsApp" },
    keywords: ["tiraz", "embroidery", "abdoun", "silk", "guest room"],
    since: "August 2025",
    km: 4.4,
    mode: "invoice",
    custom: {
      en: "Thread color, length, and a name in Arabic or English. Tell us the room it is for.",
      ar: "لون الخيط والطول والاسم بالعربية أو الإنجليزية. خبرنا لأي غرفة.",
    },
    campaign: { code: "TIRAZ", progress: "12 / 60 الجبر" },
    products: [
      {
        id: "cloth",
        name: "Tiraz runner",
        nameAr: "مفرش طراز",
        price: 120,
        desc: "Gold thread on indigo linen.",
        descAr: "خيط ذهب على كتان نيلي.",
        images: ["/brand/shops/tiraz-cloth.jpg", "/brand/shops/hanging.jpg"],
        group: "Runners",
        groupAr: "المفارش",
      },
      {
        id: "cushion",
        name: "Cushion cover",
        nameAr: "وجه مخدة",
        price: 55,
        desc: "Geometric gold motif.",
        descAr: "نقوش هندسية ذهبية.",
        images: ["/brand/shops/cushion.jpg"],
        group: "Cushions",
        groupAr: "المخدات",
      },
      {
        id: "hanging",
        name: "Wall hanging",
        nameAr: "معلّقة",
        price: 210,
        desc: "Brass rod, silk field.",
        descAr: "قضيب نحاس وحقل حرير.",
        images: ["/brand/shops/hanging.jpg", "/brand/shops/tiraz-atelier.jpg"],
        group: "Hangings",
        groupAr: "المعلقات",
      },
      {
        id: "set",
        name: "Guest-room set",
        nameAr: "طقم ضيافة",
        price: 340,
        desc: "Runner + two cushions.",
        descAr: "مفرش ومخدتان.",
        images: ["/brand/shops/tiraz-cloth.jpg", "/brand/shops/cushion.jpg"],
        group: "Sets",
        groupAr: "الأطقم",
      },
    ],
    reviews: [],
  },
  {
    slug: "wildroot-plantae",
    name: "Wildroot Plantae",
    nameAr: "وايلدروت",
    area: "Khalda",
    areaAr: "خلدا",
    category: "farmers-market",
    plan: "basic",
    phone: "",
    avatar: "/brand/shops/plants.jpg",
    cover: "/brand/shops/bonsai.jpg",
    bio: "Courtyard plants, cracked pots, and olive starts.",
    bioAr: "نباتات حوش وأقاصيص مشقوقة.",
    hours: "Every day · 09:00–17:00",
    isOpen: true,
    views: 0,
    since: "February 2026",
    km: 6.2,
    mode: "inquire",
    products: [
      {
        id: "geranium",
        name: "Geranium pot",
        nameAr: "إبرة الراعي",
        price: 8,
        desc: "Already flowering.",
        descAr: "مزهرة.",
        images: ["/brand/shops/plants.jpg"],
      },
      {
        id: "olive",
        name: "Olive start",
        nameAr: "شتلة زيتون",
        price: 22,
        desc: "Wild form, small.",
        descAr: "شكل برّي، صغيرة.",
        images: ["/brand/shops/bonsai.jpg"],
      },
      {
        id: "sage",
        name: "Sage trio",
        nameAr: "ميرمية",
        price: 9,
        desc: "Kitchen three.",
        descAr: "ثلاث للمطبخ.",
        images: ["/brand/shops/plants.jpg"],
      },
    ],
  },
  {
    slug: "street-wheels",
    name: "Street Wheels",
    nameAr: "ستريت ويلز",
    area: "Marka",
    areaAr: "ماركا",
    category: "misc",
    plan: "pro",
    phone: "",
    avatar: "/brand/shops/camry.jpg",
    cover: "/brand/shops/camry.jpg",
    bio: "One car at a time. Ask on WhatsApp — we do not take deposits in the app.",
    bioAr: "سيارة واحدة كل مرة. اسأل على واتساب.",
    hours: "Sat–Thu · 10:00–18:00",
    isOpen: false,
    views: 0,
    rating: 4.2,
    reviewCount: 9,
    socials: [{ label: "Facebook", href: "https://facebook.com" }],
    since: "April 2026",
    km: 8.5,
    mode: "inquire",
    products: [
      {
        id: "camry",
        name: "Toyota Camry 2014",
        nameAr: "كامري 2014",
        price: 8500,
        desc: "Marka, inspected. Inquire for papers.",
        descAr: "ماركا، مفحوصة. الاستفسار للأوراق.",
        images: ["/brand/shops/camry.jpg"],
      },
    ],
    reviews: [],
  },
  {
    slug: "green-oasis",
    name: "Green Oasis",
    nameAr: "الواحة الخضراء",
    area: "Dabouq",
    areaAr: "دابوق",
    category: "farmers-market",
    plan: "premium",
    phone: "",
    avatar: "/brand/shops/bonsai.jpg",
    cover: "/brand/shops/plants.jpg",
    bio: "Courtyard design and olive groves in pots. Pro storefront.",
    bioAr: "تصميم أحواش وزيتون في قصص.",
    hours: "Sat–Wed · 08:00–16:00",
    isOpen: true,
    views: 0,
    followers: 120,
    waOrders: 41,
    rating: 4.6,
    reviewCount: 22,
    socials: [{ label: "Instagram", href: "https://instagram.com" }],
    delivery: { amman: "4 JOD", outside: "10 JOD" },
    keywords: ["olive", "courtyard", "dabouq"],
    since: "2024",
    km: 9.0,
    mode: "both",
    custom: {
      en: "Pot size, olive age, and which courtyard plants to mix. Ask before we plant it.",
      ar: "حجم القصيص وعمر الزيتونة ونوع نباتات الحوش. اسأل قبل ما نزرع.",
    },
    products: [
      {
        id: "grove",
        name: "Potted olive",
        nameAr: "زيتونة قصيص",
        price: 75,
        desc: "Ready for a terrace.",
        descAr: "جاهزة للسطح.",
        images: ["/brand/shops/bonsai.jpg", "/brand/shops/plants.jpg"],
        group: "Trees",
        groupAr: "أشجار",
      },
      {
        id: "mix",
        name: "Courtyard mix",
        nameAr: "خلطة حوش",
        price: 40,
        desc: "Sage, geranium, thyme.",
        descAr: "ميرمية وإبرة الراعي وزعتر.",
        images: ["/brand/shops/plants.jpg"],
        group: "Mixes",
        groupAr: "خلطات",
      },
    ],
    reviews: [],
  },
  {
    slug: "weibdeh-thread",
    name: "Weibdeh Thread",
    nameAr: "خيط اللويبدة",
    area: "Jabal Al Weibdeh",
    areaAr: "جبل اللويبدة",
    category: "clothes",
    plan: "pro",
    phone: "",
    avatar: "/brand/shops/tiraz-cloth.jpg",
    cover: "/brand/shops/hanging.jpg",
    since: "Aug 2026",
    km: 3,
    mode: "both",
    hours: "Thu–Mon · 12:00–20:00",
    isOpen: true,
    views: 0,
    rating: 4.4,
    reviewCount: 6,
    products: [
      { id: "linen-shirt", name: "Linen shirt", nameAr: "قميص كتان", price: 28, desc: "Unbleached linen.", descAr: "كتان غير مبيّض.", images: ["/brand/shops/tiraz-cloth.jpg"], group: "Adults", groupAr: "كبار" },
    ],
  },
  {
    slug: "amman-clay",
    name: "Amman Clay",
    nameAr: "صلصال عمّان",
    area: "Downtown",
    areaAr: "وسط البلد",
    category: "handicrafts",
    plan: "basic",
    phone: "",
    avatar: "/brand/shops/clay-studio.jpg",
    since: "Jul 2026",
    km: 1.4,
    mode: "inquire",
    views: 0,
    products: [
      { id: "clay-cup", name: "Coffee cup", nameAr: "فنجان قهوة", price: 8, desc: "Wheel-thrown.", descAr: "على الدولاب.", images: ["/brand/shops/mug.jpg"] },
    ],
  },
  {
    slug: "balad-bloom",
    name: "Balad Bloom",
    nameAr: "ورد البلد",
    area: "Abdoun",
    areaAr: "عبدون",
    category: "beauty",
    plan: "premium",
    phone: "",
    avatar: "/brand/shops/beauty.jpg",
    since: "Oct 2026",
    km: 4,
    mode: "both",
    hours: "Sat–Thu · 11:00–19:00",
    isOpen: true,
    views: 0,
    followers: 12,
    rating: 5,
    reviewCount: 2,
    products: [
      { id: "rose-oil", name: "Rose oil", nameAr: "زيت ورد", price: 16, desc: "Small bottle.", descAr: "قنينة صغيرة.", images: ["/brand/shops/beauty.jpg"] },
    ],
  },
  {
    slug: "paw-leather",
    name: "Paw Leather",
    nameAr: "جلد الكف",
    area: "Khalda",
    areaAr: "خلدا",
    category: "misc",
    plan: "basic",
    phone: "",
    avatar: duck,
    since: "Oct 2026",
    km: 6,
    mode: "inquire",
    products: [
      { id: "collar", name: "Leather collar", nameAr: "طوق جلد", price: 12, desc: "For a medium dog.", descAr: "لكل متوسط.", images: ["/brand/shops/tiraz-cloth.jpg"] },
    ],
  },
  ...EXTRA_SHOPS,
];

const OPENED_MONTH: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** One real timestamp per shop. Ranking reads createdAt only, never the month name. */
function openedStamp(since?: string) {
  const year = Number(since?.match(/20\d{2}/)?.[0] ?? 0);
  if (!year) return Date.UTC(2024, 0, 1);
  const month = OPENED_MONTH[since?.toLowerCase().replace(/[^a-z]/g, "").slice(0, 3) ?? ""];
  if (month == null) return Date.UTC(year, 0, 1);
  const day = year === 2026 && month === 9 ? 18 : 1;
  return Date.UTC(year, month, day);
}

for (const shop of SHOPS) {
  if (!shop.createdAt) shop.createdAt = openedStamp(shop.since);
  if (!SHOP_WHATSAPP.test(shop.phone)) shop.demo = true;
}

export function shopBySlug(slug: string) {
  return SHOPS.find((s) => s.slug === slug);
}

export function shopsByCategory(id: CategoryId) {
  if (id === "all") return SHOPS;
  return SHOPS.filter((s) => s.category === id);
}

export function formatJod(n: number) {
  return `${n.toFixed(2)} JOD`;
}

export function priceLabel(product: { price: number; priceMode?: "price" | "na" | "inquire" }, lang: "en" | "ar" = "en") {
  if (product.priceMode === "na") return lang === "ar" ? "السعر غير متاح" : "Price N/A";
  if (product.priceMode === "inquire") return lang === "ar" ? "اسأل عن السعر" : "Inquire for price";
  return formatJod(product.price);
}

export function deliveryAmount(label: string) {
  if (/discuss|quoted/i.test(label)) return null;
  const match = label.match(/[\d.]+/);
  if (!match) return null;
  const amount = Number(match[0]);
  return Number.isFinite(amount) ? amount : null;
}

export const HERO_SLIDES = [
  {
    kicker: "Why we’re different",
    kickerAr: "ليش إحنا غير",
    title: "No feed. No one selling your attention.",
    titleAr: "مو فيد. وما حدا ببيع انتباهك.",
    body: "Shops rise when people open them — not when an ad budget does.",
  },
  {
    kicker: "Why we’re different",
    kickerAr: "ليش إحنا غير",
    title: "You talk to the stall, not a checkout.",
    titleAr: "بتحكي مع الدكان، مش مع زر شراء.",
    body: "WhatsApp, from the person who made it. Direct. Human.",
  },
  {
    kicker: "Why we’re different",
    kickerAr: "ليش إحنا غير",
    title: "Amman first. Neighbors first.",
    titleAr: "عمّان أولاً. الجيران أولاً.",
    body: "A souq you walk with your phone — kitchens, crafts, plants, homes.",
  },
];
