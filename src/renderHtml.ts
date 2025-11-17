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
        color: #1a1a1a;
        background: #ffffff;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        background: #ffffff;
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
        color: #1a1a1a;
      }
      .hero h1 {
        margin: 0 0 0.35rem;
        font-size: clamp(2rem, 4vw, 3rem);
        letter-spacing: -0.03em;
      }
      .hero p {
        margin: 0;
        opacity: 0.7;
      }
      .subtext {
        font-size: 0.95rem;
        color: #666;
      }
      .btn-ghost {
        border: 1px solid #ccc;
        background: transparent;
        color: #1a1a1a;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        font-weight: 500;
        cursor: pointer;
        transition: background 180ms ease, border-color 180ms ease;
      }
      .btn-ghost:hover {
        background: #f5f5f5;
        border-color: #999;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.25rem;
      }
      .panel {
        background: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        padding: 1.5rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      .panel h2 {
        margin: 0 0 0.75rem;
        font-size: 1.2rem;
        letter-spacing: -0.01em;
        color: #1a1a1a;
      }
      .panel p {
        margin: 0 0 1.25rem;
        color: #666;
      }
      label {
        display: block;
        color: #333;
        margin-bottom: 0.35rem;
        font-size: 0.85rem;
      }
      input {
        width: 100%;
        border-radius: 4px;
        border: 1px solid #ccc;
        background: #ffffff;
        color: #1a1a1a;
        padding: 0.75rem 0.9rem;
        font-size: 1rem;
        margin-bottom: 0.75rem;
        transition: border 150ms ease;
      }
      input:focus {
        outline: none;
        border-color: #666;
      }
      button.primary {
        border: 1px solid #1a1a1a;
        border-radius: 4px;
        padding: 0.8rem 1.75rem;
        font-weight: 500;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        background: #1a1a1a;
        color: #ffffff;
        transition: background 180ms ease, border-color 180ms ease;
      }
      button.primary:hover {
        background: #333;
        border-color: #333;
      }
      button.secondary {
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 0.65rem 1.5rem;
        background: #ffffff;
        color: #1a1a1a;
        font-weight: 500;
        cursor: pointer;
        transition: background 150ms ease, border-color 150ms ease;
      }
      button.secondary:hover {
        background: #f5f5f5;
        border-color: #999;
      }
      button.danger {
        border: 1px solid #999;
        border-radius: 4px;
        padding: 0.6rem 1.3rem;
        font-weight: 500;
        cursor: pointer;
        background: #ffffff;
        color: #1a1a1a;
        transition: background 150ms ease, border-color 150ms ease;
      }
      button.danger:hover {
        background: #f5f5f5;
        border-color: #666;
      }
      .feeds-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-top: 1rem;
      }
      .feed-card {
        border-radius: 4px;
        padding: 1.25rem;
        background: #ffffff;
        border: 1px solid #e0e0e0;
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
        color: #1a1a1a;
      }
      .feed-meta {
        font-size: 0.85rem;
        color: #666;
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
        background: #f5f5f5;
        border-radius: 4px;
        color: #333;
        font-size: 0.85rem;
      }
      .status {
        font-size: 0.9rem;
        color: #666;
      }
      #toast {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        min-width: 220px;
        padding: 0.9rem 1.2rem;
        border-radius: 4px;
        background: #1a1a1a;
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
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
        background: #666;
      }
      #selector-modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        padding: 2rem;
        overflow: auto;
      }
      #selector-modal.visible {
        display: flex;
        flex-direction: column;
      }
      .modal-content {
        background: #fff;
        border-radius: 4px;
        padding: 1.5rem;
        max-width: 90vw;
        max-height: 90vh;
        margin: auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        border: 1px solid #e0e0e0;
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .modal-iframe {
        width: 100%;
        height: 60vh;
        border: 1px solid #ccc;
        border-radius: 4px;
      }
      .selector-instructions {
        background: #f5f5f5;
        padding: 1rem;
        border-radius: 4px;
        font-size: 0.9em;
      }
      .selector-mode {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }
      .selector-mode button {
        padding: 0.5rem 1rem;
        font-size: 0.9em;
      }
      .selector-mode button.active {
        background: #1a1a1a;
        color: #fff;
      }
      .preview-item {
        background: #fff;
        padding: 0.75rem;
        margin-bottom: 0.75rem;
        border-radius: 0.5rem;
        border: 1px solid #e2e8f0;
      }
      .preview-item:last-child {
        margin-bottom: 0;
      }
      .preview-item-title {
        font-weight: 600;
        margin-bottom: 0.5rem;
        color: #1e293b;
      }
      .preview-item-title a {
        color: #1a1a1a;
        text-decoration: underline;
      }
      .preview-item-title a:hover {
        text-decoration: none;
      }
      .preview-item-link {
        font-size: 0.9em;
        color: #666;
        margin-bottom: 0.5rem;
        word-break: break-all;
      }
      .preview-item-description {
        font-size: 0.9em;
        color: #666;
        line-height: 1.5;
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
              <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
                <button type="button" class="secondary" id="build-selectors-btn">Build Selectors Interactively</button>
                <button type="button" class="secondary" id="preview-items-btn">Preview Items</button>
              </div>
              <label for="new-feed-title-selector">Title CSS selector</label>
              <input id="new-feed-title-selector" name="titleSelector" placeholder="h3, .title, #news-title" />
              <label for="new-feed-link-selector">Link CSS selector</label>
              <input id="new-feed-link-selector" name="linkSelector" placeholder="a, .link, a.article-link" />
              <label for="new-feed-desc-selector">Description CSS selector (optional)</label>
              <input id="new-feed-desc-selector" name="descriptionSelector" placeholder="p, .description, .summary" />
              <div id="preview-section" style="display: none; margin-top: 1rem; padding: 1rem; background: #f5f5f5; border-radius: 4px; border: 1px solid #e0e0e0;">
                <h3 style="margin-top: 0; margin-bottom: 0.75rem; font-size: 1.1em;">Preview (first 3 items):</h3>
                <div id="preview-items"></div>
                <div id="preview-loading" style="display: none; color: #666;">Loading preview...</div>
                <div id="preview-error" style="display: none; color: #666;"></div>
              </div>
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
    <div id="selector-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Build CSS Selectors</h2>
          <button class="secondary" id="close-modal">Close</button>
        </div>
        <div class="selector-instructions">
          <p><strong>Instructions:</strong></p>
          <ol style="margin: 0.5rem 0; padding-left: 1.5rem;">
            <li>Select a mode below (Title, Link, or Description)</li>
            <li>Click on an element in the preview to select it</li>
            <li>The CSS selector will be generated and filled in automatically</li>
            <li>Repeat for each field you need</li>
          </ol>
        </div>
        <div class="selector-mode">
          <button class="secondary active" data-mode="title">Select Title</button>
          <button class="secondary" data-mode="link">Select Link</button>
          <button class="secondary" data-mode="description">Select Description</button>
        </div>
        <iframe id="selector-iframe" class="modal-iframe" sandbox="allow-same-origin allow-scripts"></iframe>
      </div>
    </div>

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

      // Selector builder modal
      const modal = document.getElementById("selector-modal");
      const iframe = document.getElementById("selector-iframe");
      let currentMode = "title";
      let selectionScript = null;

      document.getElementById("build-selectors-btn").addEventListener("click", () => {
        const url = document.getElementById("new-feed-url").value;
        if (!url) {
          showToast("Please enter a URL first", true);
          return;
        }
        window.currentEditFeedId = null; // Clear edit mode
        modal.classList.add("visible");
        iframe.src = "/api/selector-preview?url=" + encodeURIComponent(url);
      });

      document.getElementById("preview-items-btn").addEventListener("click", async () => {
        const url = document.getElementById("new-feed-url").value;
        const titleSelector = document.getElementById("new-feed-title-selector").value;
        const linkSelector = document.getElementById("new-feed-link-selector").value;
        const descSelector = document.getElementById("new-feed-desc-selector").value;

        if (!url) {
          showToast("Please enter a URL first", true);
          return;
        }
        if (!titleSelector || !linkSelector) {
          showToast("Please enter title and link selectors first", true);
          return;
        }

        const previewSection = document.getElementById("preview-section");
        const previewItems = document.getElementById("preview-items");
        const previewLoading = document.getElementById("preview-loading");
        const previewError = document.getElementById("preview-error");

        previewSection.style.display = "block";
        previewItems.innerHTML = "";
        previewLoading.style.display = "block";
        previewError.style.display = "none";

        try {
          const response = await fetch("/api/preview-items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url,
              titleSelector,
              linkSelector,
              descriptionSelector: descSelector || undefined,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to fetch preview");
          }

          const data = await response.json();
          previewLoading.style.display = "none";

          if (data.items && data.items.length > 0) {
            previewItems.innerHTML = data.items
              .slice(0, 3)
              .map(
                (item) => \`
                  <div class="preview-item">
                    <div class="preview-item-title">
                      <a href="\${escapeHtml(item.link)}" target="_blank" rel="noopener">\${escapeHtml(item.title || "No title")}</a>
                    </div>
                    <div class="preview-item-link">\${escapeHtml(item.link)}</div>
                    \${item.summary ? \`<div class="preview-item-description">\${escapeHtml(item.summary)}</div>\` : ""}
                  </div>
                \`,
              )
              .join("");
          } else {
            previewError.textContent = "No items found with the provided selectors";
            previewError.style.display = "block";
          }
        } catch (error) {
          previewLoading.style.display = "none";
          previewError.textContent = error.message || "Failed to load preview";
          previewError.style.display = "block";
        }
      });

      document.getElementById("close-modal").addEventListener("click", () => {
        modal.classList.remove("visible");
        iframe.src = "about:blank";
      });

      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.classList.remove("visible");
          iframe.src = "about:blank";
        }
      });

      document.querySelectorAll(".selector-mode button").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".selector-mode button").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          currentMode = btn.dataset.mode;
          // Send mode change to iframe
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: "setMode", mode: currentMode }, "*");
          }
        });
      });

      // Listen for selector messages from iframe
      window.addEventListener("message", (event) => {
        if (event.data.type === "selector") {
          const { mode, selector } = event.data;
          
          // Check if we're editing an existing feed
          if (window.currentEditFeedId) {
            const feedCard = document.querySelector(\`[data-feed-id="\${window.currentEditFeedId}"]\`);
            if (feedCard) {
              const fieldMap = {
                title: "titleSelector",
                link: "linkSelector",
                description: "descriptionSelector"
              };
              const input = feedCard.querySelector(\`input[data-field="\${fieldMap[mode]}"]\`);
              if (input) {
                input.value = selector;
              }
            }
          } else {
            // New feed form
            if (mode === "title") {
              document.getElementById("new-feed-title-selector").value = selector;
            } else if (mode === "link") {
              document.getElementById("new-feed-link-selector").value = selector;
            } else if (mode === "description") {
              document.getElementById("new-feed-desc-selector").value = selector;
            }
          }
          
          showToast(\`\${mode.charAt(0).toUpperCase() + mode.slice(1)} selector set: \${selector}\`);
        }
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
            wrapper.setAttribute("data-feed-id", feed.id);
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
                <div style="display:flex;align-items:center;gap:0.5rem;grid-column:1/-1;">
                  <input type="checkbox" data-field="isScrapedFeed" \${feed.isScrapedFeed ? "checked" : ""} />
                  <label style="margin:0;">Scrape website (not RSS feed)</label>
                </div>
                <div class="scraped-edit-fields" style="display: \${feed.isScrapedFeed ? "block" : "none"}; grid-column: 1 / -1;">
                  <button type="button" class="secondary build-selectors-edit-btn" data-feed-url="\${escapeHtml(feed.url)}" style="margin-bottom: 0.75rem;">Build Selectors Interactively</button>
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

            // Build selectors button for edit form
            const buildSelectorsBtn = wrapper.querySelector(".build-selectors-edit-btn");
            if (buildSelectorsBtn) {
              buildSelectorsBtn.addEventListener("click", () => {
                const url = buildSelectorsBtn.dataset.feedUrl;
                if (!url) {
                  showToast("Feed URL not found", true);
                  return;
                }
                modal.classList.add("visible");
                iframe.src = "/api/selector-preview?url=" + encodeURIComponent(url);
                
                // Store reference to this feed's inputs for updating
                const feedId = feed.id;
                window.currentEditFeedId = feedId;
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
