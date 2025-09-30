import { ActivityType } from "@prisma/client"

export function isTaskType(type: ActivityType): boolean {
  const task = (ActivityType as any).Task as ActivityType | undefined
  const toDo = (ActivityType as any).ToDo as ActivityType | undefined
  if (task && type === task) return true
  if (toDo && type === toDo) return true
  // Fallback: treat Note as non-task; common task-like labels
  const label = String(type)
  return label === 'Task' || label === 'ToDo'
}

