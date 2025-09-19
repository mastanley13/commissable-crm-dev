"use client"

import { useState, useEffect } from "react"
import { CheckCircle, AlertCircle, Clock, X } from "lucide-react"

export interface JobProgress {
  id: string
  type: 'import' | 'export'
  entityType: 'accounts' | 'contacts'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  totalRows?: number
  processedRows?: number
  successRows?: number
  errorRows?: number
  fileName?: string
  downloadUrl?: string
  errorMessage?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

interface JobProgressTrackerProps {
  jobs: JobProgress[]
  onDismiss?: (jobId: string) => void
  onDownload?: (jobId: string, downloadUrl: string) => void
}

export function JobProgressTracker({ jobs, onDismiss, onDownload }: JobProgressTrackerProps) {
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())

  const toggleExpanded = (jobId: string) => {
    setExpandedJobs(prev => {
      const next = new Set(prev)
      if (next.has(jobId)) {
        next.delete(jobId)
      } else {
        next.add(jobId)
      }
      return next
    })
  }

  const getStatusIcon = (status: JobProgress['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'processing':
        return (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
        )
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusColor = (status: JobProgress['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200'
      case 'failed':
        return 'bg-red-50 border-red-200'
      case 'processing':
        return 'bg-blue-50 border-blue-200'
      case 'pending':
        return 'bg-yellow-50 border-yellow-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const formatDuration = (start: Date, end?: Date) => {
    const endTime = end || new Date()
    const duration = endTime.getTime() - start.getTime()
    const seconds = Math.floor(duration / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (jobs.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3 max-w-sm">
      {jobs.map(job => {
        const isExpanded = expandedJobs.has(job.id)
        const isCompleted = job.status === 'completed'
        const isFailed = job.status === 'failed'
        const isProcessing = job.status === 'processing'

        return (
          <div
            key={job.id}
            className={`rounded-lg border p-4 shadow-lg transition-all duration-200 ${
              isExpanded ? 'w-80' : 'w-64'
            } ${getStatusColor(job.status)}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {getStatusIcon(job.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {job.type === 'import' ? 'Import' : 'Export'} {job.entityType}
                    </h4>
                    <span className="text-xs text-gray-500 capitalize">
                      {job.status}
                    </span>
                  </div>
                  {job.fileName && (
                    <p className="text-xs text-gray-600 truncate mt-1">
                      {job.fileName}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {isCompleted && job.downloadUrl && onDownload && (
                  <button
                    onClick={() => onDownload(job.id, job.downloadUrl!)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Download
                  </button>
                )}
                <button
                  onClick={() => onDismiss?.(job.id)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {(isProcessing || isCompleted) && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{job.progress}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isFailed ? 'bg-red-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Expanded Details */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Created:</span>
                    <p className="text-gray-900">{job.createdAt.toLocaleTimeString()}</p>
                  </div>
                  {job.startedAt && (
                    <div>
                      <span className="text-gray-500">Started:</span>
                      <p className="text-gray-900">{job.startedAt.toLocaleTimeString()}</p>
                    </div>
                  )}
                  {job.completedAt && (
                    <div>
                      <span className="text-gray-500">Completed:</span>
                      <p className="text-gray-900">{job.completedAt.toLocaleTimeString()}</p>
                    </div>
                  )}
                  {job.startedAt && (
                    <div>
                      <span className="text-gray-500">Duration:</span>
                      <p className="text-gray-900">
                        {formatDuration(job.startedAt, job.completedAt)}
                      </p>
                    </div>
                  )}
                </div>

                {job.totalRows && (
                  <div className="text-xs">
                    <span className="text-gray-500">Rows:</span>
                    <div className="flex gap-4 mt-1">
                      <span className="text-gray-900">
                        Total: {job.totalRows.toLocaleString()}
                      </span>
                      {job.successRows !== undefined && (
                        <span className="text-green-600">
                          Success: {job.successRows.toLocaleString()}
                        </span>
                      )}
                      {job.errorRows !== undefined && job.errorRows > 0 && (
                        <span className="text-red-600">
                          Errors: {job.errorRows.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {job.errorMessage && (
                  <div className="text-xs">
                    <span className="text-gray-500">Error:</span>
                    <p className="text-red-600 mt-1 break-words">{job.errorMessage}</p>
                  </div>
                )}

                {isCompleted && job.downloadUrl && (
                  <div className="text-xs">
                    <span className="text-gray-500">File:</span>
                    <p className="text-gray-900 mt-1">
                      Ready for download (expires in 7 days)
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Expand/Collapse Button */}
            <button
              onClick={() => toggleExpanded(job.id)}
              className="mt-2 text-xs text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? 'Show less' : 'Show details'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// Hook for managing job progress
export function useJobProgress() {
  const [jobs, setJobs] = useState<JobProgress[]>([])

  const addJob = (job: Omit<JobProgress, 'id' | 'createdAt'>) => {
    const newJob: JobProgress = {
      ...job,
      id: `${job.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date()
    }
    setJobs(prev => [newJob, ...prev])
    return newJob.id
  }

  const updateJob = (jobId: string, updates: Partial<JobProgress>) => {
    setJobs(prev => prev.map(job => 
      job.id === jobId ? { ...job, ...updates } : job
    ))
  }

  const removeJob = (jobId: string) => {
    setJobs(prev => prev.filter(job => job.id !== jobId))
  }

  const clearCompletedJobs = () => {
    setJobs(prev => prev.filter(job => 
      job.status !== 'completed' && job.status !== 'failed'
    ))
  }

  return {
    jobs,
    addJob,
    updateJob,
    removeJob,
    clearCompletedJobs
  }
}
