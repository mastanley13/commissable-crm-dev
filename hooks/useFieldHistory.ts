import { useEffect, useState } from 'react'

interface FieldLastEdit {
  date: string
  user: string
}

interface AuditLogResponse {
  id: string
  createdAt: string
  userName: string | null
  changedFields: Record<string, { from: any; to: any }> | null
}

/**
 * Hook to fetch last edit information for specific fields from audit logs
 */
export function useFieldHistory(entityName: string, entityId: string, fieldLabels: string[]) {
  const [fieldHistory, setFieldHistory] = useState<Record<string, FieldLastEdit>>({})
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!entityName || !entityId || fieldLabels.length === 0) {
      return
    }

    const fetchFieldHistory = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/audit-logs?entityName=${entityName}&entityId=${entityId}&pageSize=50`
        )

        if (!response.ok) {
          console.error('Failed to fetch field history:', response.status)
          return
        }

        const data = await response.json()
        const logs: AuditLogResponse[] = data.data || []

        // Build a map of field name to last edit info
        const history: Record<string, FieldLastEdit> = {}

        // Process logs in chronological order (newest first)
        for (const log of logs) {
          if (!log.changedFields) continue

          // Check each field we're interested in
          for (const fieldLabel of fieldLabels) {
            // Skip if we already found this field's last edit
            if (history[fieldLabel]) continue

            // Check if this log contains changes to this field
            if (fieldLabel in log.changedFields) {
              history[fieldLabel] = {
                date: new Date(log.createdAt).toLocaleString('en-US', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                user: log.userName || 'System'
              }
            }
          }

          // If we've found all fields, we can stop
          if (Object.keys(history).length === fieldLabels.length) {
            break
          }
        }

        setFieldHistory(history)
      } catch (error) {
        console.error('Error fetching field history:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchFieldHistory()
  }, [entityName, entityId, fieldLabels.join(',')])

  return { fieldHistory, isLoading }
}
