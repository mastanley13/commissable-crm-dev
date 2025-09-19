"use client"

import { useState, useCallback, useRef } from "react"
import { Upload, FileText, X, AlertCircle, CheckCircle, Download } from "lucide-react"

export interface ImportResult {
  totalRows: number
  successRows: number
  errorRows: number
  errors: ImportError[]
}

export interface ImportError {
  rowNumber: number
  field: string
  errorType: 'validation' | 'business_rule' | 'system'
  message: string
  suggestedFix?: string
}

export interface FieldMapping {
  [csvColumn: string]: string // Maps CSV column to entity field
}

interface ImportModalProps {
  entityType: 'accounts' | 'contacts'
  isOpen: boolean
  onClose: () => void
  onSuccess: (result: ImportResult) => void
}

const ENTITY_FIELDS = {
  accounts: [
    { id: 'accountName', label: 'Account Name', required: true },
    { id: 'accountLegalName', label: 'Account Legal Name', required: false },
    { id: 'accountType', label: 'Account Type', required: true },
    { id: 'accountOwner', label: 'Account Owner', required: false },
    { id: 'industry', label: 'Industry', required: false },
    { id: 'websiteUrl', label: 'Website URL', required: false },
    { id: 'description', label: 'Description', required: false },
    { id: 'shippingStreet', label: 'Shipping Street', required: false },
    { id: 'shippingStreet2', label: 'Shipping Street 2', required: false },
    { id: 'shippingCity', label: 'Shipping City', required: false },
    { id: 'shippingState', label: 'Shipping State', required: false },
    { id: 'shippingZip', label: 'Shipping Zip', required: false },
    { id: 'shippingCountry', label: 'Shipping Country', required: false },
    { id: 'billingStreet', label: 'Billing Street', required: false },
    { id: 'billingStreet2', label: 'Billing Street 2', required: false },
    { id: 'billingCity', label: 'Billing City', required: false },
    { id: 'billingState', label: 'Billing State', required: false },
    { id: 'billingZip', label: 'Billing Zip', required: false },
    { id: 'billingCountry', label: 'Billing Country', required: false },
    { id: 'parentAccount', label: 'Parent Account', required: false },
    { id: 'active', label: 'Active', required: false }
  ],
  contacts: [
    { id: 'firstName', label: 'First Name', required: true },
    { id: 'lastName', label: 'Last Name', required: true },
    { id: 'suffix', label: 'Suffix', required: false },
    { id: 'accountName', label: 'Account Name', required: true },
    { id: 'jobTitle', label: 'Job Title', required: false },
    { id: 'workPhone', label: 'Work Phone', required: false },
    { id: 'workPhoneExtension', label: 'Work Phone Extension', required: false },
    { id: 'mobilePhone', label: 'Mobile Phone', required: false },
    { id: 'emailAddress', label: 'Email Address', required: false },
    { id: 'contactType', label: 'Contact Type', required: false },
    { id: 'isPrimary', label: 'Is Primary', required: false },
    { id: 'isDecisionMaker', label: 'Is Decision Maker', required: false },
    { id: 'preferredContactMethod', label: 'Preferred Contact Method', required: false },
    { id: 'description', label: 'Description', required: false }
  ]
}

