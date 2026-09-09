export interface EnvironmentTheme {
  primary: string;
  primaryLight: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
}

export interface EnvironmentSEO {
  title: string;
  description: string;
  keywords: string[];
}

export interface EnvironmentConfig {
  slug: string;
  name: string;
  displayName: string;
  tagline: string;
  description: string;
  icon: string;
  departmentSource: string;
  ctaLabel: string;
  heroHeadline?: string;
  theme: EnvironmentTheme;
  seo: EnvironmentSEO;
}

export const ENVIRONMENT_CONFIGS: EnvironmentConfig[] = [
  {
    slug: "pawmart",
    name: "PawMart",
    displayName: "PawMart",
    tagline: "Premium Pet Care",
    heroHeadline: "Everything your pet deserves",
    description:
      "Food, grooming, toys and accessories — handpicked for pet lovers in Qatar. Order on WhatsApp in seconds.",
    icon: "🐾",
    departmentSource: "Pet Products",
    ctaLabel: "Explore PawMart",
    theme: {
      primary: "#1b4332",
      primaryLight: "#2d6a4f",
      secondary: "#d4a373",
      accent: "#40916c",
      background: "#fafcf9",
      surface: "#ffffff",
    },
    seo: {
      title: "PawMart Pet Shop Catalogue Qatar | TFRC",
      description:
        "Shop pet food, accessories, grooming and care products in Qatar from TFRC PawMart. Browse by category and order on WhatsApp.",
      keywords: [
        "pawmart qatar",
        "pet shop qatar",
        "pet food qatar",
        "pet accessories qatar",
        "tfrc pawmart",
        "whatsapp pet order qatar",
      ],
    },
  },
  {
    slug: "hardware",
    name: "Pro Tools",
    displayName: "Pro Tools",
    tagline: "Built for the Job",
    heroHeadline: "Professional tools & equipment",
    description:
      "Power tools, hand tools, kits and workshop gear — trusted quality for every project across Qatar.",
    icon: "🔧",
    departmentSource: "Multi Tools",
    ctaLabel: "Explore Pro Tools",
    theme: {
      primary: "#0f172a",
      primaryLight: "#1e293b",
      secondary: "#d97706",
      accent: "#f59e0b",
      background: "#f8fafc",
      surface: "#ffffff",
    },
    seo: {
      title: "Pro Tools & Hardware Catalogue Qatar | TFRC",
      description:
        "Browse professional tools, kits and hardware in Qatar from TFRC. Shop by category and order on WhatsApp with product details included.",
      keywords: [
        "tools qatar",
        "hardware qatar",
        "power tools qatar",
        "wokin tools qatar",
        "tfrc tools",
        "whatsapp tools order",
      ],
    },
  },
  {
    slug: "household",
    name: "Kitchen & Home",
    displayName: "Kitchen & Home",
    tagline: "Elevate Your Space",
    heroHeadline: "Kitchen & home essentials",
    description:
      "Tableware, kitchen accessories, décor and living essentials — curated for beautiful everyday living in Qatar.",
    icon: "✦",
    departmentSource: "Households",
    ctaLabel: "Explore Kitchen & Home",
    theme: {
      primary: "#7c2d12",
      primaryLight: "#9a3412",
      secondary: "#ca8a04",
      accent: "#d97706",
      background: "#fffdfb",
      surface: "#ffffff",
    },
    seo: {
      title: "Kitchen & Home Catalogue Qatar | TFRC",
      description:
        "Discover kitchenware, home accessories and living essentials in Qatar from TFRC. Browse categories and order on WhatsApp.",
      keywords: [
        "kitchen qatar",
        "home accessories qatar",
        "household qatar",
        "tfrc kitchen",
        "whatsapp home order qatar",
      ],
    },
  },
];

export function getEnvironmentConfig(slug: string): EnvironmentConfig | undefined {
  return ENVIRONMENT_CONFIGS.find((e) => e.slug === slug);
}

export function getDepartmentForSlug(slug: string): string | undefined {
  return getEnvironmentConfig(slug)?.departmentSource;
}

export const PLATFORM = {
  name: "TFRC",
  tagline: "Vita Nova",
  fullName: "TFRC Vita Nova",
  description:
    "TFRC Vita Nova catalogues for Qatar — pets, kitchen & home, and professional tools. Browse by category and order on WhatsApp.",
  seo: {
    title: "TFRC Vita Nova | Online Catalogues Qatar — Pets, Home, Tools",
    description:
      "TFRC Vita Nova online catalogues in Qatar: PawMart pets, Kitchen & Home, and Pro Tools. Browse categories, compare products, and order on WhatsApp.",
    keywords: [
      "tfrc",
      "tfrc qatar",
      "tfrc vita nova",
      "online catalogue qatar",
      "whatsapp shopping qatar",
      "pet products qatar",
      "kitchen home qatar",
      "tools hardware qatar",
      "pawmart qatar",
    ],
  },
} as const;
