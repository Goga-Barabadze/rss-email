export interface FeedPageDataFeed {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  updatedAt?: string;
  lastRunAt?: string;
  lastRunSummary?: string;
}

interface PageProps {
  feeds: FeedPageDataFeed[];
  recipient: string;
  requiresAdminKey: boolean;
}

export function renderHtml({ feeds, recipient, requiresAdminKey }: PageProps) {
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
        color: #111827;
        background: #f8fafc;
      }
      body {
        margin: 0;
        padding: 2rem;
      }
      h1, h2, h3, h4 {
        margin: 0 0 0.5rem 0;
      }
      p {
        margin: 0.25rem 0 1rem;
      }
      header {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 2rem;
      }
      .card {
        background: #fff;
        border-radius: 1rem;
        padding: 1.5rem;
        box-shadow: 0 20px 25px -5px rgb(15 23 42 / 0.1), 0 10px 10px -5px rgb(15 23 42 / 0.04);
        margin-bottom: 1.5rem;
      }
      label {
        font-size: 0.85rem;
        font-weight: 600;
        display: block;
        margin-bottom: 0.25rem;
      }
      input {
        width: 100%;
        padding: 0.75rem;
        border-radius: 0.75rem;
        border: 1px solid #d1d5db;
        font-size: 0.95rem;
        margin-bottom: 0.75rem;
      }
      button {
        border: none;
        border-radius: 999px;
        padding: 0.65rem 1.5rem;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }
      button.primary {
        background: #111827;
        color: #fff;
      }
      button.secondary {
        background: #e5e7eb;
        color: #111827;
      }
      button.danger {
        background: #f87171;
        color: #fff;
      }
      .feeds-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .feed-row {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.85rem;
        background: #fff;
      }
      .feed-row h3 {
        margin: 0;
        font-size: 1rem;
      }
      .feed-meta {
        font-size: 0.85rem;
        color: #475569;
      }
      .status {
        margin-top: 0.5rem;
        font-size: 0.85rem;
        color: #0f172a;
      }
      .status.error {
        color: #b91c1c;
      }
      .inline-form {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.75rem;
      }
      .admin-hint {
        font-size: 0.85rem;
        color: #6b7280;
      }
      #message {
        margin-top: 0.5rem;
        font-size: 0.9rem;
        min-height: 1.2rem;
      }
      @media (max-width: 640px) {
        body {
          padding: 1rem;
        }
      }
    </style>
  </head>

  <body>
    <header>
      <h1>RSS → Mailgun</h1>
      <p>Currently delivering new feed items to <strong>${escapeHtml(recipient)}</strong>.</p>
    </header>

    <section class="card">
      <h2>Admin Access</h2>
      <label for="admin-key">Management API key</label>
      <input id="admin-key" type="password" placeholder="Enter the MANAGEMENT_API_KEY value" autocomplete="off" />
      <p class="admin-hint">
        ${requiresAdminKey ? "The key is required for mutations or manual runs." : "No admin key set — mutating endpoints are open."}
      </p>
      <button class="secondary" id="save-key">Save key locally</button>
      <div id="message"></div>
    </section>

    <section class="card">
      <h2>Add a feed</h2>
      <form id="add-feed-form">
        <label for="new-feed-title">Title</label>
        <input id="new-feed-title" name="title" placeholder="Tech News" />
        <label for="new-feed-url">Feed URL</label>
        <input id="new-feed-url" name="url" placeholder="https://example.com/rss.xml" required />
        <button class="primary" type="submit">Add feed</button>
      </form>
    </section>

    <section class="card">
      <h2>Manual run</h2>
      <p>Kick off the hourly job immediately.</p>
      <button class="primary" id="run-now">Run fetch & email now</button>
      <div id="run-status" class="admin-hint"></div>
    </section>

    <section class="card">
      <h2>Configured feeds</h2>
      <div id="feeds-empty" class="admin-hint"${
        feeds.length ? ' style="display:none;"' : ""
      }>No feeds yet — add one above.</div>
      <div id="feeds-list" class="feeds-list"></div>
      <button class="secondary" id="refresh-feeds">Refresh list</button>
    </section>

    <script>
      const state = {
        feeds: ${initialFeeds},
      };

      const adminInput = document.getElementById("admin-key");
      const savedKey = localStorage.getItem("rss-admin-key");
      if (savedKey) {
        adminInput.value = savedKey;
      }

      document.getElementById("save-key").addEventListener("click", () => {
        localStorage.setItem("rss-admin-key", adminInput.value.trim());
        setMessage("Saved key locally.");
      });

      document.getElementById("add-feed-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const payload = {
          title: form.title.value,
          url: form.url.value,
        };
        const response = await fetch("/api/feeds", {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setMessage(data.error || "Failed to add feed", true);
          return;
        }
        form.reset();
        setMessage("Feed added.");
        await refreshFeeds();
      });

      document.getElementById("refresh-feeds").addEventListener("click", refreshFeeds);
      document.getElementById("run-now").addEventListener("click", async () => {
        document.getElementById("run-status").textContent = "Running…";
        const response = await fetch("/api/run", {
          method: "POST",
          headers: buildHeaders(false),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          document.getElementById("run-status").textContent = data.error || "Job failed (check key).";
          return;
        }
        const data = await response.json();
        document.getElementById("run-status").textContent = data.message + " Checked " + data.feedsChecked + " feed(s).";
        await refreshFeeds();
      });

      function buildHeaders(includeJson = true) {
        const headers = includeJson ? { "Content-Type": "application/json" } : {};
        const key = adminInput.value.trim();
        if (key) {
          headers["X-Admin-Key"] = key;
        }
        return headers;
      }

      async function refreshFeeds() {
        const response = await fetch("/api/feeds", {
          headers: buildHeaders(false),
        });
        if (!response.ok) {
          setMessage("Unable to load feeds (check permissions).", true);
          return;
        }
        const data = await response.json();
        state.feeds = data.feeds || [];
        renderFeeds();
      }

      function setMessage(message, isError = false) {
        const el = document.getElementById("message");
        el.style.color = isError ? "#b91c1c" : "#0f172a";
        el.textContent = message;
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
            wrapper.className = "feed-row";
            wrapper.innerHTML = \`
              <div>
                <h3>\${escapeHtml(feed.title)}</h3>
                <p class="feed-meta"><a href="\${escapeHtml(feed.url)}" target="_blank" rel="noopener">\${escapeHtml(feed.url)}</a></p>
                <p class="feed-meta">Created: \${formatDate(feed.createdAt)} \${feed.updatedAt ? "| Updated: " + formatDate(feed.updatedAt) : ""}</p>
                <p class="feed-meta">Last run: \${formatDate(feed.lastRunAt)} \${feed.lastRunSummary ? "| " + feed.lastRunSummary : ""}</p>
              </div>
              <div class="inline-form">
                <div>
                  <label>Title</label>
                  <input data-field="title" value="\${feed.title}" />
                </div>
                <div>
                  <label>URL</label>
                  <input data-field="url" value="\${feed.url}" />
                </div>
                <div style="display:flex;align-items:center;gap:0.5rem;">
                  <button class="secondary" data-action="save">Save</button>
                  <button class="danger" data-action="delete">Delete</button>
                </div>
              </div>
              <p class="status">\${feed.lastRunSummary || "Not run yet"}</p>
            \`;

            wrapper.addEventListener("click", async (event) => {
              const target = event.target;
              if (!(target instanceof HTMLElement)) return;
              const action = target.dataset.action;
              if (action === "save") {
                const inputs = wrapper.querySelectorAll("input[data-field]");
                const payload = {};
                inputs.forEach((input) => {
                  payload[input.dataset.field] = input.value;
                });
                const response = await fetch(\`/api/feeds/\${feed.id}\`, {
                  method: "PUT",
                  headers: buildHeaders(),
                  body: JSON.stringify(payload),
                });
                if (!response.ok) {
                  const data = await response.json().catch(() => ({}));
                  setMessage(data.error || "Update failed", true);
                  return;
                }
                setMessage("Feed updated.");
                await refreshFeeds();
              }
              if (action === "delete") {
                if (!confirm("Delete this feed?")) return;
                const response = await fetch(\`/api/feeds/\${feed.id}\`, {
                  method: "DELETE",
                  headers: buildHeaders(false),
                });
                if (!response.ok) {
                  const data = await response.json().catch(() => ({}));
                  setMessage(data.error || "Delete failed", true);
                  return;
                }
                setMessage("Feed deleted.");
                await refreshFeeds();
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
