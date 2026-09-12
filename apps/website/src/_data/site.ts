export interface SiteData {
  name: string;
  baseUrl: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultOgImage: string;
  locales: string[];
  defaultLocale: string;
}

export default {
  name: "furryhello",
  baseUrl: "https://furryhello.com",
  defaultTitle: 'furryhello - please don\'t just say "hello"',
  defaultDescription:
    "A bare \"hello\" with nothing else wastes everyone's time. Here's what to send instead.",
  defaultOgImage: "/assets/images/og-default.png",
  locales: ["en"],
  defaultLocale: "en",
} satisfies SiteData;
