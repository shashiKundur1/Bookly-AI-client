export type BookStatus = "to_read" | "reading" | "finished";
export type BookPriority = "low" | "medium" | "high";
export type ExtractionStatus = "pending" | "processing" | "ready" | "failed";

export interface User {
  id: string;
  email: string;
  name: string;
  has_avatar: boolean;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Progress {
  current_page: number;
  pages_read: number[];
  percent: number;
  updated_at: string | null;
}

export interface Book {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  status: BookStatus;
  priority: BookPriority;
  color: string | null;
  is_favorite: boolean;
  position: number;
  page_count: number;
  file_size: number;
  extraction_status: ExtractionStatus;
  extraction_error: string | null;
  has_cover: boolean;
  created_at: string;
  updated_at: string;
  last_read_at: string | null;
  progress: Progress | null;
}

export interface TocEntry {
  level: number;
  title: string;
  page: number;
}

export interface ContentOverview {
  extraction_status: string;
  page_count: number;
  toc: TocEntry[];
}

export interface Block {
  i: number;
  type: "heading" | "paragraph" | "list_item";
  level?: number;
  text: string;
  bbox: [number, number, number, number];
}

export interface Chunk {
  id: string;
  page: number;
  blocks: number[];
  text: string;
  speech: string;
}

export interface PageContent {
  page: number;
  blocks: Block[];
  chunks: Chunk[];
}

export interface Voice {
  id: string;
  name: string;
  gender: string;
  accent: string;
}

export interface Emotion {
  id: string;
  name: string;
  tagline: string;
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface ReadingSession {
  id: string;
  book_id: string;
  started_at: string;
  ended_at: string | null;
  start_page: number;
  end_page: number | null;
}

export interface SessionSummary extends ReadingSession {
  book_title: string;
}

export interface UserStats {
  total_books: number;
  by_status: Record<string, number>;
  favorites: number;
  pages_read: number;
  reading_seconds: number;
  recent_sessions: SessionSummary[];
}

export interface BookFilters {
  status?: BookStatus;
  priority?: BookPriority;
  color?: string;
  favorite?: boolean;
  q?: string;
  sort?: "position" | "title" | "created_at" | "updated_at" | "last_read_at" | "priority";
  order?: "asc" | "desc";
}
