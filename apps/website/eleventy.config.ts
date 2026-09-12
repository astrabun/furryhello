// @ts-expect-error -- @11ty/eleventy ships no type declarations for this entry point
import { EleventyI18nPlugin } from "@11ty/eleventy";
import MarkdownIt from "markdown-it";
import site from "./src/_data/site.ts";
import getAnalytics from "./src/_data/analytics.ts";

// eleventyConfig is untyped upstream (no published .d.ts for UserConfig)
export default function (eleventyConfig: any) {
  // Eleventy's _data directory loader does not resolve .ts files, so these
  // are imported directly here (this config file already runs as TS) and
  // exposed as global data under the same names the templates expect.
  eleventyConfig.addGlobalData("site", site);
  eleventyConfig.addGlobalData("analytics", getAnalytics);

  eleventyConfig.addPassthroughCopy({ "src/assets/images": "assets/images" });

  // Exposes the site.standard.publication AT-URI at a well-known path, per
  // https://standard.site/docs/verification, alongside the <link> tags in
  // base.njk that read the same data (standard_site.json / _documents.json
  // are plain JSON and load automatically as Eleventy global data).
  eleventyConfig.addPassthroughCopy({
    "src/_data/standard_site_publication.at-uri.txt": ".well-known/site.standard.publication",
  });

  // Markdown links to another host open in a new tab; links back to this
  // site (or relative links) stay in the same tab.
  const siteHost = new URL(site.baseUrl).host;
  const md = new MarkdownIt({ html: true });
  const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token?.attrGet("href");
    const isExternal =
      href !== null &&
      href !== undefined &&
      /^[a-z]+:\/\//i.test(href) &&
      new URL(href).host !== siteHost;

    if (token && isExternal) {
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noopener noreferrer");
    }

    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  eleventyConfig.setLibrary("md", md);

  eleventyConfig.addPlugin(EleventyI18nPlugin, {
    defaultLanguage: "en",
  });

  eleventyConfig.addPairedShortcode("chat", function (content: string) {
    return `<div class="chat mx-auto my-8 max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div class="flex flex-col gap-3 p-4">${content}</div>
    </div>`;
  });

  eleventyConfig.addPairedShortcode("message", function (content: string, from?: string) {
    const isYou = from === "you";
    return `<div class="flex ${isYou ? "justify-end" : "justify-start"}">
        <div class="max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
          isYou
            ? "bg-blue-600 text-white"
            : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
        }">${content}</div>
      </div>`;
  });

  return {
    dir: {
      input: "src/content",
      output: "_site",
      layouts: "../layouts",
      includes: "../_includes",
      data: "../_data",
    },
  };
}
