# Commissable CRM

A modern Customer Relationship Management (CRM) system built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- **Modern UI/UX**: Clean, responsive design matching the original Commissable CRM screenshots
- **Dynamic Tables**: Resizable and sortable columns with drag-and-drop reordering
- **Dashboard**: Overview of key metrics and recent activities
- **Accounts Management**: Comprehensive account listing with filtering and search
- **Contacts Management**: Contact management with detailed information
- **Navigation**: Collapsible sidebar navigation with all CRM modules
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Components**: Custom components with accessibility support

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd commissable-crm
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
commissable-crm/
├── app/                    # Next.js App Router pages
│   ├── (dashboard)/       # Dashboard layout group
│   │   ├── accounts/      # Accounts page
│   │   ├── contacts/      # Contacts page
│   │   ├── opportunities/ # Opportunities page
│   │   └── ...           # Other CRM pages
│   ├── globals.css       # Global styles
│   └── layout.tsx        # Root layout
├── components/            # Reusable components
│   ├── sidebar.tsx       # Navigation sidebar
│   ├── topbar.tsx        # Header bar
│   ├── list-header.tsx   # Filter/search controls
│   └── dynamic-table.tsx # Resizable data table
├── lib/                  # Utilities and configurations
│   ├── nav.ts           # Navigation configuration
│   ├── utils.ts         # Utility functions
│   └── mock-data.ts     # Sample data
└── ...
```

## Key Components

### Dynamic Table
The `DynamicTable` component provides:
- **Resizable columns**: Drag column borders to resize
- **Column reordering**: Drag column headers to reorder
- **Sorting**: Click headers to sort data
- **Custom cell types**: Toggle switches, checkboxes, links, etc.
- **Responsive design**: Horizontal scroll on smaller screens

### Navigation
- **Collapsible sidebar**: Toggle between expanded and collapsed states
- **Active states**: Visual indicators for current page
- **Icons**: Lucide React icons for all navigation items
- **Responsive**: Adapts to different screen sizes

### Filtering & Search
- **Real-time search**: Filter data as you type
- **Column-based filtering**: Filter by specific columns
- **Active/All toggles**: Quick filter states
- **Pagination**: Navigate through large datasets

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Customization

### Colors
Brand colors can be customized in `tailwind.config.ts`:
```typescript
colors: {
  primary: {
    900: '#0A3B91', // Brand blue
    // ... other shades
  },
  sidebar: {
    DEFAULT: '#0A3B91',
    dark: '#082f7a',
  }
}
```

### Navigation
Add or modify navigation items in `lib/nav.ts`:
```typescript
export const navigation: NavItem[] = [
  { name: 'New Module', href: '/new-module', icon: YourIcon },
  // ... existing items
]
```

### Mock Data
Sample data is provided in `lib/mock-data.ts`. Replace with real API calls in production.

## Production Deployment

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm run start
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
