# Complete Plan to Address Console Errors

## **Issue Summary**
1. **403 Forbidden Error**: `useSystemSettings` hook trying to access system settings without proper permission handling
2. **Image Aspect Ratio Warning**: Logo images in sidebar not maintaining proper aspect ratio
3. **React DevTools Suggestion**: Development-only message (non-critical)

## **Root Cause Analysis**
- The `useSystemSettings` hook is called by `CopyProtectionWrapper` component, which is likely used throughout the app
- Non-admin users don't have `system.settings.read` permission, causing 403 errors
- The hook doesn't gracefully handle permission failures
- Image components have fixed dimensions but CSS might be modifying them

## **Comprehensive Solution Plan**

### **Phase 1: Fix System Settings Permission Handling**

#### **1.1 Update `useSystemSettings` Hook**
```typescript:hooks/useSystemSettings.ts
// ... existing code ...
const loadSettings = useCallback(async () => {
  if (!user) {
    setLoading(false)
    return
  }

  // Check if user has permission to read system settings
  const hasPermission = user.role?.permissions?.some(p => p.code === 'system.settings.read')
  
  if (!hasPermission) {
    // User doesn't have permission - set empty settings and stop loading
    setSettings({})
    setLoading(false)
    return
  }

  try {
    setLoading(true)
    setError(null)

    const response = await fetch('/api/system-settings', {
      cache: 'no-store'
    })

    if (!response.ok) {
      if (response.status === 403) {
        // Fallback: User lost permission during session
        setSettings({})
        return
      }
      throw new Error('Failed to load system settings')
    }

    const data = await response.json()
    setSettings(data.data || {})
  } catch (err) {
    console.error('Failed to load system settings:', err)
    setError(err instanceof Error ? err.message : 'Failed to load system settings')
  } finally {
    setLoading(false)
  }
}, [user])
```

#### **1.2 Update `CopyProtectionWrapper` Component**
```typescript:components/copy-protection.tsx
// ... existing code ...
export function CopyProtectionWrapper({ children, className = "" }: CopyProtectionWrapperProps) {
  const { user } = useAuth()
  const { isCopyProtectionEnabled, loading, error } = useSystemSettings()
  const containerRef = useRef<HTMLDivElement>(null)

  // Check if copy protection should be enabled
  // Fallback to role-based check if system settings fail to load
  const shouldEnableCopyProtection = loading 
    ? user?.role?.code === 'Accounting' // Fallback during loading
    : isCopyProtectionEnabled

  // ... rest of component remains the same ...
}
```

### **Phase 2: Fix Image Aspect Ratio Issues**

#### **2.1 Update Sidebar Logo Images**
```typescript:components/sidebar.tsx
// ... existing code ...
<Image 
  src="/commissable-logo.png" 
  alt="Commissable Logo" 
  width={24} 
  height={24}
  className="object-contain"
  style={{ width: 'auto', height: 'auto' }}
/>

// ... and for the second logo ...
<Image 
  src="/commissable-logo.png" 
  alt="Commissable Logo" 
  width={20} 
  height={20}
  className="object-contain"
  style={{ width: 'auto', height: 'auto' }}
/>
```

### **Phase 3: Add Error Boundary for System Settings**

#### **3.1 Create System Settings Error Boundary**
```typescript:components/system-settings-error-boundary.tsx
"use client"

import React from 'react'

interface SystemSettingsErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function SystemSettingsErrorBoundary({ 
  children, 
  fallback = null 
}: SystemSettingsErrorBoundaryProps) {
  return (
    <React.Suspense fallback={fallback}>
      {children}
    </React.Suspense>
  )
}
```

### **Phase 4: Update System Settings Page**

#### **4.1 Add Better Error Handling**
```typescript:app/(dashboard)/admin/settings/page.tsx
// ... existing code ...
if (error) {
  return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-red-800">Error Loading Settings</h2>
        <p className="text-red-600">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
```

### **Phase 5: Add Permission-Based Conditional Loading**

#### **5.1 Create Permission-Aware System Settings Hook**
```typescript:hooks/useSystemSettings.ts
// Add this new function
export function useSystemSettingsWithPermission() {
  const { user } = useAuth()
  const hasPermission = user?.role?.permissions?.some(p => p.code === 'system.settings.read')
  
  return {
    hasPermission,
    ...useSystemSettings()
  }
}
```

### **Phase 6: Update Components to Use Permission-Aware Hook**

#### **6.1 Update Copy Protection Component**
```typescript:components/copy-protection.tsx
// ... existing code ...
export function CopyProtectionWrapper({ children, className = "" }: CopyProtectionWrapperProps) {
  const { user } = useAuth()
  const { hasPermission, isCopyProtectionEnabled, loading } = useSystemSettingsWithPermission()
  const containerRef = useRef<HTMLDivElement>(null)

  // Check if copy protection should be enabled
  const shouldEnableCopyProtection = hasPermission 
    ? isCopyProtectionEnabled 
    : user?.role?.code === 'Accounting' // Fallback for non-admin users

  // ... rest of component remains the same ...
}
```

## **Implementation Priority**

### **High Priority (Immediate)**
1. ✅ Fix `useSystemSettings` hook permission handling
2. ✅ Fix image aspect ratio warnings
3. ✅ Update `CopyProtectionWrapper` to handle permission failures

### **Medium Priority (Next)**
4. Add error boundary for system settings
5. Improve error handling in system settings page
6. Add retry mechanisms

### **Low Priority (Future)**
7. Add permission-aware hook variants
8. Add comprehensive logging for permission failures
9. Add user feedback for permission-related issues

## **Testing Plan**

### **Test Cases**
1. **Admin User**: Should load system settings successfully
2. **Non-Admin User**: Should not attempt to load system settings, no 403 errors
3. **Accounting Role**: Should have copy protection enabled regardless of system settings
4. **Image Loading**: Should not show aspect ratio warnings
5. **Permission Changes**: Should handle permission changes during session

### **Verification Steps**
1. Check browser console for 403 errors (should be eliminated)
2. Check browser console for image warnings (should be eliminated)
3. Verify copy protection works for Accounting role users
4. Verify system settings page works for Admin users
5. Verify non-admin users can use the app without system settings errors

## **Expected Outcomes**

After implementing this plan:
- ✅ No more 403 Forbidden errors in console
- ✅ No more image aspect ratio warnings
- ✅ Copy protection works correctly for all user roles
- ✅ System settings page works for Admin users
- ✅ Non-admin users can use the app without permission-related errors
- ✅ Better error handling and user experience
- ✅ Graceful fallbacks for permission failures

Would you like me to implement any specific part of this plan first?