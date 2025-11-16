import { XMLParser } from "fast-xml-parser";
import { renderHtml, type FeedPageDataFeed } from "./renderHtml";

interface Env {
  FEEDS_KV: KVNamespace;
  MAILGUN_API_KEY: string;
  MAILGUN_DOMAIN: string;
  MAILGUN_FROM: string;
  MAILGUN_RECIPIENT: string;
}

interface StoredFeed extends FeedPageDataFeed {}

interface FeedInput {
  title?: string;
  url?: string;
  group?: string;
  intervalMinutes?: number;
  linkPrefix?: string;
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
  emailsSent: number;
  emailsFailed: number;
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
      const result = await processFeeds(env);
      return jsonResponse(result);
    }

    const feeds = await listFeeds(env);
    return new Response(
      renderHtml({
        feeds,
        recipient: env.MAILGUN_RECIPIENT,
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
    const intervalMinutes = body.intervalMinutes !== undefined 
      ? Math.max(1, Math.floor(Number(body.intervalMinutes))) 
      : 60; // Default to 60 minutes (1 hour)
    const newFeed: StoredFeed = {
      id: crypto.randomUUID(),
      url: body.url.trim(),
      title: (body.title ?? body.url).trim(),
      group: body.group?.trim() || undefined,
      intervalMinutes: intervalMinutes > 0 ? intervalMinutes : 60,
      linkPrefix: body.linkPrefix?.trim() || undefined,
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
    if (!body.url && !body.title && body.group === undefined && body.intervalMinutes === undefined && body.linkPrefix === undefined) {
      return jsonResponse({ error: "Provide title, url, group, intervalMinutes, or linkPrefix to update" }, 400);
    }
    if (body.url) {
      feeds[index].url = body.url.trim();
    }
    if (body.title) {
      feeds[index].title = body.title.trim();
    }
    if (body.group !== undefined) {
      feeds[index].group = body.group?.trim() || undefined;
    }
    if (body.intervalMinutes !== undefined) {
      const intervalMinutes = Math.max(1, Math.floor(Number(body.intervalMinutes)));
      feeds[index].intervalMinutes = intervalMinutes > 0 ? intervalMinutes : 60;
    }
    if (body.linkPrefix !== undefined) {
      feeds[index].linkPrefix = body.linkPrefix?.trim() || undefined;
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
      emailsSent: 0,
      emailsFailed: 0,
      message: "No feeds configured.",
    };
  }

  const feedsWithItems: FeedJobItem[] = [];
  let totalNewItems = 0;
  const now = new Date();

  for (const feed of feeds) {
    // Check if enough time has passed since last run
    const intervalMinutes = feed.intervalMinutes || 60; // Default to 60 minutes
    if (feed.lastRunAt) {
      const lastRun = new Date(feed.lastRunAt);
      const minutesSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60);
      if (minutesSinceLastRun < intervalMinutes) {
        const minutesUntilNext = Math.ceil(intervalMinutes - minutesSinceLastRun);
        feed.lastRunSummary = `Skipped (next check in ${minutesUntilNext} min)`;
        continue; // Skip this feed, not enough time has passed
      }
    }

    const nowISO = now.toISOString();
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
      feed.lastRunAt = nowISO;
    }
  }

  let emailsSent = 0;
  let emailsFailed = 0;
  if (feedsWithItems.length) {
    // Group feeds by their group field (default to "default" if not set)
    const groups = new Map<string, FeedJobItem[]>();
    for (const job of feedsWithItems) {
      const groupKey = job.feed.group?.trim() || "default";
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(job);
    }

    // Send one email per group
    for (const [groupName, groupJobs] of groups.entries()) {
      try {
        await sendDigestEmail(env, groupJobs, groupName);
        emailsSent++;
        for (const job of groupJobs) {
          for (const item of job.items) {
            const uniqueKey = await hashIdentifier(`${job.feed.id}:${item.id}`);
            await env.FEEDS_KV.put(sentKey(job.feed.id, uniqueKey), "1", {
              expirationTtl: SENT_TTL_SECONDS,
            });
          }
          job.feed.lastRunSummary = `Sent ${job.items.length} new item(s)${groupName !== "default" ? ` (group: ${groupName})` : ""}`;
        }
      } catch (error) {
        emailsFailed++;
        const message =
          error instanceof Error ? error.message : "Unknown email error";
        for (const job of groupJobs) {
          job.feed.lastRunSummary = `Email failed: ${message}`;
        }
        console.error(`Failed to send Mailgun email for group "${groupName}"`, error);
      }
    }
  }

  await saveFeeds(env, feeds);

  const totalGroups = new Set(feedsWithItems.map(job => job.feed.group?.trim() || "default")).size;
  return {
    feedsChecked: feeds.length,
    feedsWithNewItems: feedsWithItems.length,
    totalNewItems,
    emailsSent,
    emailsFailed,
    message: emailsSent > 0
      ? `Sent ${emailsSent} email(s) for ${totalGroups} group(s).`
      : emailsFailed > 0
      ? `Failed to send ${emailsFailed} email(s).`
      : "No email required (no new items).",
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
  return parseFeed(text, url);
}

function parseFeed(xml: string, fallbackUrl: string): ParsedItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    allowBooleanAttributes: true,
  });

  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch (error) {
    throw new Error(
      `Invalid RSS/Atom feed: ${error instanceof Error ? error.message : "parse failure"}`,
    );
  }

  const items: ParsedItem[] = [];
  const rssItems = toArray(doc?.rss?.channel?.item);
  const atomEntries = toArray(doc?.feed?.entry);

  for (const item of rssItems) {
    const id = item?.guid?.["#text"] ?? item?.guid ?? item?.link ?? item?.title;
    items.push({
      id: id ?? crypto.randomUUID(),
      title: item?.title ?? "Untitled item",
      link: item?.link ?? fallbackUrl,
      summary: item?.description ?? undefined,
      published: item?.pubDate ?? undefined,
    });
  }

  for (const entry of atomEntries) {
    const link = Array.isArray(entry?.link)
      ? entry.link.find((l: any) => l.rel === "alternate")?.href ??
        entry.link[0]?.href
      : entry?.link?.href ?? entry?.link;
    const id = entry?.id ?? link ?? entry?.title;
    items.push({
      id: id ?? crypto.randomUUID(),
      title: entry?.title ?? "Untitled entry",
      link: link ?? fallbackUrl,
      summary: entry?.summary ?? entry?.content ?? undefined,
      published: entry?.updated ?? entry?.published ?? undefined,
    });
  }

  return items;
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

