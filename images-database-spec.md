# Images Database Feature Specification

This document describes how to implement an **Images** database section inside your application.
It covers schema design, storage layout, API contracts, frontend UX, and supporting AI prompts.

---

## Overview

The goal is to add an **Images** database tab to your application with the following capabilities:

* **Image Library Page** – list of images with thumbnails and editable metadata
* **Upload Flow** – drag‑and‑drop or file picker to upload one or more images
* **AI Analysis** – automatic captioning, tagging (with confidence scores), and metadata extraction
* **Tag Review & Crop** – human‑in‑the‑loop screen to edit tags and adjust a fixed 16:9 crop
* **Storage** – originals in Supabase Storage; cropped 16:9 variant also mirrored to GitHub for CDN use
* **Database** – metadata and embeddings stored in a single Supabase Postgres database

---

## Database Schema (Supabase / Postgres)

```sql
create extension if not exists vector;

create table if not exists images (
  id uuid primary key default gen_random_uuid(),
  object_key text not null,                              -- images/original/{uuid}.jpg
  cdn_url text generated always as (
    'https://YOUR-PROJECT.supabase.co/storage/v1/object/public/' || object_key
  ) stored,
  width int, height int, aspect_ratio float,
  orientation text check (orientation in ('landscape','portrait','square')),
  source_url text, license text, credit text,
  location text,
  faces_count int default 0,
  has_text bool default false,
  dominant_colors text[],
  safe_score float,
  ai_caption text,
  ai_alt_text text,
  ai_tags text[],
  ai_tags_scored jsonb,
  emb_caption vector(768),
  crop_ratio text default '16:9',
  crop_v_offset float default 0.5,
  variant_16x9_key text,
  variant_16x9_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists images_emb_ivf on images using ivfflat (emb_caption vector_cosine_ops) with (lists = 100);
create index if not exists images_created_idx on images (created_at desc);
create index if not exists images_orientation_idx on images (orientation);
```

### Optional Tables

* **image_variants** – store additional sizes beyond the default 16:9 crop  
* **article_image_choices** – cache of chosen images for articles to ensure deterministic newsletter output

All of these tables reside in the **same database**, not separate databases.

---

## Storage Layout

* **Supabase Storage**
  ```
  images/
    original/{uuid}.jpg
    variants/1200x675/{uuid}.jpg
  ```
* **GitHub Mirror (optional)**
  ```
  /images/library/1200x675/{uuid}.jpg
  ```

---

## API Endpoints

All routes use Supabase service role keys server‑side.

* `POST /api/images/upload-url` – returns signed URL for direct client upload
* `POST /api/images/ingest` – analyze uploaded image (caption, tags, OCR, embeddings)
* `POST /api/images/review/commit` – save user edits and generate/mirror the 16:9 crop
* (Optional) `GET /api/images/search` – search by tag/text/vector

Detailed request/response bodies are included in the conversation specification.

---

## Frontend UX

* **Database → Images Page**
  * Table/grid of thumbnails with inline editable columns (caption, tags, license, credit, etc.)
  * Filters: text search, tags, orientation, date range, license, faces, has_text
  * Bulk actions: delete, push missing variants, etc.

* **Upload Flow**
  1. Drag & drop or file picker (PNG/JPG/GIF up to 10 MB each)
  2. Progress screen: “Analyzing Images…” with count and percentage

* **Review Screen**
  * Original preview and live 16:9 crop preview
  * Vertical crop slider (0 = top, 0.5 = center, 1 = bottom)
  * Tag editor grouped by category (People, Scene, Theme, Style, Color, Object, Safety)
  * Buttons: Approve All, Clear All, Add Tag, Previous/Next/Skip/Save

---

## AI Prompts

### Image → Caption & Tags
```text
Analyze this image and return strict JSON:
{
  "caption": "...",
  "alt_text": "10–14 words, descriptive, no quotes",
  "tags_scored": [
    {"type":"scene","name":"warehouse","conf":0.95},
    {"type":"object","name":"golf_cart","conf":0.98},
    {"type":"color","name":"blue","conf":0.85},
    {"type":"safety","name":"has_text","conf":0.12}
  ],
  "top_tags": ["scene_warehouse","object_golf_cart","color_blue"]
}
Guidelines: concrete nouns; lowercase names with underscores; include safety.has_text if applicable.
```

Other prompts for re‑ranking and article matching are unchanged from earlier documentation.

---

## GitHub Mirroring

* Upload cropped variant to GitHub via REST API  
* Store final CDN URL (`https://cdn.jsdelivr.net/gh/{owner}/{repo}@branch/images/library/1200x675/{uuid}.jpg`) in `variant_16x9_url`

---

## Security & Permissions

* Client uses Supabase **anon** key for read-only image viewing.  
* All writes (uploads, edits, AI ingestion) go through server routes with **service role**.

---

## Testing Checklist

* Upload single/multiple files
* AI analysis and progress indicators
* Tag editing and crop slider
* 16:9 variant creation and GitHub mirroring
* Library page filtering, inline edits, and bulk actions

---

This markdown file contains the full implementation plan needed for Claude Code or any developer to build the **Images** feature as described.
