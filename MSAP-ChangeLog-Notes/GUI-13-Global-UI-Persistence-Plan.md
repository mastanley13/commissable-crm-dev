# GUI-13: Global UI Platform Persistence Implementation Plan

## Project Requirement
**GUI-13 Global UI Platform UI Persistence**: Per-user persistence for columns, widths, sorts, filters, toggles, and per-page settings across sessions.

**Current Status**: Not Completed - Only column order/width persist; filters, sorts, and toggles are not saved per user.

**Acceptance Criteria**: All user interface customizations persist across sessions:
- Column selections and order
- Column widths  
- Sort preferences
- Filter selections
- View toggle states
- Records per page setting

## Current State Analysis

### ✅ **What Currently Exists - Strong Foundation**

#### **1. Comprehensive Table Persistence System**
- **`hooks/useTablePreferences.ts`**: Sophisticated state management hook
  - User-specific preferences per page
  - Server-side persistence with database storage
  - Real-time change tracking with debouncing
  - Manual and auto-save functionality
  - Error handling and fallback mechanisms

#### **2. Column Management (Fully Implemented)**
- **Column Order & Selection**: ✅ Complete
  - `components/column-chooser.tsx` - Multiple UI approaches
  - `components/column-settings-modal.tsx` - Modal interface
  - `components/column-chooser-modal.tsx` - Advanced selector
  - Drag-and-drop reordering
  - Show/hide column functionality
  - Required columns protection

- **Column Widths**: ✅ Complete
  - Manual resizing with mouse drag
  - Double-click auto-fit functionality
  - Minimum and maximum width constraints
  - Integer width normalization
  - Real-time persistence with debouncing

#### **3. Database & API Infrastructure**
- **`app/api/table-preferences/[pageKey]/route.ts`**: ✅ Complete
  - Full CRUD API with Prisma ORM
  - User-scoped preferences storage
  - Multi-tenant support
  - Atomic upsert operations
  - Placeholder support for missing features

#### **4. Visual Feedback System**
- **`components/table-change-notification.tsx`**: ✅ Complete
  - Real-time save state indication
  - Unsaved changes tracking
  - Manual save trigger functionality
  - Last saved timestamp display

#### **5. Core Dynamic Table Component**
- **`components/dynamic-table.tsx`**: ✅ Robust foundation
  - Integrates all persistence features
  - Used across dashboard pages
  - Professional UX patterns

### ❌ **What's Missing - Implementation Gaps**

#### **1. Sort State Persistence** 
- **Status**: Not Implemented
- **Database Support**: ✅ Schema ready (`sortState` field exists)
- **API Support**: ✅ Placeholder ready in endpoints
- **UI Integration**: ❌ Missing

#### **2. Filter State Persistence**
- **Status**: Not Implemented  
- **Database Support**: ✅ Schema ready (`filters` field exists)
- **API Support**: ✅ Placeholder ready in endpoints
- **UI Integration**: ❌ Missing

#### **3. View Toggle State Persistence**
- **Status**: Not Implemented
- **Examples**: Show Inactive toggle, Active/Show All toggles
- **Current Behavior**: Resets to default on page reload

#### **4. Records Per Page Settings**
- **Status**: Partially Implemented
- **UI Controls**: ✅ Present (dropdown for 10/25/50/100)
- **Persistence**: ❌ Not connected to user preferences

#### **5. Local Storage Optimization**
- **Status**: Not Implemented
- **Current**: All persistence goes directly to server
- **Opportunity**: Local caching for immediate response

## Implementation Plan

### **Phase 1: Complete Missing Persistence Features (Priority: High)**

#### **Task 1.1: Implement Sort State Persistence**
**Target Files**:
- `hooks/useTablePreferences.ts`
- `components/dynamic-table.tsx`
- All dashboard pages using dynamic tables

**Implementation Steps**:
1. **Extend useTablePreferences Hook**:
   ```typescript
   interface TablePreferences {
     // ... existing fields
     sortState?: {
       column: string;
       direction: 'asc' | 'desc';
     } | null;
   }
   ```

2. **Add Sort State Management**:
   - Track current sort column and direction
   - Persist changes with debouncing
   - Restore sort state on component mount
   - Handle sort state clearing (third click)

3. **Integrate with Dynamic Table**:
   - Update sort indicators based on persisted state
   - Trigger persistence on sort changes
   - Ensure sort state matches visual indicators

4. **Update API Layer**:
   - Extend table-preferences API to handle sortState
   - Validate sort parameters
   - Include in preference response

**Acceptance Criteria**:
- [ ] Sort column and direction persist across sessions
- [ ] Sort indicators show correct state on page load
- [ ] Third click properly clears sort and persists empty state
- [ ] Sort state independent per page/view

#### **Task 1.2: Implement Filter State Persistence**
**Target Files**:
- `hooks/useTablePreferences.ts`
- `components/list-header.tsx` 
- Filter-related components

