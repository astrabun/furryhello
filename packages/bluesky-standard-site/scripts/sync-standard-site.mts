/**
 * Publishes/updates site.standard.publication and site.standard.document
 * records on the account's PDS so link embeds (e.g. on Bluesky) render
 * the rich "publication" card instead of a plain OpenGraph card.
 * See https://standard.site/docs for the lexicons.
 *
 * Both collections require a real TID as the record key (timestamp-based,
 * PDS-assigned - see https://atproto.com/specs/tid), so it can't be derived
 * from a page's path the way a plain identifier could. Instead, on each run
 * we list existing records, match them back to pages/the publication by
 * their `path`/`url` field, and only createRecord (letting the PDS assign a
 * fresh TID) for ones we haven't seen before - everything else is a
 * putRecord against the TID we already have. The resulting path -> AT-URI
 * map is written to apps/website/src/_data/standard_site_documents.json
 * (and the publication URI to standard_site.json), both committed to git,
 * so the 11ty build can emit the right <link> tags without a network call.
 *
 * Credentials (put in .env locally, or repo secrets in CI):
 *   BSKY_HANDLE=handle-here.bsky.social
 *   BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx   (generate at bsky.app/settings/app-passwords)
 *
 * Usage:
 *   pnpm --filter @furryhello/bluesky-standard-site sync:standard-site
 */

import { AtpAgent } from "@atproto/api";
import matter from "gray-matter";
import { config as dotenvxconfig } from "@dotenvx/dotenvx";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { glob } from "node:fs/promises";
import path from "node:path";

dotenvxconfig({ quiet: true });

const HANDLE = process.env.BSKY_HANDLE;
const APP_PASSWORD = process.env.BSKY_APP_PASSWORD;

if (!HANDLE || !APP_PASSWORD) {
  console.error("Missing credentials. Set BSKY_HANDLE and BSKY_APP_PASSWORD in .env.");
  process.exit(1);
}

const SITE_URL = "https://furryhello.com";
const SITE_NAME = "furryhello";
const SITE_DESCRIPTION = "please don't just say hello - give them something to actually respond to";

// This package lives at packages/bluesky-standard-site; the website app is
// a sibling under apps/website.
const WEBSITE_DIR = path.join(process.cwd(), "..", "..", "apps", "website");
const CONTENT_DIR = path.join(WEBSITE_DIR, "src", "content");
const ICON_PATH = path.join(WEBSITE_DIR, "src", "assets", "images", "furryhello_t.png");
const ICON_MIME_TYPE = "image/png";

const DATA_DIR = path.join(WEBSITE_DIR, "src", "_data");
const PUBLICATION_DATA_PATH = path.join(DATA_DIR, "standard_site.json");
const DOCUMENTS_DATA_PATH = path.join(DATA_DIR, "standard_site_documents.json");
const WELL_KNOWN_PATH = path.join(DATA_DIR, "standard_site_publication.at-uri.txt");

interface ExistingRecord {
  uri: string;
  value: Record<string, any>;
}

