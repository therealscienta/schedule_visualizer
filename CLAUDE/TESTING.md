# Testing Documentation

## Overview

This project uses a comprehensive test automation suite built with Vitest and React Testing Library to ensure code quality, reliability, and maintainability.

## Test Stack

- **Vitest 4.0.18** - Fast unit test framework with native ESM support
- **React Testing Library 16.3.2** - Component testing utilities
- **@testing-library/jest-dom** - Custom DOM matchers
- **@testing-library/user-event** - User interaction simulation
- **jsdom** - DOM implementation for Node.js
- **@vitest/ui** - Interactive test UI
- **@vitest/coverage-v8** - Code coverage reporting with V8

## Test Structure

### Unit Tests

Located in `src/utils/`:

- **cronParser.test.ts** - Cron expression validation, execution generation, overlap detection
- **colors.test.ts** - Color palette and cycling logic
- **formatTime.test.ts** - Time formatting utilities (12h/24h)
- **id.test.ts** - UUID generation and validation

### Component Tests

Located in `src/components/`:

- **ScheduleInput.test.tsx** - Form validation, input handling, error states
- **ScheduleList.test.tsx** - Schedule rendering, removal, empty states
- **TimeRangeSelector.test.tsx** - Time range selection, button states
- **Timeline.test.tsx** - Timeline visualization, execution rendering, overlaps

### Integration Tests

Located in `src/`:

- **App.test.tsx** - Full application workflow, state management, localStorage integration

## Running Tests

### All Tests (Single Run)

```bash
npm test
```

### Watch Mode (Development)

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage
```

### Interactive UI

```bash
npm run test:ui
```

## Coverage Thresholds

Configured in `vitest.config.ts`:

- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

## Coverage Configuration

### Included Files
- All `.ts` and `.tsx` files in `src/`

### Excluded Files
- `node_modules/`
- `src/test/`
- `*.config.ts`
- `*.config.js`
- `src/main.tsx`
- `dist/`

## Test Setup

### Global Setup (`src/test/setup.ts`)

- Extends Vitest expect with jest-dom matchers
- Cleans up after each test
- Mocks localStorage
- Clears all mocks between tests

### Vitest Configuration (`vitest.config.ts`)

- Globals enabled for describe/it/expect
- jsdom environment for DOM testing
- React plugin for JSX transformation
- V8 coverage provider
- Multiple coverage reporters (text, json, html, lcov)

## Test Coverage Summary

### Utility Functions (100% target)
- Cron expression parsing and validation
- Execution generation with various time ranges
- Overlap detection algorithms
- Color palette management
- Time formatting (12h/24h)
- UUID generation

### Components (90%+ target)
- Input validation and form handling
- User interactions (clicks, typing, submission)
- Conditional rendering and state changes
- Error handling and edge cases
- Accessibility features

### Integration (85%+ target)
- Full user workflows
- State persistence (localStorage)
- Component interaction
- Time range switching
- Schedule management (add/remove)

## Test Patterns

### Component Testing

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<ComponentName />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    render(<ComponentName />);
    await user.click(screen.getByRole('button'));
    expect(/* assertion */).toBeTruthy();
  });
});
```

### Context Testing

```typescript
import { SettingsProvider } from '../contexts/SettingsContext';

const renderWithSettings = (ui: React.ReactElement) => {
  return render(<SettingsProvider>{ui}</SettingsProvider>);
};
```

### Mock Functions

```typescript
import { vi } from 'vitest';

const mockFn = vi.fn();
// Use in component
expect(mockFn).toHaveBeenCalledWith(expectedArgs);
```

## CI/CD Integration

Tests run automatically on:
- Push to `main` or `master` branch
- Pull requests to `main` or `master` branch

CI pipeline includes:
1. Type checking (`tsc --noEmit`)
2. Linting (`npm run lint`)
3. Tests with coverage (`npm run test:coverage`)
4. Build verification (`npm run build`)

Tests run on Node.js versions: 18.x, 20.x, 22.x

## Coverage Reports

After running `npm run test:coverage`:

- **Text**: Console output
- **HTML**: `coverage/index.html` (open in browser)
- **LCOV**: `coverage/lcov.info` (for CI tools)
- **JSON**: `coverage/coverage-final.json`

## Debugging Tests

### Run Specific Test File

```bash
npx vitest run src/utils/colors.test.ts
```

### Run Tests Matching Pattern

```bash
npx vitest run -t "should validate"
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test:watch"],
  "console": "integratedTerminal"
}
```

## Best Practices

1. **Arrange-Act-Assert**: Structure tests clearly
2. **User-Centric**: Test from user's perspective
3. **Isolation**: Each test should be independent
4. **Clear Names**: Describe what the test validates
5. **Mock Sparingly**: Only mock when necessary
6. **Async Handling**: Use `async/await` with user-event
7. **Accessibility**: Query by role, label, text (not test IDs)
8. **Edge Cases**: Test error states, empty states, boundaries

## Common Test Scenarios

### Form Validation
- Empty inputs
- Invalid inputs
- Valid inputs
- Error messages
- Success states

### User Interactions
- Button clicks
- Text input
- Form submission
- Keyboard navigation

### State Changes
- Component updates
- Conditional rendering
- Data persistence
- Context updates

### Error Handling
- Invalid data
- Network failures (if applicable)
- Edge cases
- Boundary conditions

## Troubleshooting

### Tests Timeout
- Increase timeout in test or vitest config
- Check for unresolved promises
- Verify async operations complete

### Can't Find Element
- Check if element is rendered conditionally
- Use `findBy` queries for async elements
- Verify query selectors are correct

### Mock Not Working
- Ensure mock is before import
- Check mock path is correct
- Verify vi.clearAllMocks() in afterEach

## Contributing

When adding new features:

1. Write tests first (TDD) or alongside code
2. Aim for 80%+ coverage on new code
3. Test happy path and error cases
4. Add edge case tests
5. Update this documentation if needed

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)
- [User Event API](https://testing-library.com/docs/user-event/intro)
