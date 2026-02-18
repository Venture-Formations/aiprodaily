# Contributing to AIProDaily

## Development Setup

1. **Clone the repo** and install dependencies:
   ```bash
   git clone <repo-url>
   cd ai-pros-newsletter
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your own keys. At minimum you need:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`)
   - `CRON_SECRET` (generate with `openssl rand -base64 32`)

3. **Set up a dev Supabase project** - do NOT use the production database. Create your own project at [supabase.com](https://supabase.com/dashboard) and apply migrations from `db/migrations/`.

4. **Run the dev server:**
   ```bash
   npm run dev
   ```

## Git Workflow

### Branching

- **`master`** is the production branch. It auto-deploys to Vercel on every merge.
- Never push directly to `master`. Always use pull requests.
- Branch naming convention:
  - `feature/short-description` - new features
  - `fix/short-description` - bug fixes
  - `chore/short-description` - maintenance, refactoring, docs

### Making Changes

```bash
# 1. Create a branch
git checkout master
git pull origin master
git checkout -b feature/your-feature

# 2. Make changes and commit
git add <specific-files>
git commit -m "Add feature description"

# 3. Push and open a PR
git push -u origin feature/your-feature
# Then open a PR on GitHub
```

### Pull Request Requirements

- CI checks must pass (build, lint, type-check)
- At least one code review approval
- Fill out the PR template completely
- Keep PRs focused - one feature/fix per PR

## Code Conventions

### Multi-Tenant Isolation
Every database query **must** filter by `publication_id`. This is the most critical rule in the codebase. Example:
```typescript
const { data } = await supabaseAdmin
  .from('articles')
  .select('id, title, body')
  .eq('publication_id', publicationId)
```

### No `SELECT *`
Always specify the columns you need. Never use `.select('*')` or `.select()` without arguments.

### Date Handling
Use local date strings for comparisons:
```typescript
// Good
const dateStr = date.split('T')[0]

// Bad - timezone issues
const dateStr = date.toISOString()
```

### Logging
Use one-line summaries with prefixes:
```typescript
console.log('[Workflow] Step 3 completed: 5 articles scored')
console.error('[RSS] Failed to fetch feed: timeout after 30s')
```

Prefixes: `[Workflow]`, `[RSS]`, `[AI]`, `[DB]`, `[CRON]`

### Error Handling
Wrap long-running tasks with retry logic (max 2 retries, 2s delay). Use `try/catch` and surface errors via `console.error`.

## Pre-Push Checklist

Before pushing your branch:

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] All new queries filter by `publication_id`
- [ ] No `SELECT *` in new/modified queries
- [ ] No hardcoded secrets or API keys
- [ ] Logging follows conventions (one-line, prefixed)

## Project Architecture

See [CLAUDE.md](CLAUDE.md) for the comprehensive operations guide, including:
- Task router (which docs to read for which area)
- Feature ownership map
- Workflow details
- Cron job documentation
