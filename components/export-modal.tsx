"use client"

import { useState, useEffect } from "react"
import { Download, FileText, X, CheckCircle, AlertCircle, Settings } from "lucide-react"

export interface FilterState {
  [key: string]: any
}

export interface Column {
  id: string
  label: string
  visible: boolean
}

export interface ExportJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  downloadUrl?: string
  errorMessage?: string
  createdAt: Date
  completedAt?: Date
}

interface ExportModalProps {
  entityType: 'accounts' | 'contacts'
  isOpen: boolean
  onClose: () => void
  currentFilters: FilterState
  visibleColumns: Column[]
}

const EXPORT_FORMATS = [
  { id: 'csv', label: 'CSV', description: 'Comma-separated values (Excel compatible)' },
  { id: 'excel', label: 'Excel', description: 'Microsoft Excel format (.xlsx)' }
]

const ENTITY_COLUMNS = {
  accounts: [
    { id: 'accountName', label: 'Account Name', visible: true },
    { id: 'accountLegalName', label: 'Account Legal Name', visible: true },
    { id: 'accountType', label: 'Account Type', visible: true },
    { id: 'accountOwner', label: 'Account Owner', visible: true },
    { id: 'industry', label: 'Industry', visible: true },
    { id: 'websiteUrl', label: 'Website URL', visible: false },
    { id: 'description', label: 'Description', visible: false },
    { id: 'shippingStreet', label: 'Shipping Street', visible: false },
    { id: 'shippingCity', label: 'Shipping City', visible: true },
    { id: 'shippingState', label: 'Shipping State', visible: true },
    { id: 'shippingZip', label: 'Shipping Zip', visible: false },
    { id: 'shippingCountry', label: 'Shipping Country', visible: false },
    { id: 'billingStreet', label: 'Billing Street', visible: false },
    { id: 'billingCity', label: 'Billing City', visible: false },
    { id: 'billingState', label: 'Billing State', visible: false },
    { id: 'billingZip', label: 'Billing Zip', visible: false },
    { id: 'billingCountry', label: 'Billing Country', visible: false },
    { id: 'parentAccount', label: 'Parent Account', visible: false },
    { id: 'active', label: 'Active', visible: true },
    { id: 'createdAt', label: 'Created Date', visible: false },
    { id: 'updatedAt', label: 'Last Modified', visible: false }
  ],
  contacts: [
    { id: 'firstName', label: 'First Name', visible: true },
    { id: 'lastName', label: 'Last Name', visible: true },
    { id: 'suffix', label: 'Suffix', visible: false },
    { id: 'accountName', label: 'Account Name', visible: true },
    { id: 'jobTitle', label: 'Job Title', visible: true },
    { id: 'workPhone', label: 'Work Phone', visible: true },
    { id: 'workPhoneExtension', label: 'Work Phone Extension', visible: false },
    { id: 'mobilePhone', label: 'Mobile Phone', visible: true },
    { id: 'emailAddress', label: 'Email Address', visible: true },
    { id: 'contactType', label: 'Contact Type', visible: true },
    { id: 'isPrimary', label: 'Is Primary', visible: false },
    { id: 'isDecisionMaker', label: 'Is Decision Maker', visible: false },
    { id: 'preferredContactMethod', label: 'Preferred Contact Method', visible: false },
    { id: 'description', label: 'Description', visible: false },
    { id: 'createdAt', label: 'Created Date', visible: false },
    { id: 'updatedAt', label: 'Last Modified', visible: false }
  ]
}

