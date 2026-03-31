import type { NewsItem } from "../types";
import { apiRequest } from "./client";

export function getNews() {
  return apiRequest<NewsItem[]>("/api/news");
}