async function sendDigestEmail(env: Env, jobs: FeedJobItem[], groupName?: string) {
  if (!env.MAILGUN_API_KEY) {
    throw new Error("MAILGUN_API_KEY missing");
  }
  if (!env.MAILGUN_DOMAIN) {
    throw new Error("MAILGUN_DOMAIN missing");
  }

  // Determine display name: use group name if set and not "default", otherwise use feed name
  const displayName = groupName && groupName !== "default" 
    ? groupName 
    : (jobs.length === 1 ? jobs[0].feed.title : "RSS Feed");
  
  const subject = displayName;
  
  const htmlParts: string[] = [
    `<h2>${escapeHtml(displayName)}</h2>`,
  ];

  const textParts: string[] = [`${displayName}\n`];

  for (const job of jobs) {
    const prefix = job.feed.linkPrefix || "";
    const applyPrefix = (url: string) => prefix ? prefix + url : url;
    
    htmlParts.push(
      `<h3>${escapeHtml(job.feed.title)}</h3><ul>${job.items
        .map(
          (item) => {
            const prefixedLink = applyPrefix(item.link);
            return `<li><a href="${escapeHtml(prefixedLink)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>${
              item.published ? ` <em>${escapeHtml(item.published)}</em>` : ""
            }${item.summary ? `<p>${escapeHtml(truncate(item.summary, 180))}</p>` : ""}</li>`;
          }
        )
        .join("")}</ul>`,
    );

    textParts.push(
      `\n${job.feed.title}\n${job.items
        .map((item) => {
          const prefixedLink = applyPrefix(item.link);
          return `- ${item.title} (${prefixedLink})`;
        })
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
