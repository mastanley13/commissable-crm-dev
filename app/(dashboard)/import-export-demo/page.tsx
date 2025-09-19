"use client";

import { useState } from "react";
import { ListHeader } from "@/components/list-header";
import { ImportModal, ImportResult } from "@/components/import-modal";
import { ExportModal, FilterState, Column } from "@/components/export-modal";
import { useAuth } from "@/lib/auth-context";
import { CopyProtectionWrapper } from "@/components/copy-protection";

export default function ImportExportDemoPage() {
  const { hasPermission } = useAuth();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [importEntityType, setImportEntityType] = useState<'accounts' | 'contacts'>('accounts');
  const [exportEntityType, setExportEntityType] = useState<'accounts' | 'contacts'>('accounts');

  // Check permissions for import/export
  const canImportAccounts = hasPermission('accounts.import');
  const canImportContacts = hasPermission('contacts.import');
  const canExportAccounts = hasPermission('accounts.export');
  const canExportContacts = hasPermission('contacts.export');

  const handleImportClick = (entityType: 'accounts' | 'contacts') => {
    setImportEntityType(entityType);
    setShowImportModal(true);
  };

  const handleExportClick = (entityType: 'accounts' | 'contacts') => {
    setExportEntityType(entityType);
    setShowExportModal(true);
  };

  const handleImportSuccess = (result: ImportResult) => {
    console.log('Import completed:', result);
    // In a real app, you might show a toast notification or refresh the data
  };

  // Mock data for demonstration
  const mockFilters: FilterState = {
    status: 'active',
    accountType: 'Customer'
  };

  const mockColumns: Column[] = [
    { id: 'accountName', label: 'Account Name', visible: true },
    { id: 'accountType', label: 'Account Type', visible: true },
    { id: 'accountOwner', label: 'Account Owner', visible: true },
    { id: 'shippingCity', label: 'Shipping City', visible: true },
    { id: 'shippingState', label: 'Shipping State', visible: false },
    { id: 'active', label: 'Active', visible: true }
  ];

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Import & Export Demo</h1>
              <p className="text-sm text-gray-500 mt-1">
                Demonstration of the import/export functionality for Accounts and Contacts
              </p>
            </div>
          </div>
        </div>

        {/* Permission Status */}
        <div className="px-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-3">Current User Permissions</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-blue-800">Import Permissions</h4>
                <ul className="mt-1 space-y-1 text-blue-700">
                  <li className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${canImportAccounts ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    Accounts Import: {canImportAccounts ? 'Allowed' : 'Denied'}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${canImportContacts ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    Contacts Import: {canImportContacts ? 'Allowed' : 'Denied'}
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-blue-800">Export Permissions</h4>
                <ul className="mt-1 space-y-1 text-blue-700">
                  <li className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${canExportAccounts ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    Accounts Export: {canExportAccounts ? 'Allowed' : 'Denied'}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${canExportContacts ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    Contacts Export: {canExportContacts ? 'Allowed' : 'Denied'}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Accounts Section */}
        <div className="px-6">
          <div className="bg-white rounded-lg border border-gray-200">
            <ListHeader
              title="Accounts"
              searchPlaceholder="Search accounts..."
              showCreateButton={false}
              onImport={() => handleImportClick('accounts')}
              onExport={() => handleExportClick('accounts')}
              canImport={canImportAccounts}
              canExport={canExportAccounts}
              onSettingsClick={() => {}}
            />
            <div className="p-6">
              <div className="text-center py-12">
                <div className="text-gray-500">
                  <p className="text-lg font-medium mb-2">Accounts Table</p>
                  <p className="text-sm">This would show the accounts table with import/export buttons in the header</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contacts Section */}
        <div className="px-6">
          <div className="bg-white rounded-lg border border-gray-200">
            <ListHeader
              title="Contacts"
              searchPlaceholder="Search contacts..."
              showCreateButton={false}
              onImport={() => handleImportClick('contacts')}
              onExport={() => handleExportClick('contacts')}
              canImport={canImportContacts}
              canExport={canExportContacts}
              onSettingsClick={() => {}}
            />
            <div className="p-6">
              <div className="text-center py-12">
                <div className="text-gray-500">
                  <p className="text-lg font-medium mb-2">Contacts Table</p>
                  <p className="text-sm">This would show the contacts table with import/export buttons in the header</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Overview */}
        <div className="px-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Import & Export Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Import Features</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Drag & drop file upload (CSV/Excel)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Column mapping interface</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Data validation & error reporting</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Progress tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Template download</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Permission-based access control</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Export Features</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Multiple format support (CSV/Excel)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Column selection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Filter application</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Background processing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Progress tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Download management</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="px-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">How to Use</h3>
            <div className="space-y-4 text-sm text-gray-600">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Import Process:</h4>
                <ol className="list-decimal list-inside space-y-1 ml-4">
                  <li>Click the &quot;Import&quot; button in the table header</li>
                  <li>Download the template to see the required format</li>
                  <li>Upload your CSV or Excel file</li>
                  <li>Map CSV columns to system fields</li>
                  <li>Review validation results</li>
                  <li>Start the import process</li>
                  <li>Review the results and any errors</li>
                </ol>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Export Process:</h4>
                <ol className="list-decimal list-inside space-y-1 ml-4">
                  <li>Click the &quot;Export&quot; button in the table header</li>
                  <li>Select export format (CSV or Excel)</li>
                  <li>Choose which columns to include</li>
                  <li>Apply current table filters if desired</li>
                  <li>Start the export process</li>
                  <li>Download the generated file</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import Modal */}
      <ImportModal
        entityType={importEntityType}
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
      />

      {/* Export Modal */}
      <ExportModal
        entityType={exportEntityType}
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        currentFilters={mockFilters}
        visibleColumns={mockColumns}
      />
    </CopyProtectionWrapper>
  );
}
