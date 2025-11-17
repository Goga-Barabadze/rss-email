export interface FeedPageDataFeed {
  id: string;
  title: string;
  url: string;
  group?: string;
  intervalMinutes?: number;
  linkPrefix?: string;
  isScrapedFeed?: boolean;
  titleSelector?: string;
  linkSelector?: string;
  descriptionSelector?: string;
  createdAt: string;
  updatedAt?: string;
  lastRunAt?: string;
  lastRunSummary?: string;
}

interface PageProps {
  feeds: FeedPageDataFeed[];
  recipient: string;
}

export function renderHtml({ feeds, recipient }: PageProps) {
  const initialFeeds = JSON.stringify(feeds).replace(/</g, "\\u003c");
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RSS Email Worker</title>
    <link rel="preconnect" href="https://rsms.me/" />
    <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
    <style>
      :root {
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #0f172a;
        background: #030712;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(circle at 10% 20%, #111827 0%, #030712 60%);
        color: inherit;
      }
      .app-shell {
        max-width: 960px;
        margin: 0 auto;
        padding: clamp(1.5rem, 2.5vw, 3rem);
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 2rem;
      }
      .hero {
        color: #f8fafc;
      }
      .hero h1 {
        margin: 0 0 0.35rem;
        font-size: clamp(2rem, 4vw, 3rem);
        letter-spacing: -0.03em;
      }
      .hero p {
        margin: 0;
        opacity: 0.85;
      }
      .subtext {
        font-size: 0.95rem;
        color: #cbd5f5;
      }
      .btn-ghost {
        border: 1px solid rgba(248, 250, 252, 0.3);
        background: transparent;
        color: #f8fafc;
        padding: 0.5rem 1rem;
        border-radius: 999px;
        font-weight: 600;
        cursor: pointer;
        transition: background 180ms ease, border-color 180ms ease;
      }
      .btn-ghost:hover {
        background: rgba(248, 250, 252, 0.08);
        border-color: rgba(248, 250, 252, 0.6);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.25rem;
      }
      .panel {
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(148, 163, 184, 0.15);
        border-radius: 1.25rem;
        padding: 1.5rem;
        backdrop-filter: blur(12px);
        box-shadow: 0 30px 60px rgba(2, 6, 23, 0.35);
      }
      .panel h2 {
        margin: 0 0 0.75rem;
        font-size: 1.2rem;
        letter-spacing: -0.01em;
        color: #f8fafc;
      }
      .panel p {
        margin: 0 0 1.25rem;
        color: #94a3b8;
      }
      label {
        display: block;
        color: #cbd5f5;
        margin-bottom: 0.35rem;
        font-size: 0.85rem;
      }
      input {
        width: 100%;
        border-radius: 0.85rem;
        border: 1px solid rgba(148, 163, 184, 0.3);
        background: rgba(15, 23, 42, 0.6);
        color: #f8fafc;
        padding: 0.75rem 0.9rem;
        font-size: 1rem;
        margin-bottom: 0.75rem;
        transition: border 150ms ease, background 150ms ease;
      }
      input:focus {
        outline: none;
        border-color: rgba(248, 250, 252, 0.6);
        background: rgba(15, 23, 42, 0.85);
      }
      button.primary {
        border: none;
        border-radius: 999px;
        padding: 0.8rem 1.75rem;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        background: linear-gradient(120deg, #2563eb, #7c3aed);
        color: #fff;
        box-shadow: 0 15px 30px rgba(37, 99, 235, 0.4);
        transition: transform 180ms ease, box-shadow 180ms ease;
      }
      button.primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 25px 45px rgba(37, 99, 235, 0.45);
      }
      button.secondary {
        border: 1px solid rgba(148, 163, 184, 0.4);
        border-radius: 999px;
        padding: 0.65rem 1.5rem;
        background: transparent;
        color: #e2e8f0;
        font-weight: 600;
        cursor: pointer;
      }
      button.danger {
        border: none;
        border-radius: 999px;
        padding: 0.6rem 1.3rem;
        font-weight: 600;
        cursor: pointer;
        background: rgba(239, 68, 68, 0.15);
        color: #fecaca;
      }
      .feeds-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-top: 1rem;
      }
      .feed-card {
        border-radius: 1rem;
        padding: 1.25rem;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(148, 163, 184, 0.12);
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }
      .feed-card header {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        margin: 0;
      }
      .feed-card h3 {
        margin: 0;
        font-size: 1.05rem;
        color: #f8fafc;
      }
      .feed-meta {
        font-size: 0.85rem;
        color: #94a3b8;
      }
      .inline-form {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.75rem;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.45rem 0.85rem;
        background: rgba(37, 99, 235, 0.15);
        border-radius: 999px;
        color: #bfdbfe;
        font-size: 0.85rem;
      }
      .status {
        font-size: 0.9rem;
        color: #cbd5f5;
      }
      #toast {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        min-width: 220px;
        padding: 0.9rem 1.2rem;
        border-radius: 0.9rem;
        background: rgba(15, 23, 42, 0.9);
        color: #f8fafc;
        box-shadow: 0 20px 40px rgba(2, 6, 23, 0.45);
        opacity: 0;
        pointer-events: none;
        transform: translateY(20px);
        transition: opacity 200ms ease, transform 200ms ease;
      }
      #toast.visible {
        opacity: 1;
        transform: translateY(0);
      }
      #toast.error {
        background: rgba(185, 28, 28, 0.9);
      }
      @media (max-width: 720px) {
        header {
          flex-direction: column;
        }
      }
    </style>
  </head>

  <body>
    <main class="app-shell">
      <header>
        <div class="hero">
          <p class="chip">Hourly digest enabled</p>
          <h1>RSS → Mailgun</h1>
          <p class="subtext">New items land in <strong>${escapeHtml(recipient)}</strong>.</p>
        </div>
      </header>

      <div class="grid">
        <section class="panel">
          <h2>Manual run</h2>
          <p>Fetch every feed and send a digest right now.</p>
          <button class="primary" id="run-now">Run job</button>
          <p id="run-status" class="subtext" style="margin-top:0.75rem;"></p>
        </section>

        <section class="panel">
          <h2>Add a feed</h2>
          <form id="add-feed-form">
            <label for="new-feed-title">Title</label>
            <input id="new-feed-title" name="title" placeholder="Tech News" />
            <label for="new-feed-url">Feed URL</label>
            <input id="new-feed-url" name="url" placeholder="https://example.com/rss.xml" required />
            <label for="new-feed-group">Group (optional)</label>
            <input id="new-feed-group" name="group" placeholder="Tech, News, etc. (leave empty for default)" />
            <label for="new-feed-interval">Check interval (minutes)</label>
            <input id="new-feed-interval" name="intervalMinutes" type="number" min="1" value="60" placeholder="60" />
            <label for="new-feed-link-prefix">Link prefix (optional)</label>
            <input id="new-feed-link-prefix" name="linkPrefix" placeholder="https://archive.is/" />
            <label style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
              <input type="checkbox" id="new-feed-scraped" name="isScrapedFeed" />
              <span>Scrape website (not RSS feed)</span>
            </label>
            <div id="scraped-fields" style="display: none; margin-top: 0.75rem;">
              <label for="new-feed-title-selector">Title CSS selector</label>
              <input id="new-feed-title-selector" name="titleSelector" placeholder="h3, .title, #news-title" />
              <label for="new-feed-link-selector">Link CSS selector</label>
              <input id="new-feed-link-selector" name="linkSelector" placeholder="a, .link, a.article-link" />
              <label for="new-feed-desc-selector">Description CSS selector (optional)</label>
              <input id="new-feed-desc-selector" name="descriptionSelector" placeholder="p, .description, .summary" />
            </div>
            <button class="primary" type="submit">Save feed</button>
          </form>
        </section>
      </div>

      <section class="panel" style="margin-top:1.5rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;">
          <h2>Feeds</h2>
          <button class="secondary" id="refresh-feeds">Refresh</button>
        </div>
        <div id="feeds-empty" class="subtext"${
          feeds.length ? ' style="display:none;"' : ""
        }>Nothing yet. Add a feed to start watching.</div>
        <div id="feeds-list" class="feeds-list"></div>
      </section>
    </main>
    <div id="toast"></div>

    <script>
      const state = {
        feeds: ${initialFeeds},
      };

      const toast = document.getElementById("toast");

      // Toggle scraped fields visibility
      document.getElementById("new-feed-scraped").addEventListener("change", (event) => {
        const scrapedFields = document.getElementById("scraped-fields");
        scrapedFields.style.display = event.target.checked ? "block" : "none";
      });

      document.getElementById("add-feed-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const isScraped = form.isScrapedFeed.checked;
        const payload = {
          title: form.title.value,
          url: form.url.value,
          group: form.group.value.trim() || undefined,
          intervalMinutes: form.intervalMinutes.value ? Number(form.intervalMinutes.value) : undefined,
          linkPrefix: form.linkPrefix.value.trim() || undefined,
          isScrapedFeed: isScraped,
          titleSelector: isScraped ? form.titleSelector.value.trim() || undefined : undefined,
          linkSelector: isScraped ? form.linkSelector.value.trim() || undefined : undefined,
          descriptionSelector: isScraped ? form.descriptionSelector.value.trim() || undefined : undefined,
        };
        try {
          const response = await fetch("/api/feeds", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!response.ok) throw await response.json();
          form.reset();
          showToast("Feed added.");
          await refreshFeeds();
        } catch (error) {
          handleError(error, "Failed to add feed.");
        }
      });

      document.getElementById("refresh-feeds").addEventListener("click", refreshFeeds);
      document.getElementById("run-now").addEventListener("click", async () => {
        const statusEl = document.getElementById("run-status");
        statusEl.textContent = "Running job…";
        try {
          const response = await fetch("/api/run", { method: "POST" });
          if (!response.ok) throw await response.json();
          const data = await response.json();
          let statusText = data.message;
          if (data.emailsSent > 0) {
            statusText += " Sent " + data.emailsSent + " email(s).";
          }
          if (data.emailsFailed > 0) {
            statusText += " Failed: " + data.emailsFailed + " email(s).";
          }
          statusEl.textContent = statusText + " Checked " + data.feedsChecked + " feed(s).";
          showToast("Manual run complete.");
          await refreshFeeds();
        } catch (error) {
          statusEl.textContent = "Run failed.";
          handleError(error, "Manual run failed.");
        }
      });

      async function refreshFeeds() {
        try {
          const response = await fetch("/api/feeds");
          if (!response.ok) throw await response.json();
          const data = await response.json();
          state.feeds = data.feeds || [];
          renderFeeds();
        } catch (error) {
          handleError(error, "Unable to load feeds.");
        }
      }

      function renderFeeds() {
        const container = document.getElementById("feeds-list");
        const emptyState = document.getElementById("feeds-empty");
        container.innerHTML = "";
        if (!state.feeds.length) {
          emptyState.style.display = "block";
          return;
        }
        emptyState.style.display = "none";

        state.feeds
          .slice()
          .sort((a, b) => a.title.localeCompare(b.title))
          .forEach((feed) => {
            const wrapper = document.createElement("div");
            wrapper.className = "feed-card";
            wrapper.innerHTML = \`
              <header>
                <h3>\${escapeHtml(feed.title)}\${feed.group ? " <span class=\\"chip\\" style=\\"margin-left:0.5rem;font-size:0.75rem;\\">" + escapeHtml(feed.group) + "</span>" : ""}</h3>
                <a class="feed-meta" href="\${escapeHtml(feed.url)}" target="_blank" rel="noopener">\${escapeHtml(feed.url)}</a>
                <p class="feed-meta">
                  Created: \${formatDate(feed.createdAt)} \${feed.updatedAt ? "| Updated: " + formatDate(feed.updatedAt) : ""}
                  <br />
                  Interval: \${feed.intervalMinutes || 60} min\${feed.linkPrefix ? " | Prefix: " + escapeHtml(feed.linkPrefix) : ""} | Last run: \${formatDate(feed.lastRunAt)} \${feed.lastRunSummary ? "| " + feed.lastRunSummary : ""}
                </p>
              </header>
              <div class="inline-form">
                <div>
                  <label>Title</label>
                  <input data-field="title" value="\${feed.title}" />
                </div>
                <div>
                  <label>URL</label>
                  <input data-field="url" value="\${feed.url}" />
                </div>
                <div>
                  <label>Group</label>
                  <input data-field="group" value="\${feed.group || ""}" placeholder="default" />
                </div>
                <div>
                  <label>Interval (min)</label>
                  <input data-field="intervalMinutes" type="number" min="1" value="\${feed.intervalMinutes || 60}" />
                </div>
                <div>
                  <label>Link prefix</label>
                  <input data-field="linkPrefix" value="\${feed.linkPrefix || ""}" placeholder="https://archive.is/" />
                </div>
                <div style="display:flex;align-items:center;gap:0.5rem;">
                  <input type="checkbox" data-field="isScrapedFeed" \${feed.isScrapedFeed ? "checked" : ""} />
                  <label style="margin:0;">Scrape website</label>
                </div>
                <div class="scraped-edit-fields" style="display: \${feed.isScrapedFeed ? "block" : "none"}; grid-column: 1 / -1;">
                  <div>
                    <label>Title selector</label>
                    <input data-field="titleSelector" value="\${feed.titleSelector || ""}" placeholder="h3, .title" />
                  </div>
                  <div>
                    <label>Link selector</label>
                    <input data-field="linkSelector" value="\${feed.linkSelector || ""}" placeholder="a, .link" />
                  </div>
                  <div>
                    <label>Description selector</label>
                    <input data-field="descriptionSelector" value="\${feed.descriptionSelector || ""}" placeholder="p, .description" />
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:0.5rem;justify-content:flex-end;">
                  <button class="secondary" data-action="save">Save</button>
                  <button class="danger" data-action="delete">Delete</button>
                </div>
              </div>
              <p class="status">\${feed.lastRunSummary || "Not run yet"}</p>
            \`;

            // Toggle scraped fields in edit form
            const scrapedCheckbox = wrapper.querySelector('input[data-field="isScrapedFeed"]');
            const scrapedFields = wrapper.querySelector(".scraped-edit-fields");
            if (scrapedCheckbox) {
              scrapedCheckbox.addEventListener("change", (e) => {
                if (scrapedFields) {
                  scrapedFields.style.display = e.target.checked ? "block" : "none";
                }
              });
            }

            wrapper.addEventListener("click", async (event) => {
              const target = event.target;
              if (!(target instanceof HTMLElement)) return;
              const action = target.dataset.action;
              if (action === "save") {
                const inputs = wrapper.querySelectorAll("input[data-field]");
                const payload = {};
                inputs.forEach((input) => {
                  const field = input.dataset.field;
                  if (field === "isScrapedFeed") {
                    payload[field] = input.checked;
                  } else {
                    const value = input.value.trim();
                    if (field === "group" || field === "linkPrefix" || field === "titleSelector" || field === "linkSelector" || field === "descriptionSelector") {
                      payload[field] = value || undefined;
                    } else if (field === "intervalMinutes") {
                      payload[field] = value ? Number(value) : undefined;
                    } else {
                      payload[field] = value;
                    }
                  }
                });
                try {
                  const response = await fetch(\`/api/feeds/\${feed.id}\`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });
                  if (!response.ok) throw await response.json();
                  showToast("Feed updated.");
                  await refreshFeeds();
                } catch (error) {
                  handleError(error, "Update failed.");
                }
              }
              if (action === "delete") {
                if (!confirm("Delete this feed?")) return;
                try {
                  const response = await fetch(\`/api/feeds/\${feed.id}\`, {
                    method: "DELETE",
                  });
                  if (!response.ok) throw await response.json();
                  showToast("Feed deleted.");
                  await refreshFeeds();
                } catch (error) {
                  handleError(error, "Delete failed.");
                }
              }
            });

            container.appendChild(wrapper);
          });
      }

      function formatDate(value) {
        if (!value) return "—";
        try {
          return new Date(value).toLocaleString();
        } catch {
          return value;
        }
      }

      function handleError(error, fallback) {
        const message = (error && error.error) || error?.message || fallback;
        showToast(message || fallback, true);
        console.error(error);
      }

      function showToast(message, isError = false) {
        toast.textContent = message;
        toast.classList.toggle("error", isError);
        toast.classList.add("visible");
        clearTimeout(showToast.timer);
        showToast.timer = setTimeout(() => {
          toast.classList.remove("visible");
          toast.classList.remove("error");
        }, 3200);
      }

      function escapeHtml(str) {
        return str.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      }

      renderFeeds();
    </script>
  </body>
</html>
`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
