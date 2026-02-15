# Feature Guide - Cron Schedule Visualiser

## Quick Reference

### 🎨 Dark Mode
**Location**: Header (Sun/Moon icon)
**How to use**: Click the theme toggle button in the top-right corner
**Features**:
- Automatic persistence across sessions
- Smooth color transitions
- System-wide theme application

### 📅 Custom Date Ranges
**Location**: Time Range section (Custom button)
**How to use**:
1. Click "Custom" in the time range selector
2. Select start date and time
3. Select end date and time
4. Click "Apply"

**Validation**:
- Start date must be before end date
- Maximum range: 365 days
- Visual error messages for invalid inputs

### 📊 Statistics Dashboard
**Location**: Above timeline
**How to use**: Click "Show/Hide Statistics" to toggle
**Metrics Displayed**:
- Total executions in time range
- Average executions per day
- Busiest hour with count
- Total overlap conflicts
- Top 5 busiest hours
- Top 5 busiest days

### 📤 Export Options
**Location**: Timeline header (Export dropdown)
**How to use**: Click "Export" and select format
**Available Formats**:

1. **PNG Image**
   - High-quality 2x resolution
   - Perfect for documentation
   - Transparent background support

2. **SVG Vector**
   - Scalable without quality loss
   - Perfect for presentations
   - Editable in vector graphics software

3. **JSON Data**
   - Complete schedule data
   - Share with team members
   - Backup your configurations

### 📥 Import Schedules
**Location**: Below schedule input form
**How to use**:
1. Click "Import" button
2. Select a JSON file (previously exported)
3. Schedules will be loaded automatically

**File Format**:
```json
[
  {
    "id": "unique-id",
    "label": "Schedule Name",
    "cronExpression": "0 * * * *",
    "color": "#3B82F6"
  }
]
```

### 🔍 Zoom Controls
**Location**: Timeline header (Zoom controls)
**How to use**:
- Click `-` to zoom out (min: 50%)
- Click `+` to zoom in (max: 300%)
- Click "Reset" to return to 100%

**Tips**:
- Zoom helps inspect dense timelines
- Horizontal scroll appears when zoomed
- Zoom percentage displayed in controls

### 💾 Automatic Persistence
**What's Saved**:
- All schedules
- Time range selection
- Theme preference (dark/light)
- Time format preference (12h/24h)

**How it works**:
- Automatic save on every change
- Automatic restore on page load
- Uses browser localStorage
- No account required

### ⏰ Time Format
**Location**: Time Range section (12h/24h buttons)
**Options**:
- **12h**: 2:00 PM format
- **24h**: 14:00 format

### 📱 Mobile Features
**Optimizations**:
- Responsive layouts for all screen sizes
- Touch-friendly buttons
- Horizontal timeline scrolling
- Stacked controls on small screens
- Optimized typography and spacing

## Keyboard Shortcuts

Currently implemented:
- `Tab`: Navigate between form fields
- `Enter`: Submit schedule form
- `Escape`: Close custom date picker modal

## Tips & Tricks

### Efficient Schedule Management
1. Use descriptive labels for quick identification
2. Export schedules regularly for backup
3. Use custom date ranges for specific planning periods
4. Check statistics to identify busy periods

### Timeline Visualization
1. Hover over execution bars for exact timestamps
2. Red overlaps indicate scheduling conflicts
3. Zoom in for detailed inspection of busy periods
4. Use different time ranges to see patterns

### Dark Mode Benefits
1. Reduces eye strain in low-light environments
2. Saves battery on OLED screens
3. Professional appearance for presentations

### Export Best Practices
1. **PNG**: Best for quick sharing and documentation
2. **SVG**: Best for presentations and printed materials
3. **JSON**: Essential for backup and team collaboration

## Troubleshooting

### Timeline Not Showing Executions
- Verify cron expression is valid
- Check selected time range includes execution times
- Try a longer time range (7 days or 30 days)

### Export Not Working
- Ensure browser allows downloads
- Check browser console for error messages
- Try different export format

### Import Failed
- Verify JSON file format matches expected structure
- Check file is valid JSON
- Ensure all required fields are present

### Dark Mode Not Persisting
- Check browser allows localStorage
- Clear browser cache and try again
- Disable private/incognito mode

### Mobile Layout Issues
- Rotate device to landscape for more space
- Use zoom controls for detailed inspection
- Scroll horizontally on timeline if needed

## Browser Requirements

### Minimum Versions
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari 14+

### Required Features
- JavaScript enabled
- LocalStorage enabled
- Modern CSS support (Grid, Flexbox)
- ES2020+ JavaScript features

## Accessibility Features

- Semantic HTML elements
- ARIA labels on interactive elements
- Keyboard navigation support
- High contrast in both themes
- Responsive text sizing
- Clear error messages
- Visual feedback on interactions

## Performance Tips

### For Large Schedule Lists
1. Use time ranges to limit executions displayed
2. Remove unused schedules
3. Export to JSON and start fresh if needed

### For Optimal Experience
1. Use modern browser (latest version)
2. Close unnecessary browser tabs
3. Enable hardware acceleration
4. Use wired connection for large exports

## Privacy & Data

### What's Stored Locally
- Schedule data (cron expressions, labels)
- User preferences (theme, time format)
- Time range selection

### What's NOT Stored
- No server storage
- No user accounts
- No tracking or analytics
- No third-party data sharing

### Data Control
- All data in your browser
- Clear via browser settings
- Export for backup
- No cloud dependency

## Support

For issues or feature requests:
1. Check this documentation
2. Review implementation summary
3. Check browser console for errors
4. Verify browser compatibility

## Credits

Built with:
- React 18.2
- TypeScript 5.2
- Tailwind CSS 3.4
- Vite 5.2
- cron-parser 4.9
- html2canvas 1.4