**Implementation Steps**:
1. **Define Filter State Structure**:
   ```typescript
   interface FilterState {
     searchQuery?: string;
     columnFilters?: Array<{
       columnId: string;
       value: string | string[];
       operator?: 'equals' | 'contains' | 'in';
     }>;
   }
   ```

2. **Extend Preferences Hook**:
   - Add filter state management
   - Persist filter changes with debouncing
   - Restore filters on component mount
   - Handle filter clearing

3. **Integrate with List Header Component**:
   - Apply persisted search query on load
   - Restore column filter selections
   - Update filter tags from persisted state
   - Persist changes when filters applied/removed

4. **Update API Integration**:
   - Store/retrieve filter state via preferences API
   - Validate filter structure
   - Handle filter state migrations

**Acceptance Criteria**:
- [ ] Search queries persist across sessions
- [ ] Applied column filters restore with correct tags
- [ ] Filter combinations (AND logic) persist correctly
- [ ] Filter clear operations update persistence
- [ ] Filter state independent per page/view

#### **Task 1.3: Implement View Toggle State Persistence**
**Target Files**:
- `hooks/useTablePreferences.ts`
- `components/list-header.tsx`
- All pages with Show Inactive toggles

**Implementation Steps**:
1. **Define Toggle State Structure**:
   ```typescript
   interface ViewToggles {
     showInactive?: boolean;
     // Future toggles can be added here
   }
   ```

2. **Add Toggle State Management**:
   - Track toggle states in preferences hook
   - Persist toggle changes immediately
   - Restore toggle states on mount
   - Default to specification requirements (Active only)

3. **Update List Header Components**:
   - Apply persisted toggle state on load
   - Update data filtering based on persisted state
   - Persist changes when toggles clicked

4. **Ensure Consistency Across Pages**:
   - Same toggle behavior on all list pages
   - Independent toggle state per page
   - Proper integration with existing Active/Show All controls

**Acceptance Criteria**:
- [ ] Show Inactive toggle state persists across sessions
- [ ] Default state matches specification (Active only)
- [ ] Toggle state independent per page/view
- [ ] Data filtering respects persisted toggle state on load

#### **Task 1.4: Complete Records Per Page Persistence**
**Target Files**:
- `hooks/useTablePreferences.ts`
- `components/dynamic-table.tsx`

**Implementation Steps**:
1. **Add Records Per Page to Preferences**:
   ```typescript
   interface TablePreferences {
     // ... existing fields
     recordsPerPage?: 10 | 25 | 50 | 100;
   }
   ```

2. **Connect UI to Persistence**:
   - Link existing dropdown to preferences hook
   - Restore selected value on page load
   - Persist changes when selection changes
   - Default to 200 per page (per specification)

3. **Update Table Pagination**:
   - Use persisted value for pagination logic
   - Update page size when preference changes
   - Handle current page adjustment on size change

**Acceptance Criteria**:
- [ ] Records per page selection persists across sessions
- [ ] Default to 200 per page (specification requirement)
- [ ] Pagination adjusts correctly when preference restored
- [ ] Records per page independent per page/view

### **Phase 2: Performance & UX Enhancements (Priority: Medium)**

#### **Task 2.1: Add Local Storage Caching**
**Target Files**:
- `hooks/useTablePreferences.ts`
- New: `utils/localStorage.ts`

**Implementation Steps**:
1. **Create Local Storage Utility**:
   - Safe localStorage wrapper with fallbacks
   - Automatic cache invalidation
   - User-scoped cache keys

2. **Implement Hybrid Persistence**:
   - Cache preferences locally for immediate load
   - Sync with server in background
   - Use local cache when server unavailable
   - Merge conflicts resolution

3. **Add Cache Management**:
   - Cache invalidation on user changes
   - Periodic cache refresh
   - Clear cache on logout

**Benefits**:
- Instant UI state restoration
- Improved perceived performance
- Better offline experience
- Reduced server load

#### **Task 2.2: Enhance Persistence Feedback**
**Target Files**:
- `components/table-change-notification.tsx`
- `hooks/useTablePreferences.ts`

**Implementation Steps**:
1. **Expand Notification Component**:
   - Show which specific settings are being saved
   - Display sync status with server
   - Show local vs server state conflicts

2. **Add Persistence Indicators**:
   - Visual indicators for actively persisted features
   - Loading states during persistence operations
   - Error states with retry options

3. **Improve User Feedback**:
   - Toast notifications for successful saves
   - Warning messages for persistence failures
   - Clear messaging about what will persist

### **Phase 3: Advanced Persistence Features (Priority: Low)**

#### **Task 3.1: Preference Templates & Presets**
**Implementation Steps**:
1. **Add Preset System**:
   - Save current preferences as named preset
   - Quick apply preset functionality
   - Share presets between users (admin feature)

2. **Create Default Templates**:
   - Module-specific default views
   - Role-based default preferences
   - Industry-specific templates

#### **Task 3.2: Preference Import/Export**
**Implementation Steps**:
1. **Add Export Functionality**:
   - Export user preferences as JSON
   - Bulk export for admin users
   - Backup/restore capabilities

