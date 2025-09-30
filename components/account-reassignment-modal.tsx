"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Users, Calculator, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountReassignmentModalProps {
  isOpen: boolean;
  selectedAccountIds: string[];
  onClose: () => void;
  onConfirm: (reassignmentData: ReassignmentData) => Promise<void>;
}

interface ReassignmentData {
  newOwnerId: string;
  assignmentRole: AssignmentRole;
  effectiveDate: Date;
  transferCommissions: boolean;
  notifyUsers: boolean;
  reason?: string;
  commissionOption?: 'transferToNewRep' | 'transferToHouse';
  houseDummyRepId?: string;
}

type AssignmentRole = 'PrimaryOwner' | 'SalesSupport' | 'Finance' | 'ReadOnly';

interface CommissionTransfer {
  fromOwner: string;
  toOwner: string;
  amount: number;
  effectiveDate: string;
}

interface AccountSummaryPreview {
  id: string;
  accountName: string;
  currentOwnerId: string;
  currentOwnerName: string;
  totalRevenue: number;
  totalCommission: number;
  opportunityCount: number;
  revenueScheduleCount: number;
  activeContacts: number;
  openActivities: number;
  activeGroups: number;
  openTasks: number;
}

interface ReassignmentImpact {
  totalAccounts: number;
  accountsByOwner: { [ownerId: string]: AccountSummaryPreview[] };
  revenueImpact: {
    totalAnnualRevenue: number;
    monthlyRecurring: number;
    projectedCommissions: number;
    affectedOpportunities: number;
  };
  commissionTransfers: CommissionTransfer[];
  warnings: string[];
  conflicts: string[];
  itemCounts?: {
    activeContacts: number;
    openActivities: number;
    activeGroups: number;
    openTasks: number;
  };
}

interface User {
  id: string;
  fullName: string;
  role: {
    name: string;
  };
  activeAccountsCount: number;
  status: 'Active' | 'Inactive';
}

interface SpecialUser {
  id: string;
  type: 'house' | 'unassigned' | 'dummy';
  name: string;
  description: string;
}

