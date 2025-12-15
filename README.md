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
  app/                    # Next.js App Router pages
    (dashboard)/          # Dashboard layout group
      accounts/           # Accounts page
      contacts/           # Contacts page
      opportunities/      # Opportunities page
      ...                 # Other CRM pages
    globals.css           # Global styles
    layout.tsx            # Root layout
  components/             # Reusable components
    sidebar.tsx           # Navigation sidebar
    topbar.tsx            # Header bar
    list-header.tsx       # Filter/search controls
    dynamic-table.tsx     # Resizable data table
  lib/                    # Utilities and configurations
    nav.ts                # Navigation configuration
    utils.ts              # Utility functions
    mock-data.ts          # Sample data
  docs/                   # Project documentation (see index below)
  playground/             # Dev-only mockups, experiments
```

## Documentation Index

- `docs/plans/` – Implementation plans, rollout strategies, milestone plans
- `docs/specs/` – Feature specs, data model designs, UI/UX and behavior docs
- `docs/runbooks/` – Deployment, local dev, database, and troubleshooting guides
- `docs/notes/` – Meeting notes, status summaries, exploratory notes
- `docs/incidents/` – Security reviews, production/debugging incident writeups
- `docs/tasks/` – Checklists, task lists, and to-do style documents
- `docs/reference-data/` – Reference files such as vendor/distributor mapping CSVs

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
