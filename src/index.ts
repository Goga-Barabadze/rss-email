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
  isScrapedFeed?: boolean;
  titleSelector?: string;
  linkSelector?: string;
  descriptionSelector?: string;
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
      isScrapedFeed: body.isScrapedFeed || false,
      titleSelector: body.titleSelector?.trim() || undefined,
      linkSelector: body.linkSelector?.trim() || undefined,
      descriptionSelector: body.descriptionSelector?.trim() || undefined,
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
    if (!body.url && !body.title && body.group === undefined && body.intervalMinutes === undefined && body.linkPrefix === undefined && body.isScrapedFeed === undefined && body.titleSelector === undefined && body.linkSelector === undefined && body.descriptionSelector === undefined) {
      return jsonResponse({ error: "Provide at least one field to update" }, 400);
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
    if (body.isScrapedFeed !== undefined) {
      feeds[index].isScrapedFeed = body.isScrapedFeed;
    }
    if (body.titleSelector !== undefined) {
      feeds[index].titleSelector = body.titleSelector?.trim() || undefined;
    }
    if (body.linkSelector !== undefined) {
      feeds[index].linkSelector = body.linkSelector?.trim() || undefined;
    }
    if (body.descriptionSelector !== undefined) {
      feeds[index].descriptionSelector = body.descriptionSelector?.trim() || undefined;
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
      const items = feed.isScrapedFeed 
        ? await scrapeFeedItems(feed)
        : await fetchFeedItems(feed.url);
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

async function scrapeFeedItems(feed: StoredFeed): Promise<ParsedItem[]> {
  if (!feed.titleSelector || !feed.linkSelector) {
    throw new Error("Title and link selectors are required for scraped feeds");
  }

  const response = await fetch(feed.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; RSS-Email-Worker/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status})`);
  }

  const baseUrl = new URL(feed.url);
  const items: ParsedItem[] = [];
  
  // Collect elements using HTMLRewriter
  const titleElements: Array<{ text: string; order: number }> = [];
  const linkElements: Array<{ href: string; order: number }> = [];
  const descElements: Array<{ text: string; order: number }> = [];
  
  let titleOrder = 0;
  let linkOrder = 0;
  let descOrder = 0;

  // Use HTMLRewriter to extract content
  const titleTexts: string[] = [];
  const descTexts: string[] = [];
  let currentTitleIdx = -1;
  let currentDescIdx = -1;
  
  const rewriter = new HTMLRewriter()
    .on(feed.titleSelector, {
      element() {
        currentTitleIdx = titleTexts.length;
        titleTexts.push("");
      },
      text(text) {
        if (currentTitleIdx >= 0) {
          titleTexts[currentTitleIdx] += text.text;
        }
      },
    })
    .on(feed.linkSelector, {
      element(element) {
        const href = element.getAttribute("href");
        if (href) {
          const absoluteUrl = href.startsWith("http") ? href : new URL(href, baseUrl).toString();
          linkElements.push({ href: absoluteUrl, order: linkOrder++ });
        }
      },
    });

  if (feed.descriptionSelector) {
    rewriter.on(feed.descriptionSelector, {
      element() {
        currentDescIdx = descTexts.length;
        descTexts.push("");
      },
      text(text) {
        if (currentDescIdx >= 0) {
          descTexts[currentDescIdx] += text.text;
        }
      },
    });
  }

  // Process the HTML stream
  await rewriter.transform(response).arrayBuffer();

  // Convert title texts to elements with order
  titleTexts.forEach((text, idx) => {
    if (text.trim()) {
      titleElements.push({ text: text.trim(), order: idx });
    }
  });

  // Convert desc texts to elements with order
  descTexts.forEach((text, idx) => {
    if (text.trim()) {
      descElements.push({ text: text.trim(), order: idx });
    }
  });

  // Match items by order (assuming they appear in the same sequence)
  const maxItems = Math.max(titleElements.length, linkElements.length);
  for (let i = 0; i < maxItems; i++) {
    const titleEl = titleElements[i];
    const linkEl = linkElements[i];
    const descEl = descElements[i];

    if (titleEl && linkEl) {
      const title = stripHtml(titleEl.text).trim();
      const link = linkEl.href;
      const description = descEl ? stripHtml(descEl.text).trim() : undefined;

      if (title && link) {
        items.push({
          id: `${feed.id}:${i}:${await hashIdentifier(link)}`,
          title,
          link,
          summary: description,
          published: undefined,
        });
      }
    }
  }

  if (items.length === 0) {
    throw new Error("No items found with the provided selectors");
  }

  return items;
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
    `<div style="font-size: 1.2em; line-height: 1.6;">
      <h2 style="font-size: 1.8em; margin-bottom: 1rem;">${escapeHtml(displayName)}</h2>`,
  ];

  const textParts: string[] = [`${displayName}\n`];

  for (const job of jobs) {
    const prefix = job.feed.linkPrefix || "";
    const applyPrefix = (url: string) => prefix ? prefix + url : url;
    
    htmlParts.push(
      `<h3 style="font-size: 1.5em; margin-top: 1.5rem; margin-bottom: 0.75rem;">${escapeHtml(job.feed.title)}</h3>${job.items
        .map(
          (item) => {
            const prefixedLink = applyPrefix(item.link);
            const formattedDate = formatDateForEmail(item.published);
            const cleanSummary = item.summary ? stripHtml(item.summary) : "";
            return `<div style="margin-bottom: 1.2rem;">
              <a href="${escapeHtml(prefixedLink)}" target="_blank" rel="noopener" style="font-weight: 600; text-decoration: none; color: #2563eb; font-size: 1.1em;">${escapeHtml(item.title)}</a>${
              formattedDate ? ` <span style="color: #6b7280; font-size: 1.08em;">${escapeHtml(formattedDate)}</span>` : ""
            }${cleanSummary ? `<p style="margin-top: 0.5rem; color: #4b5563; font-size: 1.14em;">${escapeHtml(cleanSummary)}</p>` : ""}
            </div>`;
          }
        )
        .join("")}`,
    );

    textParts.push(
      `\n${job.feed.title}\n${job.items
        .map((item) => {
          const prefixedLink = applyPrefix(item.link);
          const formattedDate = formatDateForEmail(item.published);
          return `${item.title}${formattedDate ? ` (${formattedDate})` : ""} - ${prefixedLink}`;
        })
        .join("\n")}`,
    );
  }

  htmlParts.push("</div>");

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

function formatDateForEmail(dateString?: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const day = date.getDate();
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${day}.${month}. at ${hours}:${minutes}`;
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  // Remove HTML tags and decode HTML entities
  return html
    .replace(/<[^>]*>/g, "") // Remove all HTML tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
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
