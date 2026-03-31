const https = require("https");
const http = require("http");
const { Router } = require("express");
const { all, run } = require("../db/client");
const { asyncHandler } = require("../lib/async-handler");

const newsRouter = Router();

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let lastFetchTime = 0;

function fetchUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error("Too many redirects"));
    const client = url.startsWith("https") ? https : http;
    const req = client.get(
      url,
      {
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "kk,ru;q=0.9,en;q=0.8",
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          fetchUrl(next, redirectCount + 1).then(resolve).catch(reject);
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripTags(str) {
  return str.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseNews(html, baseUrl) {
  const items = [];

  // Strategy 1: look for <article> or .news-item / .news-card blocks with a title and link
  const blockRe =
    /<article[^>]*>([\s\S]*?)<\/article>|<div[^>]*class="[^"]*(?:news|article|post|жаңалық)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let bm;
  while ((bm = blockRe.exec(html)) !== null && items.length < 12) {
    const block = bm[1] || bm[2] || "";
    const linkRe = /href="([^"]+)"/i;
    const titleRe =
      /<(?:h[1-6]|div|span|p)[^>]*class="[^"]*(?:title|heading|name|заголовок)[^"]*"[^>]*>([\s\S]*?)<\/(?:h[1-6]|div|span|p)>/i;
    const hRe = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i;
    const imgRe = /src="([^"]*(?:jpg|jpeg|png|webp)[^"]*)"/i;

    const lm = linkRe.exec(block);
    const tm = titleRe.exec(block) || hRe.exec(block);
    const im = imgRe.exec(block);

    if (!lm || !tm) continue;
    const rawTitle = decodeEntities(stripTags(tm[1]));
    if (rawTitle.length < 5 || rawTitle.length > 300) continue;

    let href = lm[1];
    if (!href.startsWith("http")) href = new URL(href, baseUrl).href;

    items.push({
      title: rawTitle,
      url: href,
      imageUrl: im ? (im[1].startsWith("http") ? im[1] : new URL(im[1], baseUrl).href) : "",
      publishedAt: "",
    });
  }

  if (items.length >= 3) return items;

  // Strategy 2: find any <a> inside <h2>/<h3>/<h4> — simple fallback
  const hLinkRe = /<h[2-4][^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let hm;
  while ((hm = hLinkRe.exec(html)) !== null && items.length < 12) {
    const rawTitle = decodeEntities(stripTags(hm[2]));
    if (rawTitle.length < 8 || rawTitle.length > 250) continue;
    let href = hm[1];
    if (!href.startsWith("http")) {
      try {
        href = new URL(href, baseUrl).href;
      } catch {
        continue;
      }
    }
    if (!href.includes("yu.edu.kz")) continue;
    items.push({ title: rawTitle, url: href, imageUrl: "", publishedAt: "" });
  }

  return items;
}

async function scrapeNews() {
  const candidates = [
    "https://yu.edu.kz/kk/news",
    "https://yu.edu.kz/ru/news",
    "https://yu.edu.kz/kk",
    "https://yu.edu.kz",
  ];

  for (const url of candidates) {
    try {
      const html = await fetchUrl(url);
      const items = parseNews(html, url);
      if (items.length >= 1) return items.slice(0, 10);
    } catch (_err) {
      // try next
    }
  }
  return [];
}

newsRouter.get(
  "/news",
  asyncHandler(async (_req, res) => {
    const now = Date.now();

    if (now - lastFetchTime < CACHE_TTL_MS) {
      const cached = await all("SELECT * FROM news_cache ORDER BY id ASC LIMIT 10");
      if (cached.length > 0) {
        return res.json(
          cached.map((r) => ({
            id: r.id,
            title: r.title,
            url: r.url,
            imageUrl: r.image_url,
            publishedAt: r.published_at,
            fetchedAt: r.fetched_at,
          }))
        );
      }
    }

    const items = await scrapeNews();

    if (items.length > 0) {
      await run("DELETE FROM news_cache");
      for (const item of items) {
        await run(
          "INSERT INTO news_cache (title, url, image_url, published_at) VALUES (?, ?, ?, ?)",
          [item.title, item.url, item.imageUrl || "", item.publishedAt || ""]
        );
      }
      lastFetchTime = now;
    }

    const result = await all("SELECT * FROM news_cache ORDER BY id ASC LIMIT 10");
    res.json(
      result.map((r) => ({
        id: r.id,
        title: r.title,
        url: r.url,
        imageUrl: r.image_url,
        publishedAt: r.published_at,
        fetchedAt: r.fetched_at,
      }))
    );
  })
);

module.exports = { newsRouter };
