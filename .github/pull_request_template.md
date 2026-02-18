## Summary

<!-- Brief description of what this PR does (1-3 bullet points) -->

-

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / code cleanup
- [ ] Documentation
- [ ] Configuration / infrastructure

## Testing

<!-- How did you verify this works? -->

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] Manually tested locally
- [ ] Tested against dev Supabase (not production)

## Checklist

- [ ] All database queries filter by `publication_id`
- [ ] No `SELECT *` in new/modified queries
- [ ] No hardcoded secrets or API keys
- [ ] Logging uses one-line format with prefixes (`[Workflow]`, `[RSS]`, etc.)
- [ ] Error handling includes try/catch where appropriate
- [ ] Related docs updated (if applicable)