export function ImportModal({ entityType, isOpen, onClose, onSuccess }: ImportModalProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'validation' | 'processing' | 'results'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvData, setCsvData] = useState<any[]>([])
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({})
  const [validationErrors, setValidationErrors] = useState<ImportError[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const entityFields = ENTITY_FIELDS[entityType]

  const resetModal = () => {
    setStep('upload')
    setFile(null)
    setCsvHeaders([])
    setCsvData([])
    setFieldMapping({})
    setValidationErrors([])
    setIsProcessing(false)
    setProgress(0)
    setImportResult(null)
    setDragActive(false)
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleFile = (selectedFile: File) => {
    // Validate file type
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if (!validTypes.includes(selectedFile.type)) {
      alert('Please select a CSV or Excel file')
      return
    }

    // Validate file size (50MB for CSV, 25MB for Excel)
    const maxSize = selectedFile.type === 'text/csv' ? 50 * 1024 * 1024 : 25 * 1024 * 1024
    if (selectedFile.size > maxSize) {
      alert(`File size must be less than ${selectedFile.type === 'text/csv' ? '50MB' : '25MB'}`)
      return
    }

    setFile(selectedFile)
    
    // Parse CSV file (simplified - in real implementation, use a proper CSV parser)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
        const data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
          const row: any = {}
          headers.forEach((header, index) => {
            row[header] = values[index] || ''
          })
          return row
        })
        
        setCsvHeaders(headers)
        setCsvData(data)
        setStep('mapping')
      }
    }
    reader.readAsText(selectedFile)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleMappingChange = (csvColumn: string, entityField: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [csvColumn]: entityField
    }))
  }

  const validateMapping = () => {
    const errors: ImportError[] = []
    const requiredFields = entityFields.filter(f => f.required)
    
    // Check if all required fields are mapped
    requiredFields.forEach(field => {
      const isMapped = Object.values(fieldMapping).includes(field.id)
      if (!isMapped) {
        errors.push({
          rowNumber: 0,
          field: field.id,
          errorType: 'validation',
          message: `Required field "${field.label}" is not mapped`,
          suggestedFix: `Map a CSV column to "${field.label}"`
        })
      }
    })

    setValidationErrors(errors)
    setStep('validation')
  }

  const startImport = async () => {
    setIsProcessing(true)
    setStep('processing')
    setProgress(0)

    // Simulate import process
    const totalRows = csvData.length
    let successRows = 0
    let errorRows = 0
    const errors: ImportError[] = []

    for (let i = 0; i < totalRows; i++) {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Simulate some errors (10% error rate)
      if (Math.random() < 0.1) {
        errorRows++
        errors.push({
          rowNumber: i + 2, // +2 because CSV has header and is 1-indexed
          field: 'general',
          errorType: 'validation',
          message: 'Sample validation error',
          suggestedFix: 'Check data format'
        })
      } else {
        successRows++
      }
      
      setProgress(Math.round(((i + 1) / totalRows) * 100))
    }

    const result: ImportResult = {
      totalRows,
      successRows,
      errorRows,
      errors
    }

    setImportResult(result)
    setStep('results')
    setIsProcessing(false)
  }

  const downloadTemplate = () => {
    const headers = entityFields.map(f => f.label)
    const csvContent = headers.join(',') + '\n'
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${entityType}-import-template.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="w-full max-w-4xl rounded-xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Import {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
            </h2>
            <p className="text-sm text-gray-500">
              {step === 'upload' && 'Upload a CSV or Excel file to import data'}
              {step === 'mapping' && 'Map CSV columns to system fields'}
              {step === 'validation' && 'Review validation results'}
              {step === 'processing' && 'Processing import...'}
              {step === 'results' && 'Import completed'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              <Download className="h-4 w-4" />
              Template
            </button>
            <button
              onClick={handleClose}
              className="rounded-md px-3 py-1 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            {['Upload', 'Mapping', 'Validation', 'Processing', 'Results'].map((stepName, index) => {
              const stepIndex = ['upload', 'mapping', 'validation', 'processing', 'results'].indexOf(step)
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
                  {index < 4 && (
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
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Drop your file here, or click to browse
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Supports CSV and Excel files up to 50MB
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileInputChange}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>

              {file && (
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Column Mapping</h3>
                <div className="space-y-3">
                  {csvHeaders.map(header => (
                    <div key={header} className="flex items-center gap-4">
                      <div className="w-1/3">
                        <label className="block text-sm font-medium text-gray-700">
                          {header}
                        </label>
                        <p className="text-xs text-gray-500">CSV Column</p>
                      </div>
                      <div className="flex-1">
                        <select
                          value={fieldMapping[header] || ''}
                          onChange={(e) => handleMappingChange(header, e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">-- Select Field --</option>
                          {entityFields.map(field => (
                            <option key={field.id} value={field.id}>
                              {field.label} {field.required && '*'}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900">Mapping Tips</h4>
                    <ul className="mt-2 text-sm text-blue-800 space-y-1">
                      <li>• Required fields are marked with an asterisk (*)</li>
                      <li>• You can skip optional fields if they're not in your CSV</li>
                      <li>• Column names don't need to match exactly</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'validation' && (
            <div className="space-y-6">
              {validationErrors.length > 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-red-900">Validation Errors</h4>
                      <div className="mt-2 space-y-2">
                        {validationErrors.map((error, index) => (
                          <div key={index} className="text-sm text-red-800">
                            <strong>{error.field}:</strong> {error.message}
                            {error.suggestedFix && (
                              <p className="text-xs text-red-600 mt-1">
                                Suggestion: {error.suggestedFix}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-green-900">Validation Passed</h4>
                      <p className="mt-1 text-sm text-green-800">
                        All required fields are mapped. Ready to import {csvData.length} records.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Import Preview</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {csvHeaders.slice(0, 5).map(header => (
                          <th key={header} className="px-3 py-2 text-left font-medium text-gray-700">
                            {header}
                          </th>
                        ))}
                        {csvHeaders.length > 5 && (
                          <th className="px-3 py-2 text-left font-medium text-gray-700">
                            ...
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 3).map((row, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          {csvHeaders.slice(0, 5).map(header => (
                            <td key={header} className="px-3 py-2 text-gray-600">
                              {row[header] || '-'}
                            </td>
                          ))}
                          {csvHeaders.length > 5 && (
                            <td className="px-3 py-2 text-gray-400">...</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvData.length > 3 && (
                  <p className="mt-2 text-xs text-gray-500">
                    Showing first 3 rows of {csvData.length} total rows
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"></div>
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900">Processing Import</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Please wait while we import your data...
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
            </div>
          )}

          {step === 'results' && importResult && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">{importResult.totalRows}</div>
                  <div className="text-sm text-gray-500">Total Rows</div>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{importResult.successRows}</div>
                  <div className="text-sm text-green-600">Successfully Imported</div>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{importResult.errorRows}</div>
                  <div className="text-sm text-red-600">Errors</div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <h4 className="text-sm font-medium text-red-900 mb-3">Import Errors</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {importResult.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-800">
                        <strong>Row {error.rowNumber}:</strong> {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-green-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-green-900">Import Completed</h4>
                    <p className="mt-1 text-sm text-green-800">
                      {importResult.successRows} records were successfully imported.
                      {importResult.errorRows > 0 && ` ${importResult.errorRows} records had errors.`}
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
            {step === 'upload' && 'Step 1 of 5: Upload your file'}
            {step === 'mapping' && 'Step 2 of 5: Map columns to fields'}
            {step === 'validation' && 'Step 3 of 5: Review validation'}
            {step === 'processing' && 'Step 4 of 5: Processing...'}
            {step === 'results' && 'Step 5 of 5: Complete'}
          </div>
          <div className="flex gap-3">
            {step !== 'upload' && step !== 'processing' && (
              <button
                onClick={() => {
                  if (step === 'results') {
                    onSuccess(importResult!)
                    handleClose()
                  } else if (step === 'mapping') {
                    setStep('upload')
                  } else if (step === 'validation') {
                    setStep('mapping')
                  }
                }}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                {step === 'results' ? 'Done' : 'Back'}
              </button>
            )}
            {step === 'mapping' && (
              <button
                onClick={validateMapping}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Validate & Continue
              </button>
            )}
            {step === 'validation' && validationErrors.length === 0 && (
              <button
                onClick={startImport}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Start Import
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