export function AccountReassignmentModal({
  isOpen,
  selectedAccountIds,
  onClose,
  onConfirm
}: AccountReassignmentModalProps) {
  const [step, setStep] = useState<'selection' | 'preview' | 'confirm'>('selection');
  const [reassignmentData, setReassignmentData] = useState<ReassignmentData>({
    newOwnerId: '',
    assignmentRole: 'PrimaryOwner',
    effectiveDate: new Date(),
    transferCommissions: true,
    notifyUsers: true,
    reason: '',
    commissionOption: 'transferToNewRep',
    houseDummyRepId: ''
  });
  const [impactPreview, setImpactPreview] = useState<ReassignmentImpact | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [specialUsers, setSpecialUsers] = useState<SpecialUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('selection');
      setReassignmentData({
        newOwnerId: '',
        assignmentRole: 'PrimaryOwner',
        effectiveDate: new Date(),
        transferCommissions: true,
        notifyUsers: true,
        reason: ''
      });
      setImpactPreview(null);
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    try {
      setLoading(true);

      // Try the new users endpoint first
      const [usersResponse, specialUsersResponse] = await Promise.all([
        fetch('/api/users?status=Active&limit=100'),
        fetch('/api/users?type=special')
      ]);

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.users || []);
      } else {
        // Fallback to contacts options endpoint
        console.warn('Users endpoint failed, trying contacts options fallback');
        const optionsResponse = await fetch('/api/contacts/options');
        if (optionsResponse.ok) {
          const optionsData = await optionsResponse.json();
          // Transform owners to match expected format
          const transformedUsers = (optionsData.owners || []).map((owner: any) => ({
            id: owner.value,
            fullName: owner.label,
            role: { name: 'User' }, // Default role since we don't have role info here
            status: 'Active',
            activeAccountsCount: 0
          }));
          setUsers(transformedUsers);
        }
      }

      if (specialUsersResponse.ok) {
        const specialData = await specialUsersResponse.json();
        setSpecialUsers(specialData.data || []);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadImpactPreview = async () => {
    if (!reassignmentData.newOwnerId) return;

    try {
      setPreviewLoading(true);
      console.log('Loading impact preview for:', {
        accountIds: selectedAccountIds,
        newOwnerId: reassignmentData.newOwnerId,
        effectiveDate: reassignmentData.effectiveDate.toISOString()
      });

      const response = await fetch('/api/accounts/reassignment-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountIds: selectedAccountIds,
          newOwnerId: reassignmentData.newOwnerId,
          effectiveDate: reassignmentData.effectiveDate.toISOString()
        })
      });

      console.log('API response status:', response.status);

      if (response.ok) {
        const impactData = await response.json();
        console.log('Impact data received:', impactData);
        setImpactPreview(impactData);
      } else {
        const errorData = await response.json();
        console.error('API error:', errorData);
        // Set a mock preview for testing purposes
        setImpactPreview({
          totalAccounts: selectedAccountIds.length,
          accountsByOwner: {},
          revenueImpact: {
            totalAnnualRevenue: 0,
            monthlyRecurring: 0,
            projectedCommissions: 0,
            affectedOpportunities: 0
          },
          commissionTransfers: [],
          warnings: ['Preview calculation failed - using mock data for demonstration'],
          conflicts: [],
          itemCounts: { activeContacts: 0, openActivities: 0, activeGroups: 0, openTasks: 0 }
        });
      }
    } catch (error) {
      console.error('Failed to load impact preview:', error);
      // Set a mock preview for testing purposes
      setImpactPreview({
        totalAccounts: selectedAccountIds.length,
        accountsByOwner: {},
        revenueImpact: {
          totalAnnualRevenue: 0,
          monthlyRecurring: 0,
          projectedCommissions: 0,
          affectedOpportunities: 0
        },
        commissionTransfers: [],
        warnings: ['Preview temporarily unavailable - using mock data'],
        conflicts: [],
        itemCounts: { activeContacts: 0, openActivities: 0, activeGroups: 0, openTasks: 0 }
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleNext = async () => {
    if (step === 'selection') {
      if (!reassignmentData.newOwnerId) {
        alert('Please select a new owner');
        return;
      }
      await loadImpactPreview();
      setStep('preview');
    } else if (step === 'preview') {
      setStep('confirm');
    }
  };

  const handlePrevious = () => {
    if (step === 'preview') {
      setStep('selection');
    } else if (step === 'confirm') {
      setStep('preview');
    }
  };

  const handleConfirm = async () => {
    try {
      await onConfirm(reassignmentData);
      onClose();
    } catch (error) {
      console.error('Failed to reassign accounts:', error);
      alert('Failed to reassign accounts. Please try again.');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {step === 'selection' && <Users className="h-5 w-5 text-blue-600" />}
              {step === 'preview' && <Calculator className="h-5 w-5 text-orange-600" />}
              {step === 'confirm' && <CheckCircle className="h-5 w-5 text-green-600" />}
              <h2 className="text-xl font-semibold text-gray-900">
                Reassign Accounts ({selectedAccountIds.length})
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center px-6 py-4 bg-gray-50">
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center gap-2",
              step === 'selection' ? "text-blue-600" : "text-gray-600"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                step === 'selection' ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
              )}>
                1
              </div>
              <span className="font-medium">Selection</span>
            </div>
            <div className={cn(
              "w-8 h-0.5",
              step === 'preview' || step === 'confirm' ? "bg-blue-600" : "bg-gray-200"
            )} />
            <div className={cn(
              "flex items-center gap-2",
              step === 'preview' ? "text-orange-600" : "text-gray-600"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                step === 'preview' ? "bg-orange-600 text-white" :
                step === 'confirm' ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
              )}>
                2
              </div>
              <span className="font-medium">Preview</span>
            </div>
            <div className={cn(
              "w-8 h-0.5",
              step === 'confirm' ? "bg-blue-600" : "bg-gray-200"
            )} />
            <div className={cn(
              "flex items-center gap-2",
              step === 'confirm' ? "text-green-600" : "text-gray-600"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                step === 'confirm' ? "bg-green-600 text-white" : "bg-gray-200 text-gray-600"
              )}>
                3
              </div>
              <span className="font-medium">Confirm</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'selection' && (
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Account Reassignment Configuration
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* New Owner Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Owner *
                      </label>
                      <select
                        value={reassignmentData.newOwnerId}
                        onChange={(e) => setReassignmentData(prev => ({ ...prev, newOwnerId: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={loading}
                      >
                        <option value="">Select New Owner</option>

                        {/* All Users */}
                        <optgroup label="Users">
                          {users
                            .filter(user => user.status === 'Active')
                            .map(user => (
                              <option key={user.id} value={user.id}>
                                {user.fullName}
                              </option>
                            ))}
                        </optgroup>

                        {/* Special Assignments */}
                        {specialUsers.length > 0 && (
                          <optgroup label="Special Assignments">
                            {specialUsers.map(special => (
                              <option key={special.id} value={special.id}>
                                {special.name} - {special.description}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {/* Assignment Role */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Assignment Role *
                      </label>
                      <select
                        value={reassignmentData.assignmentRole}
                        onChange={(e) => setReassignmentData(prev => ({ ...prev, assignmentRole: e.target.value as AssignmentRole }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="PrimaryOwner">Primary Owner</option>
                        <option value="SalesSupport">Sales Support</option>
                        <option value="Finance">Finance</option>
                        <option value="ReadOnly">Read Only</option>
                      </select>
                    </div>

                    {/* Effective Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Effective Date *
                      </label>
                      <input
                        type="date"
                        value={reassignmentData.effectiveDate.toISOString().split('T')[0]}
                        onChange={(e) => setReassignmentData(prev => ({ ...prev, effectiveDate: new Date(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Options */}
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="transferCommissions"
                          checked={reassignmentData.transferCommissions}
                          onChange={(e) => setReassignmentData(prev => ({ ...prev, transferCommissions: e.target.checked }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="transferCommissions" className="ml-2 block text-sm text-gray-700">
                          Transfer future commissions
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="notifyUsers"
                          checked={reassignmentData.notifyUsers}
                          onChange={(e) => setReassignmentData(prev => ({ ...prev, notifyUsers: e.target.checked }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="notifyUsers" className="ml-2 block text-sm text-gray-700">
                          Notify affected users
                        </label>
                      </div>
                      {/* Commission Option Toggles */}
                      <fieldset className="mt-2">
                        <legend className="block text-sm font-medium text-gray-700 mb-2">Commission Adjustment</legend>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="radio"
                              name="commissionOption"
                              value="transferToNewRep"
                              checked={reassignmentData.commissionOption === 'transferToNewRep'}
                              onChange={() => setReassignmentData(prev => ({ ...prev, commissionOption: 'transferToNewRep' }))}
                            />
                            Transfer to New Representative
                          </label>
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="radio"
                              name="commissionOption"
                              value="transferToHouse"
                              checked={reassignmentData.commissionOption === 'transferToHouse'}
                              onChange={() => setReassignmentData(prev => ({ ...prev, commissionOption: 'transferToHouse' }))}
                            />
                            Transfer to House (add Rep % to House Split)
                          </label>
                        </div>
                      </fieldset>
                      {/* House Dummy Rep Selector when House chosen */}
                      {reassignmentData.newOwnerId === 'house' && (
                        <div className="mt-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Select House Dummy Representative</label>
                          <select
                            value={reassignmentData.houseDummyRepId || ''}
                            onChange={(e) => setReassignmentData(prev => ({ ...prev, houseDummyRepId: e.target.value }))}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Select Dummy Rep</option>
                            {specialUsers
                              .filter(s => s.type === 'dummy')
                              .map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Impact Preview
                  </h3>

                  {previewLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                      <span className="ml-3 text-gray-600">Calculating impact...</span>
                    </div>
                  ) : impactPreview ? (
                    <div className="space-y-6">
                      {/* Summary Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="text-sm text-blue-600 font-medium">Total Revenue Impact</div>
                          <div className="text-2xl font-bold text-blue-900">
                            {formatCurrency((impactPreview.revenueImpact && impactPreview.revenueImpact.totalAnnualRevenue) || 0)}
                          </div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="text-sm text-green-600 font-medium">Commission Impact</div>
                          <div className="text-2xl font-bold text-green-900">
                            {formatCurrency((impactPreview.revenueImpact && impactPreview.revenueImpact.projectedCommissions) || 0)}
                          </div>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                          <div className="text-sm text-purple-600 font-medium">Affected Items</div>
                          <div className="text-2xl font-bold text-purple-900">
                            {(impactPreview.revenueImpact && impactPreview.revenueImpact.affectedOpportunities) || 0} opportunities
                          </div>
                        </div>
                      </div>

                      {/* Transfer Details */}
                      <div>
                        <h4 className="text-md font-medium text-gray-900 mb-3">Transfer Details</h4>
                        <div className="space-y-3">
                          {(impactPreview.commissionTransfers || []).map((transfer: CommissionTransfer, index: number) => (
                            <div key={index} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium text-gray-900">
                                    From: {transfer.fromOwner === 'unassigned' ? 'Unassigned' : `User ${transfer.fromOwner}`}
                                  </div>
                                  <div className="text-sm text-gray-600">To: {transfer.toOwner === 'house' ? 'House Account' : transfer.toOwner === 'unassigned' ? 'Unassigned' : `User ${transfer.toOwner}`}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm text-gray-600">Commission: {formatCurrency(transfer.amount)}</div>
                                  <div className="text-sm text-gray-600">Effective: {new Date(transfer.effectiveDate).toLocaleDateString()}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Warnings */}
                      {impactPreview.warnings?.length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <h4 className="text-md font-medium text-yellow-800 mb-2">Warnings</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {impactPreview.warnings.map((warning, index) => (
                              <li key={index} className="text-sm text-yellow-700">{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Conflicts */}
                      {impactPreview.conflicts?.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <h4 className="text-md font-medium text-red-800 mb-2">Conflicts</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {impactPreview.conflicts.map((conflict, index) => (
                              <li key={index} className="text-sm text-red-700">{conflict}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No preview data available
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Confirmation
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Reassignment Summary</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Accounts to reassign:</span>
                            <span className="font-medium">{selectedAccountIds.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">New owner:</span>
                            <span className="font-medium">
                              {reassignmentData.newOwnerId === 'house' ? 'House Account' :
                               reassignmentData.newOwnerId === 'unassigned' ? 'Unassigned' :
                               users.find(u => u.id === reassignmentData.newOwnerId)?.fullName || 'Unknown'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Assignment role:</span>
                            <span className="font-medium">{reassignmentData.assignmentRole}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Effective date:</span>
                            <span className="font-medium">
                              {reassignmentData.effectiveDate.toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Options</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Transfer commissions:</span>
                            <span className="font-medium">
                              {reassignmentData.transferCommissions ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Notify users:</span>
                            <span className="font-medium">
                              {reassignmentData.notifyUsers ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {impactPreview && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="font-medium text-gray-900 mb-2">Financial Impact</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total revenue impact:</span>
                            <span className="font-medium text-green-600">
                              {formatCurrency((impactPreview.revenueImpact && impactPreview.revenueImpact.totalAnnualRevenue) || 0)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Commission impact:</span>
                            <span className="font-medium text-blue-600">
                              {formatCurrency((impactPreview.revenueImpact && impactPreview.revenueImpact.projectedCommissions) || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reason/Comments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason/Comments (Optional)
                  </label>
                  <textarea
                    value={reassignmentData.reason}
                    onChange={(e) => setReassignmentData(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Enter reason for reassignment..."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            {step !== 'selection' && (
              <button
                onClick={handlePrevious}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>

            {step === 'confirm' ? (
              <button
                onClick={handleConfirm}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
              >
                Confirm Reassignment
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={step === 'selection' && !reassignmentData.newOwnerId}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