export function ExportModal({ entityType, isOpen, onClose, currentFilters, visibleColumns }: ExportModalProps) {
  const [step, setStep] = useState<'settings' | 'processing' | 'completed'>('settings')
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'excel'>('csv')
  const [selectedColumns, setSelectedColumns] = useState<Column[]>([])
  const [includeFilters, setIncludeFilters] = useState(true)
  const [exportJob, setExportJob] = useState<ExportJob | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)

  const availableColumns = ENTITY_COLUMNS[entityType]

  useEffect(() => {
    if (isOpen) {
      // Initialize with visible columns from the table
      const initialColumns = availableColumns.map(col => ({
        ...col,
        visible: visibleColumns.find(vc => vc.id === col.id)?.visible ?? col.visible
      }))
      setSelectedColumns(initialColumns)
      setStep('settings')
      setExportJob(null)
      setIsProcessing(false)
      setProgress(0)
    }
  }, [isOpen, visibleColumns, availableColumns])

  const handleColumnToggle = (columnId: string) => {
    setSelectedColumns(prev => 
      prev.map(col => 
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    )
  }

  const handleSelectAll = () => {
    setSelectedColumns(prev => 
      prev.map(col => ({ ...col, visible: true }))
    )
  }

  const handleSelectNone = () => {
    setSelectedColumns(prev => 
      prev.map(col => ({ ...col, visible: false }))
    )
  }

  const startExport = async () => {
    setIsProcessing(true)
    setStep('processing')
    setProgress(0)

    // Create export job
    const job: ExportJob = {
      id: `export_${Date.now()}`,
      status: 'processing',
      progress: 0,
      createdAt: new Date()
    }
    setExportJob(job)

    // Simulate export process
    const totalSteps = 4
    for (let i = 0; i < totalSteps; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      const newProgress = Math.round(((i + 1) / totalSteps) * 100)
      setProgress(newProgress)
      
      setExportJob(prev => prev ? { ...prev, progress: newProgress } : null)
    }

    // Complete the job
    const completedJob: ExportJob = {
      ...job,
      status: 'completed',
      progress: 100,
      downloadUrl: `/api/${entityType}/export/download/${job.id}`,
      completedAt: new Date()
    }
    setExportJob(completedJob)
    setStep('completed')
    setIsProcessing(false)
  }

  const downloadFile = () => {
    if (exportJob?.downloadUrl) {
      const a = document.createElement('a')
      a.href = exportJob.downloadUrl
      a.download = `${entityType}-export-${new Date().toISOString().split('T')[0]}.${selectedFormat === 'csv' ? 'csv' : 'xlsx'}`
      a.click()
    }
  }

  const getFilterSummary = () => {
    const activeFilters = Object.entries(currentFilters).filter(([_, value]) => 
      value !== null && value !== undefined && value !== ''
    )
    
    if (activeFilters.length === 0) {
      return 'No filters applied - all records will be exported'
    }
    
    return `${activeFilters.length} filter(s) applied`
  }

  const getSelectedColumnsCount = () => {
    return selectedColumns.filter(col => col.visible).length
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Export {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
            </h2>
            <p className="text-sm text-gray-500">
              {step === 'settings' && 'Configure your export settings'}
              {step === 'processing' && 'Generating export file...'}
              {step === 'completed' && 'Export completed successfully'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-center">
            {['Settings', 'Processing', 'Download'].map((stepName, index) => {
              const stepIndex = ['settings', 'processing', 'completed'].indexOf(step)
              const isActive = index === stepIndex
              const isCompleted = index < stepIndex
              
              return (
                <div key={stepName} className="flex items-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    isCompleted ? 'bg-green-100 text-green-600' :
                    isActive ? 'bg-primary-100 text-primary-600' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {isCompleted ? <CheckCircle className="h-4 w-4" /> : index + 1}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    isActive ? 'text-primary-600' : 'text-gray-500'
                  }`}>
                    {stepName}
                  </span>
                  {index < 2 && (
                    <div className={`mx-4 h-px w-12 ${
                      isCompleted ? 'bg-green-200' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {step === 'settings' && (
            <div className="space-y-6">
              {/* Format Selection */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900">Export Format</h3>
                <div className="grid grid-cols-2 gap-3">
                  {EXPORT_FORMATS.map(format => (
                    <label
                      key={format.id}
                      className={`relative rounded-lg border p-4 cursor-pointer transition-colors ${
                        selectedFormat === format.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="format"
                        value={format.id}
                        checked={selectedFormat === format.id}
                        onChange={(e) => setSelectedFormat(e.target.value as 'csv' | 'excel')}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900">{format.label}</div>
                          <div className="text-sm text-gray-500">{format.description}</div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Column Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900">Columns to Export</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      Select All
                    </button>
                    <span className="text-xs text-gray-400">|</span>
                    <button
                      onClick={handleSelectNone}
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      Select None
                    </button>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 max-h-60 overflow-y-auto">
                  <div className="divide-y divide-gray-200">
                    {selectedColumns.map(column => (
                      <label
                        key={column.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={column.visible}
                          onChange={() => handleColumnToggle(column.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-900">{column.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {getSelectedColumnsCount()} of {selectedColumns.length} columns selected
                </p>
              </div>

              {/* Filter Information */}
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <Settings className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">Current Filters</h4>
                    <p className="mt-1 text-sm text-gray-600">
                      {getFilterSummary()}
                    </p>
                    <label className="mt-3 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={includeFilters}
                        onChange={(e) => setIncludeFilters(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">Apply current table filters to export</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Export Summary */}
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900">Export Summary</h4>
                    <ul className="mt-2 text-sm text-blue-800 space-y-1">
                      <li>• Format: {selectedFormat.toUpperCase()}</li>
                      <li>• Columns: {getSelectedColumnsCount()} selected</li>
                      <li>• Filters: {includeFilters ? 'Applied' : 'Not applied'}</li>
                      <li>• File will be available for download for 7 days</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"></div>
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900">Generating Export</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Please wait while we prepare your export file...
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Progress</span>
                  <span className="text-gray-900">{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-primary-600 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {exportJob && (
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Export Job ID</p>
                      <p className="text-xs text-gray-500">{exportJob.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">Status</p>
                      <p className="text-xs text-primary-600 capitalize">{exportJob.status}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'completed' && exportJob && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900">Export Completed</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Your export file is ready for download
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Export Details</p>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <p>Format: {selectedFormat.toUpperCase()}</p>
                      <p>Columns: {getSelectedColumnsCount()} selected</p>
                      <p>Completed: {exportJob.completedAt?.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">File Size</p>
                    <p className="text-xs text-gray-500">~2.4 MB</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-green-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-green-900">Download Ready</h4>
                    <p className="mt-1 text-sm text-green-800">
                      Your export file has been generated successfully. Click the download button below to save it to your computer.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <div className="text-sm text-gray-500">
            {step === 'settings' && 'Configure your export settings'}
            {step === 'processing' && 'Generating your export file...'}
            {step === 'completed' && 'Ready for download'}
          </div>
          <div className="flex gap-3">
            {step === 'settings' && (
              <>
                <button
                  onClick={onClose}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={startExport}
                  disabled={getSelectedColumnsCount() === 0}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Start Export
                </button>
              </>
            )}
            {step === 'completed' && (
              <>
                <button
                  onClick={onClose}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Close
                </button>
                <button
                  onClick={downloadFile}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  <Download className="h-4 w-4" />
                  Download File
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
