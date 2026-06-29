```markdown
# BDS_BACKEND Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the BDS_BACKEND repository, a TypeScript backend project with no detected framework. You'll learn file organization, import/export styles, commit message habits, and how to write and locate tests. This guide also provides suggested commands and workflows to streamline your contributions.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `userService.ts`, `orderController.ts`

### Import Style
- Use **relative imports** for referencing other modules.
  - Example:
    ```typescript
    import { getUser } from './userService';
    ```

### Export Style
- Use **named exports** for functions, classes, or constants.
  - Example:
    ```typescript
    // userService.ts
    export function getUser(id: string) { ... }
    export const USER_ROLE = 'admin';
    ```

### Commit Messages
- No strict format enforced; freeform messages are used.
- Some commits use prefixes, but not consistently.
- Average commit message length: 14 characters.
  - Example: `add login`, `fix bug`, `update user`

## Workflows

### Adding a New Module
**Trigger:** When you need to add a new feature or service.
**Command:** `/add-module`

1. Create a new file using camelCase (e.g., `newFeatureService.ts`).
2. Implement your logic using TypeScript.
3. Use relative imports to include dependencies.
4. Export your functions or classes using named exports.
5. Write corresponding tests in a `*.test.*` file.
6. Commit your changes with a concise message.

### Writing Tests
**Trigger:** When you add or update functionality.
**Command:** `/write-test`

1. Create a test file named with the pattern `*.test.*` (e.g., `userService.test.ts`).
2. Implement your tests using the project's preferred (unknown) testing framework.
3. Use relative imports to bring in the module under test.
4. Run your tests using the project's test runner (see project docs if available).
5. Commit your test code with a clear message.

### Refactoring Code
**Trigger:** When improving or restructuring existing code.
**Command:** `/refactor`

1. Identify the code to refactor.
2. Update file names to camelCase if needed.
3. Ensure all imports remain relative and update paths as necessary.
4. Use named exports consistently.
5. Update or add tests to cover changes.
6. Commit with a message describing the refactor.

## Testing Patterns

- Test files follow the pattern: `*.test.*` (e.g., `orderService.test.ts`).
- The specific testing framework is unknown; check existing tests for style and assertions.
- Tests import modules using relative paths.
- Place test files alongside or near the modules they test.

**Example:**
```typescript
// userService.test.ts
import { getUser } from './userService';

describe('getUser', () => {
  it('should return user by ID', () => {
    // test implementation
  });
});
```

## Commands
| Command       | Purpose                                      |
|---------------|----------------------------------------------|
| /add-module   | Scaffold and implement a new module/service  |
| /write-test   | Create and implement a new test file         |
| /refactor     | Refactor existing code and update tests      |
```
