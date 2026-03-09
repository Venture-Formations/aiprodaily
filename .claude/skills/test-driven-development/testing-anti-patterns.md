# Testing Anti-Patterns

**Load this reference when:** writing or changing tests, adding mocks, or tempted to add test-only methods to production code.

## Overview

Tests must verify real behavior, not mock behavior. Mocks are a means to isolate, not the thing being tested.

**Core principle:** Test what the code does, not what the mocks do.

**Following strict TDD prevents these anti-patterns.**

## The Iron Laws

```
1. NEVER test mock behavior
2. NEVER add test-only methods to production classes
3. NEVER mock without understanding dependencies
```

## Anti-Pattern 1: Testing Mock Behavior

**The violation:**
```typescript
// BAD: Testing that the mock exists
test('renders sidebar', () => {
  render(<Page />);
  expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument();
});
```

**The fix:**
```typescript
// GOOD: Test real component or don't mock it
test('renders sidebar', () => {
  render(<Page />);  // Don't mock sidebar
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});
```

## Anti-Pattern 2: Test-Only Methods in Production

**The violation:**
```typescript
// BAD: destroy() only used in tests
class Session {
  async destroy() {  // Looks like production API!
    await this._workspaceManager?.destroyWorkspace(this.id);
  }
}
```

**The fix:**
```typescript
// GOOD: Test utilities handle test cleanup
// In test-utils/
export async function cleanupSession(session: Session) {
  const workspace = session.getWorkspaceInfo();
  if (workspace) {
    await workspaceManager.destroyWorkspace(workspace.id);
  }
}
```

## Anti-Pattern 3: Mocking Without Understanding

**The violation:**
```typescript
// BAD: Mock breaks test logic
test('detects duplicate server', () => {
  // Mock prevents config write that test depends on!
  vi.mock('ToolCatalog', () => ({
    discoverAndCacheTools: vi.fn().mockResolvedValue(undefined)
  }));

  await addServer(config);
  await addServer(config);  // Should throw - but won't!
});
```

**The fix:**
```typescript
// GOOD: Mock at correct level
test('detects duplicate server', () => {
  vi.mock('MCPServerManager'); // Just mock slow server startup
  await addServer(config);  // Config written
  await addServer(config);  // Duplicate detected
});
```

## Anti-Pattern 4: Incomplete Mocks

**The Iron Rule:** Mock the COMPLETE data structure as it exists in reality, not just fields your immediate test uses.

```typescript
// BAD: Mock only includes fields used in this test
vi.mock('UserService', () => ({
  getUser: vi.fn().mockResolvedValue({ id: 123 })
}));

// GOOD: Mock complete User structure
vi.mock('UserService', () => ({
  getUser: vi.fn().mockResolvedValue({
    id: 123,
    name: 'Test User',
    email: 'test@example.com',
    roles: ['user'],
    createdAt: new Date('2024-01-01')
  })
}));
```

Incomplete mocks hide shape/type mismatches that only surface at runtime.

## Anti-Pattern 5: Integration Tests as Afterthought

Testing is part of implementation, not optional follow-up.

```typescript
// BAD: Code written first, integration test bolted on later — misses edge case
test('creates order', async () => {
  const order = await createOrder({ items: [{ id: 1 }] });
  expect(order.id).toBeDefined();
  // Never tested: what happens when inventory is zero?
});

// GOOD: TDD — test drives the design, edge cases caught early
test('rejects order when inventory is zero', async () => {
  await setInventory(itemId, 0);
  await expect(createOrder({ items: [{ id: itemId }] }))
    .rejects.toThrow('Out of stock');
});
```

Write integration tests alongside the code, not after. TDD catches design flaws before they ship.

## Quick Reference

| Anti-Pattern | Fix |
|--------------|-----|
| Assert on mock elements | Test real component or unmock it |
| Test-only methods in production | Move to test utilities |
| Mock without understanding | Understand dependencies first, mock minimally |
| Incomplete mocks | Mirror real API completely |
| Tests as afterthought | TDD - tests first |
| Over-complex mocks | Simplify or use integration tests |

## Red Flags

- Assertion checks for `*-mock` test IDs
- Methods only called in test files
- Mock setup is >50% of test
- Test fails when you remove mock
- Can't explain why mock is needed
- Mocking "just to be safe"

## The Bottom Line

**Mocks are tools to isolate, not things to test.**

If TDD reveals you're testing mock behavior, you've gone wrong. Fix: Test real behavior or question why you're mocking at all.
