import { renderHtml, type FeedPageDataFeed } from "./renderHtml";

interface Env {
  FEEDS_KV: KVNamespace;
  MAILGUN_API_KEY: string;
  MAILGUN_DOMAIN: string;
  MAILGUN_FROM: string;
  MAILGUN_RECIPIENT: string;
  MANAGEMENT_API_KEY?: string;
}

interface StoredFeed extends FeedPageDataFeed {}

interface FeedInput {
  title?: string;
  url?: string;
}

interface FeedJobItem {
  feed: StoredFeed;
  items: ParsedItem[];
}

interface ParsedItem {
  id: string;
  title: string;
  link: string;
  summary?: string;
  published?: string;
}

interface JobResult {
  feedsChecked: number;
  feedsWithNewItems: number;
  totalNewItems: number;
  emailSent: boolean;
  message: string;
}

const FEEDS_KEY = "feeds:list";
const SENT_PREFIX = "sent:";
const SENT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = normalizePath(url.pathname);

    if (request.method === "OPTIONS") {
      return buildCorsResponse();
    }

    if (pathname.startsWith("/api/feeds")) {
      return handleFeedApi(request, env, pathname);
    }

    if (pathname === "/api/run" && request.method === "POST") {
      await ensureAuthorized(request, env);
      const result = await processFeeds(env);
      return jsonResponse(result);
    }

    const feeds = await listFeeds(env);
    return new Response(
      renderHtml({
        feeds,
        recipient: env.MAILGUN_RECIPIENT,
        requiresAdminKey: Boolean(env.MANAGEMENT_API_KEY),
      }),
      {
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      },
    );
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(processFeeds(env));
  },
} satisfies ExportedHandler<Env>;

async function handleFeedApi(request: Request, env: Env, pathname: string) {
  const method = request.method.toUpperCase();

  if (method !== "GET") {
    await ensureAuthorized(request, env);
  }

  if (method === "GET" && pathname === "/api/feeds") {
    const feeds = await listFeeds(env);
    return jsonResponse({ feeds });
  }

  if (method === "POST" && pathname === "/api/feeds") {
    const body = (await readJson<FeedInput>(request)) ?? {};
    if (!body.url) {
      return jsonResponse({ error: "url is required" }, 400);
    }
    const feeds = await listFeeds(env);
    const newFeed: StoredFeed = {
      id: crypto.randomUUID(),
      url: body.url.trim(),
      title: (body.title ?? body.url).trim(),
      createdAt: new Date().toISOString(),
    };
    feeds.push(newFeed);
    await saveFeeds(env, feeds);
    return jsonResponse({ feed: newFeed }, 201);
  }

  const feedId = pathname.replace("/api/feeds/", "");
  if (!feedId) {
    return jsonResponse({ error: "Feed ID missing" }, 400);
  }

  const feeds = await listFeeds(env);
  const index = feeds.findIndex((feed) => feed.id === feedId);
  if (index === -1) {
    return jsonResponse({ error: "Feed not found" }, 404);
  }

  if (method === "PUT") {
    const body = (await readJson<FeedInput>(request)) ?? {};
    if (!body.url && !body.title) {
      return jsonResponse({ error: "Provide title or url to update" }, 400);
    }
    if (body.url) {
      feeds[index].url = body.url.trim();
    }
    if (body.title) {
      feeds[index].title = body.title.trim();
    }
    feeds[index].updatedAt = new Date().toISOString();
    await saveFeeds(env, feeds);
    return jsonResponse({ feed: feeds[index] });
  }

  if (method === "DELETE") {
    const [removed] = feeds.splice(index, 1);
    await saveFeeds(env, feeds);
    return jsonResponse({ deleted: removed?.id ?? null });
  }

  return jsonResponse({ error: "Method Not Allowed" }, 405);
}

