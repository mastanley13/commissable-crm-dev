import { Activity, ActivityStatus } from '@prisma/client'

type ActivityWorkflowListener = (payload: ActivityWorkflowPayload) => Promise<void> | void

type ActivityStatusListener = (payload: ActivityStatusChangePayload) => Promise<void> | void

type FollowUpListener = (payload: ActivityStatusChangePayload) => Promise<void> | void

export interface ActivityWorkflowPayload {
  activity: Activity
  tenantId: string
  userId: string
}

export interface ActivityStatusChangePayload extends ActivityWorkflowPayload {
  previousStatus: ActivityStatus
  currentStatus: ActivityStatus
}

const activityCreatedListeners: ActivityWorkflowListener[] = []
const activityStatusListeners: ActivityStatusListener[] = []
const followUpListeners: FollowUpListener[] = []

export function registerActivityCreatedHook(listener: ActivityWorkflowListener) {
  activityCreatedListeners.push(listener)
}

export function registerActivityStatusHook(listener: ActivityStatusListener) {
  activityStatusListeners.push(listener)
}

export function registerFollowUpHook(listener: FollowUpListener) {
  followUpListeners.push(listener)
}

export async function triggerActivityCreated(payload: ActivityWorkflowPayload) {
  for (const listener of activityCreatedListeners) {
    try {
      await listener(payload)
    } catch (error) {
      console.warn('Activity created workflow listener failed', error)
    }
  }
}

export async function triggerActivityStatusChanged(payload: ActivityStatusChangePayload) {
  for (const listener of activityStatusListeners) {
    try {
      await listener(payload)
    } catch (error) {
      console.warn('Activity status workflow listener failed', error)
    }
  }

  if (payload.currentStatus === ActivityStatus.Completed) {
    for (const listener of followUpListeners) {
      try {
        await listener(payload)
      } catch (error) {
        console.warn('Activity follow-up listener failed', error)
      }
    }
  }
}

registerActivityCreatedHook(({ activity }) => {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`Workflow hook: activity created ${activity.id}`)
  }
})

registerActivityStatusHook(({ activity, previousStatus, currentStatus }) => {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`Workflow hook: activity ${activity.id} status ${previousStatus} -> ${currentStatus}`)
  }
})
