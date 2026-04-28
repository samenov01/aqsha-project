const https = require("https");
const { Router } = require("express");
const { all, run } = require("../db/client");
const { asyncHandler } = require("../lib/async-handler");

const newsRouter = Router();

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let lastFetchTime = 0;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (e) {
            reject(e);
          }
        });
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

function decodeEntities(str) {
  return (str || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, " ")
    .trim();
}

async function fetchNews() {
  // Fetch posts in all languages, filter to Russian, deduplicate by featured_media
  const posts = await fetchJson(
    "https://yu.edu.kz/wp-json/wp/v2/posts?per_page=30&_embed&_fields=id,title,link,date,_embedded"
  );

  const seen = new Set();
  const items = [];

  for (const post of posts) {
    const link = post.link || "";
    // Only Russian posts
    if (!link.includes("/ru/")) continue;

    const title = decodeEntities(post.title?.rendered || "");
    if (!title) continue;

    const mediaArr = post._embedded?.["wp:featuredmedia"] ?? [];
    const media = mediaArr[0] ?? {};
    const sizes = media.media_details?.sizes ?? {};
    const imageUrl =
      sizes.medium?.source_url ||
      sizes.thumbnail?.source_url ||
      media.source_url ||
      "";

    const mediaKey = imageUrl || link;
    if (seen.has(mediaKey)) continue;
    seen.add(mediaKey);

    items.push({
      title,
      url: link,
      imageUrl,
      publishedAt: post.date ? post.date.slice(0, 10) : "",
    });

    if (items.length >= 10) break;
  }

  return items;
}

newsRouter.get(
  "/news",
  asyncHandler(async (_req, res) => {
    const now = Date.now();

    if (now - lastFetchTime < CACHE_TTL_MS) {
      const cached = await all("SELECT * FROM news_cache ORDER BY id DESC LIMIT 10");
      if (cached.length > 0) {
        return res.json(
          cached.map((r) => ({
            id: r.id,
            title: r.title,
            url: r.url,
            imageUrl: r.image_url,
            publishedAt: r.published_at,
          }))
        );
      }
    }

    const items = await fetchNews();

    if (items.length > 0) {
      await run("DELETE FROM news_cache");
      for (const item of items) {
        await run(
          "INSERT INTO news_cache (title, url, image_url, published_at) VALUES (?, ?, ?, ?)",
          [item.title, item.url, item.imageUrl, item.publishedAt]
        );
      }
      lastFetchTime = now;
    }

    const result = await all("SELECT * FROM news_cache ORDER BY id DESC LIMIT 10");
    res.json(
      result.map((r) => ({
        id: r.id,
        title: r.title,
        url: r.url,
        imageUrl: r.image_url,
        publishedAt: r.published_at,
      }))
    );
  })
);

module.exports = { newsRouter };