async function processFeeds(env: Env): Promise<JobResult> {
  const feeds = await listFeeds(env);
  if (!feeds.length) {
    return {
      feedsChecked: 0,
      feedsWithNewItems: 0,
      totalNewItems: 0,
      emailSent: false,
      message: "No feeds configured.",
    };
  }

  const feedsWithItems: FeedJobItem[] = [];
  let totalNewItems = 0;

  for (const feed of feeds) {
    const now = new Date().toISOString();
    try {
      const items = await fetchFeedItems(feed.url);
      const newItems: ParsedItem[] = [];
      for (const item of items) {
        const uniqueKey = await hashIdentifier(`${feed.id}:${item.id}`);
        if (await env.FEEDS_KV.get(sentKey(feed.id, uniqueKey))) {
          continue;
        }
        newItems.push(item);
      }

      if (newItems.length) {
        feedsWithItems.push({ feed, items: newItems });
        totalNewItems += newItems.length;
        feed.lastRunSummary = `Queued ${newItems.length} new item(s)`;
      } else {
        feed.lastRunSummary = "No new items";
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown RSS error";
      feed.lastRunSummary = `Failed: ${message}`;
      console.error(`Failed to fetch ${feed.url}`, error);
    } finally {
      feed.lastRunAt = now;
    }
  }

  let emailSent = false;
  if (feedsWithItems.length) {
    try {
      await sendDigestEmail(env, feedsWithItems);
      emailSent = true;
      for (const job of feedsWithItems) {
        for (const item of job.items) {
          const uniqueKey = await hashIdentifier(`${job.feed.id}:${item.id}`);
          await env.FEEDS_KV.put(sentKey(job.feed.id, uniqueKey), "1", {
            expirationTtl: SENT_TTL_SECONDS,
          });
        }
        job.feed.lastRunSummary = `Sent ${job.items.length} new item(s)`;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown email error";
      for (const job of feedsWithItems) {
        job.feed.lastRunSummary = `Email failed: ${message}`;
      }
      console.error("Failed to send Mailgun email", error);
    }
  }

  await saveFeeds(env, feeds);

  return {
    feedsChecked: feeds.length,
    feedsWithNewItems: feedsWithItems.length,
    totalNewItems,
    emailSent,
    message: emailSent
      ? "Digest email sent."
      : "No email required (no new items or send failed).",
  };
}

async function fetchFeedItems(url: string): Promise<ParsedItem[]> {
  const response = await fetch(url, {
    headers: {
      Accept:
        "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status})`);
  }
  const text = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "application/xml");

  if (doc.querySelector("parsererror")) {
    throw new Error("Invalid RSS/Atom feed");
  }

  const items: ParsedItem[] = [];
  const rssItems = [...doc.querySelectorAll("item")];
  const atomEntries = [...doc.querySelectorAll("entry")];

  for (const node of rssItems) {
    items.push({
      id:
        getText(node, "guid") ??
        getText(node, "link") ??
        getText(node, "title") ??
        crypto.randomUUID(),
      title: getText(node, "title") ?? "Untitled item",
      link: getText(node, "link") ?? url,
      summary: getText(node, "description") ?? undefined,
      published: getText(node, "pubDate") ?? undefined,
    });
  }

  for (const node of atomEntries) {
    const link =
      node.querySelector("link")?.getAttribute("href") ??
      getText(node, "id") ??
      url;
    items.push({
      id: getText(node, "id") ?? link ?? crypto.randomUUID(),
      title: getText(node, "title") ?? "Untitled entry",
      link: link ?? url,
      summary: getText(node, "summary") ?? undefined,
      published: getText(node, "updated") ?? getText(node, "published") ?? undefined,
    });
  }

  return items;
}

async function sendDigestEmail(env: Env, jobs: FeedJobItem[]) {
  if (!env.MAILGUN_API_KEY) {
    throw new Error("MAILGUN_API_KEY missing");
  }
  if (!env.MAILGUN_DOMAIN) {
    throw new Error("MAILGUN_DOMAIN missing");
  }

  const subject = `RSS update: ${jobs.reduce(
    (sum, job) => sum + job.items.length,
    0,
  )} new item(s)`;

  const htmlParts: string[] = [
    `<h2>RSS Digest (${new Date().toLocaleString("en-US", {
      timeZone: "UTC",
    })} UTC)</h2>`,
  ];

  const textParts: string[] = [`RSS Digest\n`];

  for (const job of jobs) {
    htmlParts.push(
      `<h3>${escapeHtml(job.feed.title)}</h3><ul>${job.items
        .map(
          (item) =>
            `<li><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>${
              item.published ? ` <em>${escapeHtml(item.published)}</em>` : ""
            }${item.summary ? `<p>${escapeHtml(truncate(item.summary, 180))}</p>` : ""}</li>`,
        )
        .join("")}</ul>`,
    );

    textParts.push(
      `\n${job.feed.title}\n${job.items
        .map((item) => `- ${item.title} (${item.link})`)
        .join("\n")}`,
    );
  }

  const params = new URLSearchParams();
  params.append("from", env.MAILGUN_FROM);
  params.append("to", env.MAILGUN_RECIPIENT);
  params.append("subject", subject);
  params.append("text", textParts.join("\n"));
  params.append("html", htmlParts.join("\n"));

  const response = await fetch(
    `https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`api:${env.MAILGUN_API_KEY}`)}`,
      },
      body: params,
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mailgun error (${response.status}): ${body}`);
  }
}

async function listFeeds(env: Env): Promise<StoredFeed[]> {
  const data = await env.FEEDS_KV.get(FEEDS_KEY, "json");
  if (!Array.isArray(data)) {
    return [];
  }
  return data as StoredFeed[];
}

async function saveFeeds(env: Env, feeds: StoredFeed[]) {
  await env.FEEDS_KV.put(FEEDS_KEY, JSON.stringify(feeds));
}

async function ensureAuthorized(request: Request, env: Env) {
  const expectedKey = env.MANAGEMENT_API_KEY;
  if (!expectedKey) {
    return;
  }

  const provided =
    request.headers.get("x-admin-key") ?? extractBearerToken(request);

  if (!provided || provided !== expectedKey) {
    throw new Response("Unauthorized", {
      status: 401,
      headers: {
        "content-type": "text/plain",
      },
    });
  }
}

function extractBearerToken(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() === "bearer") {
    return token.trim();
  }
  if (scheme.toLowerCase() === "basic") {
    const decoded = atob(token);
    return decoded.split(":")[1];
  }
  return null;
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function normalizePath(pathname: string) {
  if (pathname === "/") {
    return pathname;
  }
  return pathname.replace(/\/+$/, "");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
}

function sentKey(feedId: string, hash: string) {
  return `${SENT_PREFIX}${feedId}:${hash}`;
}

async function hashIdentifier(input: string) {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getText(node: Element, selector: string) {
  return node.querySelector(selector)?.textContent?.trim() ?? null;
}

function truncate(text: string, length: number) {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildCorsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type,authorization,x-admin-key",
    },
  });
}