2. **Add Import Features**:
   - Import preference sets
   - Merge with existing preferences
   - Validation and conflict resolution

## Technical Implementation Details

### **Database Schema (Already Exists)**
```typescript
// table_preferences table via Prisma
interface TablePreference {
  id: string;
  userId: string;
  pageKey: string;
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
  sortState?: unknown;      // Ready for implementation
  filters?: unknown;        // Ready for implementation  
  viewToggles?: unknown;    // New field needed
  recordsPerPage?: number;  // New field needed
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

### **API Endpoints (Ready)**
- **GET/POST** `/api/table-preferences/[pageKey]`
- Supports all preference types
- User-scoped with proper authentication
- Atomic upsert operations

### **Hook Interface Extension**
```typescript
interface UseTablePreferencesReturn {
  // Existing column features...
  
  // New persistence features
  sortState: SortState | null;
  setSortState: (state: SortState | null) => void;
  
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  
  viewToggles: ViewToggles;
  setViewToggles: (toggles: ViewToggles) => void;
  
  recordsPerPage: number;
  setRecordsPerPage: (size: number) => void;
}
```

### **Page Key Strategy (Established)**
Current page keys follow pattern: `"moduleName:viewType"`
- `"accounts:list"`
- `"contacts:list"` 
- `"accounts:detail:contacts"`
- `"accounts:detail:opportunities"`

This allows independent preferences per view context.

## Success Criteria

### **Phase 1 Success Metrics**
- [ ] **Sort State Persistence**: Sort column/direction persists across sessions
- [ ] **Filter State Persistence**: Search queries and column filters restore correctly
- [ ] **View Toggle Persistence**: Show Inactive toggle state persists per page
- [ ] **Records Per Page Persistence**: Page size selection persists across sessions
- [ ] **All Features Independent**: Each page/view maintains separate preference state
- [ ] **Performance**: Preferences restore within 100ms of page load
- [ ] **Reliability**: 99.9% successful persistence operations

### **Phase 2 Success Metrics**  
- [ ] **Local Caching**: Instant UI state restoration with local cache
- [ ] **Enhanced Feedback**: Clear user messaging about persistence status
- [ ] **Error Handling**: Graceful degradation when persistence fails
- [ ] **Offline Support**: Preferences work when server unavailable

### **Phase 3 Success Metrics**
- [ ] **Preset System**: Users can save and apply named preference sets
- [ ] **Import/Export**: Administrators can backup and restore preferences
- [ ] **Templates**: Role-based and module-specific default preferences

## Key Considerations

### **Consistency with Existing System**
- Use established `useTablePreferences` hook pattern
- Follow existing database schema design
- Maintain current API endpoint structure
- Preserve existing UX patterns

### **Performance Optimization**
- Continue using debounced persistence (established pattern)
- Implement local caching for immediate response
- Batch multiple preference changes
- Optimize database queries

### **User Experience**
- Maintain current visual feedback system
- Ensure graceful degradation when features fail
- Provide clear messaging about what persists
- Follow established UI patterns

### **Data Migration**
- Extend existing database schema (add new optional fields)
- Maintain backward compatibility
- Handle preference upgrades gracefully
- Preserve existing user preferences

## Risk Mitigation

### **Technical Risks**
- **Database Schema Changes**: Use optional fields to maintain compatibility
- **Performance Impact**: Implement local caching and debouncing
- **State Management Complexity**: Build on proven `useTablePreferences` foundation

### **User Experience Risks**
- **Overwhelming Complexity**: Implement progressively with clear defaults
- **Inconsistent Behavior**: Follow established patterns across all pages
- **Data Loss**: Implement backup/restore capabilities

## Timeline Estimate

- **Phase 1**: 3-4 weeks (High Priority)
  - Sort State: 1 week
  - Filter State: 1.5 weeks  
  - View Toggles: 0.5 weeks
  - Records Per Page: 1 week

- **Phase 2**: 2-3 weeks (Medium Priority)
  - Local Caching: 1.5 weeks
  - Enhanced Feedback: 1.5 weeks

- **Phase 3**: 2-3 weeks (Low Priority)
  - Presets: 1.5 weeks
  - Import/Export: 1.5 weeks

**Total Estimate**: 7-10 weeks for complete implementation

## Conclusion

The Commissable CRM has an **excellent foundation** for GUI-13 implementation with a sophisticated column management and table persistence system already in place. The existing `useTablePreferences` hook, database schema, and API endpoints provide a proven architecture that needs only to be extended to cover the missing persistence features.

**Key Strengths**:
- Professional-grade column management system
- Server-side persistence with proper user scoping
- Debounced updates and error handling
- Visual feedback system
- Multi-tenant support

**Implementation Strategy**:
- Build on existing proven patterns
- Extend current hook and API endpoints
- Maintain backward compatibility
- Follow established UX patterns

This approach ensures **consistent, reliable persistence** across all UI customizations while leveraging the substantial investment already made in the table preference system.