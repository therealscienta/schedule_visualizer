# Changelog

All notable changes to the Cron Schedule Visualiser project.

## [2.0.0] - 2026-02-07

### Added - Major Feature Release

#### 1. LocalStorage Persistence
- Automatic saving and restoration of all schedules across browser sessions
- Time range selection persistence
- Graceful fallback to default schedules on first load
- Error handling for corrupted localStorage data

#### 2. Dark Mode Support
- System-wide dark theme with toggle button in header
- Automatic persistence of theme preference
- Smooth color transitions between light and dark modes
- All components fully styled for both themes
- WCAG-compliant color contrast ratios

#### 3. Custom Date Ranges
- Interactive custom date range picker modal
- Start and end date/time selection
- Validation (start < end, max 365 days)
- Visual error feedback
- Click-outside-to-close functionality
- Seamless integration with existing time range options

#### 4. Statistics Dashboard
- Comprehensive statistics panel above timeline
- Key metrics: total executions, average per day, busiest hour, total overlaps
- Top 5 busiest hours with execution counts
- Top 5 busiest days with execution counts
- Color-coded metric cards for quick scanning
- Toggle visibility to save screen space
- Fully responsive grid layout

#### 5. Export Functionality
- Export timeline as high-quality PNG image (2x resolution)
- Export timeline as scalable SVG vector graphic
- Export schedules as JSON for backup and sharing
- Dropdown menu with visual icons
- Loading states during export
- Automatic file downloads with timestamps
- Click-outside-to-close menu behavior

#### 6. Import Functionality
- Import schedules from JSON files
- JSON format validation
- Schedule structure validation
- User feedback with success/error alerts
- File input with styled button

#### 7. Zoom Controls
- Zoom in/out controls for timeline (50% to 300%)
- Visual zoom percentage display
- Reset button when not at 100%
- Smooth CSS transitions
- Horizontal scrolling when zoomed
- Mobile-optimized zoom controls

#### 8. Mobile Optimization
- Fully responsive design for all screen sizes
- Mobile-first Tailwind CSS breakpoints
- Touch-friendly button sizes
- Horizontal scrolling for timeline
- Stacked controls on small screens
- Optimized typography and spacing
- Flexible layouts that adapt to viewport

#### 9. Time Format Selection
- Toggle between 12-hour (AM/PM) and 24-hour formats
- Persistent preference across sessions
- Applied to all timestamp displays throughout the app

### Changed

#### Component Updates
- `App.tsx`: Major refactoring with new state management for all features
- `Timeline.tsx`: Added statistics integration, export menu, zoom controls
- `TimeRangeSelector.tsx`: Added custom range option trigger
- `ScheduleInput.tsx`: Enhanced with dark mode styling
- `ScheduleList.tsx`: Enhanced with dark mode styling

#### Architecture Improvements
- Added Settings Context for global theme and format preferences
- Improved state management with proper useEffect hooks
- Enhanced type safety with new TypeScript interfaces
- Better component composition and separation of concerns

#### Styling Updates
- All components updated with dark mode classes
- Improved mobile responsiveness across all components
- Enhanced hover states and transitions
- Better visual hierarchy with consistent spacing

### Technical Details

#### New Files Created
- `/src/components/CustomDateRangePicker.tsx` - Custom date range modal
- `/src/components/StatisticsPanel.tsx` - Statistics dashboard
- `/src/components/ExportMenu.tsx` - Export dropdown menu
- `/src/components/ImportSchedules.tsx` - Import functionality
- `/src/contexts/SettingsContext.tsx` - Global settings context
- `/src/utils/exportTimeline.ts` - Export utility functions
- `/IMPLEMENTATION_SUMMARY.md` - Technical implementation details
- `/FEATURES.md` - User-facing feature documentation
- `/CHANGELOG.md` - This file

#### Dependencies Added
- `html2canvas@^1.4.1` - For PNG export functionality

#### Build Configuration
- Updated `tsconfig.json` to exclude test files from build
- Maintained strict TypeScript mode
- All new code fully type-safe

#### Performance Optimizations
- `useMemo` hooks for expensive calculations
- Efficient O(n) algorithms for statistics
- Memoized date calculations
- Optimized re-renders with proper React patterns

### Security
- All data stored locally in browser (no server transmission)
- No external API calls or third-party tracking
- JSON validation on import to prevent malformed data
- Safe file download mechanisms

### Accessibility
- Semantic HTML elements throughout
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus management in modals
- High contrast in both themes
- Screen reader friendly

### Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari 14+
- Chrome Android 90+

### Known Issues
- SVG export uses foreignObject which may have limited browser support
- Native datetime-local input appearance varies by browser
- Timeline requires horizontal scrolling when zoomed on mobile

### Migration Guide from v1.0

No migration needed. The application automatically:
1. Loads existing schedules if localStorage is empty
2. Sets default preferences for new users
3. Maintains backward compatibility

Users with existing schedules in browser (if any) will need to:
1. Re-add their schedules (one-time only)
2. Use the new import feature if they had exported data

---

## [1.0.0] - Initial Release

### Initial Features
- Add multiple cron expressions with custom labels
- Visualize schedules on interactive timeline
- Identify execution overlaps
- Switch between 24h, 7d, 30d time ranges
- See execution counts for each schedule
- Default example schedules
- Cron expression validation
- Color-coded schedule indicators
- Hover tooltips for execution details
- Responsive design for desktop

### Technology Stack
- React 18.2
- TypeScript 5.2 (strict mode)
- Vite 5.2
- Tailwind CSS 3.4
- cron-parser 4.9

### Architecture
- Component-based architecture
- Type-safe TypeScript throughout
- Immutable state updates
- Utility modules for logic separation
- Performance optimizations with useMemo

---

## Version Numbering

This project follows [Semantic Versioning](https://semver.org/):
- MAJOR version for incompatible API changes
- MINOR version for new functionality in a backward compatible manner
- PATCH version for backward compatible bug fixes

## Release Schedule

- Major releases: As needed for significant new features
- Minor releases: Monthly for feature additions
- Patch releases: As needed for bug fixes

## Contributing

Future contributions will follow the established patterns:
- TypeScript strict mode required
- Comprehensive type annotations
- Immutable state updates
- Performance considerations (useMemo, useCallback)
- Responsive design (mobile-first)
- Dark mode support for all new components
- Accessibility considerations (ARIA, semantic HTML)

## Roadmap

See `CLAUDE.md` for future enhancement plans including:
- Backend integration for cloud storage
- Collaborative editing
- Schedule templates
- Advanced filtering
- CI/CD system integration