async function listAllRecords(
  agent: AtpAgent,
  did: string,
  collection: string,
): Promise<ExistingRecord[]> {
  const records: ExistingRecord[] = [];
  let cursor: string | undefined;
  do {
    const { data } = await agent.com.atproto.repo.listRecords({
      repo: did,
      collection,
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    records.push(
      ...data.records.map((r) => ({ uri: r.uri, value: r.value as Record<string, any> })),
    );
    ({ cursor } = data);
  } while (cursor);
  return records;
}

function rkeyFromUri(uri: string): string {
  return uri.split("/").pop()!;
}

// https://atproto.com/specs/tid
const TID_RE = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/;

// Blobs are content-addressed on the PDS, so re-uploading identical bytes
// doesn't create a duplicate - but it's still a wasted round-trip on every
// run. We stash a sha256 of the icon alongside it and skip the upload when
// the local file hasn't changed.
async function resolveIcon(
  agent: AtpAgent,
  existingPublication: ExistingRecord | undefined,
  iconBytes: Buffer,
): Promise<{ icon: unknown; iconSha256: string }> {
  const iconSha256 = createHash("sha256").update(iconBytes).digest("hex");
  const existingValue = existingPublication?.value;

  if (existingValue?.iconSha256 === iconSha256 && existingValue.icon) {
    console.log("Icon unchanged, skipping upload.");
    return { icon: existingValue.icon, iconSha256 };
  }

  const { data: iconUpload } = await agent.uploadBlob(iconBytes, { encoding: ICON_MIME_TYPE });
  console.log("Icon changed (or new), uploaded blob.");
  return { icon: iconUpload.blob, iconSha256 };
}

async function upsertRecord(
  agent: AtpAgent,
  options: {
    did: string;
    collection: string;
    existing: ExistingRecord | undefined;
    record: Record<string, any>;
  },
): Promise<string> {
  const { did, collection, existing, record } = options;
  if (existing && TID_RE.test(rkeyFromUri(existing.uri))) {
    await agent.com.atproto.repo.putRecord({
      repo: did,
      collection,
      rkey: rkeyFromUri(existing.uri),
      record,
    });
    return existing.uri;
  }
  if (existing) {
    // Leftover record from before rkeys were real TIDs - the lexicon
    // requires a TID rkey, so we can't just putRecord over it. Replace it.
    console.log(`  ↺ replacing malformed rkey ${rkeyFromUri(existing.uri)} in ${collection}`);
    await agent.com.atproto.repo.deleteRecord({
      repo: did,
      collection,
      rkey: rkeyFromUri(existing.uri),
    });
  }
  const res = await agent.com.atproto.repo.createRecord({ repo: did, collection, record });
  return res.data.uri;
}

interface DocumentInput {
  urlPath: string;
  title: string;
  description: string | undefined;
  publishedAt: string;
  tags: string[] | undefined;
}

// Every page under src/content/**/*.{md,njk} with `permalink` +
// `publishedAt` front matter is a "document" - this naturally picks up new
// locale pages as i18n grows, and also covers non-Markdown pages like the
// "/" redirect stub (Bluesky's unfurler needs a record whose `path` exactly
// matches whatever URL was shared, so "/" needs its own record even though
// it just redirects to "/en/").
async function collectDocuments(): Promise<{ documents: DocumentInput[]; skipped: number }> {
  const documents: DocumentInput[] = [];
  let skipped = 0;

  for await (const entry of glob("**/*.{md,njk}", { cwd: CONTENT_DIR })) {
    const raw = readFileSync(path.join(CONTENT_DIR, entry), "utf8");
    const data = matter(raw).data as Record<string, any>;

    if (data.draft) {
      skipped++;
      continue;
    }
    if (!data.permalink || !data.publishedAt) {
      console.warn(
        `  ! skipping ${entry}: needs both \`permalink\` and \`publishedAt\` front matter`,
      );
      skipped++;
      continue;
    }

    documents.push({
      urlPath: data.permalink,
      title: data.title,
      description: data.description,
      publishedAt: new Date(data.publishedAt).toISOString(),
      tags: Array.isArray(data.tags) && data.tags.length > 0 ? data.tags : undefined,
    });
  }

  return { documents, skipped };
}

async function main() {
  const agent = new AtpAgent({ service: "https://bsky.social" });
  await agent.login({ identifier: HANDLE!, password: APP_PASSWORD! });
  const { did } = agent.session!;

  const existingPublications = await listAllRecords(agent, did, "site.standard.publication");
  const [existingPublication] = existingPublications;
  // A malformed-rkey record is about to be deleted+recreated by
  // upsertRecord, which would orphan any blob it's the only reference to -
  // don't reuse its icon blob ref in that case, only in the steady state.
  const reusablePublication =
    existingPublication && TID_RE.test(rkeyFromUri(existingPublication.uri))
      ? existingPublication
      : undefined;

  const iconBytes = readFileSync(ICON_PATH);
  const { icon, iconSha256 } = await resolveIcon(agent, reusablePublication, iconBytes);

  const publicationUri = await upsertRecord(agent, {
    did,
    collection: "site.standard.publication",
    existing: existingPublication,
    record: {
      $type: "site.standard.publication",
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      icon,
      iconSha256,
      preferences: { showInDiscover: false },
    },
  });
  console.log(`Publication: ${publicationUri}`);

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(
    PUBLICATION_DATA_PATH,
    `${JSON.stringify({ did, publication_uri: publicationUri }, undefined, "\t")}\n`,
  );
  writeFileSync(WELL_KNOWN_PATH, `${publicationUri}\n`);

  const existingDocuments = await listAllRecords(agent, did, "site.standard.document");
  const existingByPath = new Map(existingDocuments.map((r) => [r.value.path as string, r]));

  const { documents, skipped } = await collectDocuments();

  const documentUris: Record<string, string> = {};
  let synced = 0;

  for (const input of documents) {
    const record: Record<string, any> = {
      $type: "site.standard.document",
      site: publicationUri,
      title: input.title,
      path: input.urlPath,
      publishedAt: input.publishedAt,
    };
    if (input.description) {
      record.description = input.description;
    }
    if (input.tags && input.tags.length > 0) {
      record.tags = input.tags;
    }

    const uri = await upsertRecord(agent, {
      did,
      collection: "site.standard.document",
      existing: existingByPath.get(input.urlPath),
      record,
    });
    documentUris[input.urlPath] = uri;
    console.log(`  ✓ ${input.urlPath}`);
    synced++;
  }

  writeFileSync(DOCUMENTS_DATA_PATH, `${JSON.stringify(documentUris, undefined, "\t")}\n`);

  // Prune document records that no longer match any current page's path -
  // e.g. a stale record left behind after a permalink change, or a page
  // that was removed/drafted since the last sync.
  const keptUris = new Set(Object.values(documentUris));
  let pruned = 0;
  for (const existing of existingDocuments) {
    if (!keptUris.has(existing.uri)) {
      console.log(`  ✗ pruning orphaned document ${existing.value.path ?? existing.uri}`);
      await agent.com.atproto.repo.deleteRecord({
        repo: did,
        collection: "site.standard.document",
        rkey: rkeyFromUri(existing.uri),
      });
      pruned++;
    }
  }

  console.log(`\nDone: ${synced} synced, ${skipped} skipped, ${pruned} pruned`);
}

main().catch((error: unknown) => {
  console.error("Sync failed:", error);
  process.exit(1);
});
