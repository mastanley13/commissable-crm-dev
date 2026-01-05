"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Users, Calculator, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountRowSummary {
  id: string;
  accountName: string;
  accountType?: string;
  accountOwner?: string;
  status?: string;
}

interface AccountReassignmentModalProps {
  isOpen: boolean;
  selectedAccountIds: string[];
  selectedAccountRows?: AccountRowSummary[];
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
  fromOwnerName?: string;
  toOwnerName?: string;
}

interface AccountSummaryPreview {
  id: string;
  accountName: string;
  currentOwnerId: string;
  currentOwnerName: string;
  accountType?: string;
  status?: string;
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
  portfolioSummary?: PortfolioSummary;
  transferSummary?: TransferSummary;
  transferAssociations?: TransferAssociations;
}

interface PortfolioSummary {
  revenueAndContracts: {
    totalAnnualRevenue: number;
    monthlyRecurring: number;
    activeContracts: number;
    revenueScheduleCount: number;
    nextRenewalDate: string | null;
  };
  pipeline: {
    openOpportunities: number;
    pipelineValue: number;
    stageBreakdown: Record<string, number>;
    nextCloseDate: string | null;
  };
  health: {
    highRiskAccounts: number;
    overdueTasks: number;
    staleAccounts: number;
    avgDaysSinceActivity: number | null;
  };
  ownerImpact: OwnerImpactSummary;
}

interface OwnerImpactSummary {
  ownerId: string;
  ownerName: string;
  ownerType: 'user' | 'house' | 'unassigned';
  currentBookSize: number | null;
  incomingAccounts: number;
  resultingBookSize: number | null;
  additionalRevenue: number;
  additionalPipeline: number;
}

interface TransferSummary {
  willMove: {
    accounts: number;
    contacts: number;
    openOpportunities: number;
    revenueSchedules: number;
    openTasks: number;
  };
  willRemain: {
    closedOpportunities: number;
    completedTasks: number;
    historicalRevenueSchedules: number;
  };
  exceptions: string[];
}

interface TransferAssociations {
  revenueSchedules: TransferRevenueSchedule[];
  contacts: TransferContact[];
  opportunities: TransferOpportunity[];
  groups: TransferGroup[];
  products: TransferProduct[];
}

interface TransferRevenueSchedule {
  id: string;
  accountId: string;
  accountName: string;
  scheduleNumber: string | null;
  scheduleDate: string | null;
  status: string;
  amount: number | null;
  productName: string | null;
  opportunityName: string | null;
}

interface TransferContact {
  id: string;
  accountId: string;
  accountName: string;
  fullName: string;
  jobTitle: string | null;
  email: string | null;
}

interface TransferOpportunity {
  id: string;
  accountId: string;
  accountName: string;
  name: string;
  stage: string;
  estimatedCloseDate: string | null;
  amount: number | null;
}

interface TransferGroup {
  id: string;
  accountId: string;
  accountName: string;
  groupName: string;
  memberType: string;
}

interface TransferProduct {
  id: string;
  accountId: string;
  accountName: string;
  opportunityName: string;
  productName: string;
  quantity: number | null;
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

interface AccountPreviewRow {
  id: string;
  accountName: string;
  accountType?: string;
  accountOwner?: string;
  status?: string;
  opportunityCount?: number;
  revenueScheduleCount?: number;
}

function getDefaultEffectiveDate(): Date {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // Default to the 1st of next month; user can manually adjust if needed.
  return new Date(year, month + 1, 1);
}

export function AccountReassignmentModal({
  isOpen,
  selectedAccountIds,
  selectedAccountRows,
  onClose,
  onConfirm
}: AccountReassignmentModalProps) {
  const [step, setStep] = useState<'selection' | 'preview' | 'confirm'>('selection');
  const [reassignmentData, setReassignmentData] = useState<ReassignmentData>({
    newOwnerId: '',
    assignmentRole: 'PrimaryOwner',
    effectiveDate: getDefaultEffectiveDate(),
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
  const [accountPreviewRows, setAccountPreviewRows] = useState<AccountPreviewRow[]>([]);

  useEffect(() => {
    if (isOpen) {
      setStep('selection');
      setReassignmentData({
        newOwnerId: '',
        assignmentRole: 'PrimaryOwner',
        effectiveDate: getDefaultEffectiveDate(),
        transferCommissions: true,
        notifyUsers: true,
        reason: ''
      });
      setImpactPreview(null);
      setAccountPreviewRows([]);
      loadUsers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedAccountRows && selectedAccountRows.length > 0) {
      setAccountPreviewRows(selectedAccountRows);
    } else if (!impactPreview) {
      setAccountPreviewRows([]);
    }
  }, [selectedAccountRows, impactPreview]);

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

  const loadAccountSummaryFallback = async () => {
    if (!selectedAccountIds.length) {
      setAccountPreviewRows([]);
      return;
    }

    try {
      const response = await fetch('/api/accounts/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds: selectedAccountIds })
      });

      if (response.ok) {
        const payload = await response.json().catch(() => null);
        const summaries: any[] = Array.isArray(payload?.accounts) ? payload.accounts : [];
        setAccountPreviewRows(
          summaries.map(summary => ({
            id: summary.id,
            accountName: summary.accountName,
            accountType: summary.accountType ?? '',
            accountOwner: summary.accountOwner ?? '',
            status: summary.status ?? ''
          }))
        );
      }
    } catch (error) {
      console.error('Failed to load account summaries:', error);
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
        const accounts =
          impactData?.accountsByOwner && typeof impactData.accountsByOwner === 'object'
            ? Object.values(impactData.accountsByOwner).flat()
            : [];
        const normalizedRows: AccountPreviewRow[] = accounts.map((account: any) => ({
          id: account.id,
          accountName: account.accountName,
          accountType: account.accountType ?? '',
          accountOwner: account.currentOwnerName,
          status: account.status ?? '',
          opportunityCount: account.opportunityCount,
          revenueScheduleCount: account.revenueScheduleCount
        }));
        setAccountPreviewRows(normalizedRows);
        if (!normalizedRows.length) {
          await loadAccountSummaryFallback();
        }
      } else {
        const errorData = await response.json();
        console.error('API error:', errorData);
        // Set a mock preview for testing purposes
        setImpactPreview(buildFallbackImpactPreview('Preview calculation failed - using mock data for demonstration'));
        await loadAccountSummaryFallback();
      }
    } catch (error) {
      console.error('Failed to load impact preview:', error);
      setImpactPreview(buildFallbackImpactPreview('Preview temporarily unavailable - using mock data'));
      await loadAccountSummaryFallback();
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

  const formatNumber = (value?: number | null) => {
    return new Intl.NumberFormat('en-US').format(value ?? 0);
  };

  const formatDateValue = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString();
  };

  const buildFallbackImpactPreview = (warningMessage: string): ReassignmentImpact => {
    const fallbackOwnerType: OwnerImpactSummary['ownerType'] =
      reassignmentData.newOwnerId === 'house'
        ? 'house'
        : reassignmentData.newOwnerId === 'unassigned'
          ? 'unassigned'
          : 'user';
    const fallbackOwnerName =
      fallbackOwnerType === 'house'
        ? 'House Account'
        : fallbackOwnerType === 'unassigned'
          ? 'Unassigned Queue'
          : reassignmentData.newOwnerId
            ? 'Selected owner'
            : 'Pending owner';

    return {
      totalAccounts: selectedAccountIds.length,
      accountsByOwner: {},
      revenueImpact: {
        totalAnnualRevenue: 0,
        monthlyRecurring: 0,
        projectedCommissions: 0,
        affectedOpportunities: 0
      },
      commissionTransfers: [],
      warnings: warningMessage ? [warningMessage] : [],
      conflicts: [],
      itemCounts: { activeContacts: 0, openActivities: 0, activeGroups: 0, openTasks: 0 },
      portfolioSummary: {
        revenueAndContracts: {
          totalAnnualRevenue: 0,
          monthlyRecurring: 0,
          activeContracts: 0,
          revenueScheduleCount: 0,
          nextRenewalDate: null
        },
        pipeline: {
          openOpportunities: 0,
          pipelineValue: 0,
          stageBreakdown: {},
          nextCloseDate: null
        },
        health: {
          highRiskAccounts: 0,
          overdueTasks: 0,
          staleAccounts: 0,
          avgDaysSinceActivity: null
        },
        ownerImpact: {
          ownerId: reassignmentData.newOwnerId || 'pending',
          ownerName: fallbackOwnerName,
          ownerType: fallbackOwnerType,
          currentBookSize: null,
          incomingAccounts: selectedAccountIds.length,
          resultingBookSize: null,
          additionalRevenue: 0,
          additionalPipeline: 0
        }
      },
      transferSummary: {
        willMove: {
          accounts: selectedAccountIds.length,
          contacts: 0,
          openOpportunities: 0,
          revenueSchedules: 0,
          openTasks: 0
        },
        willRemain: {
          closedOpportunities: 0,
          completedTasks: 0,
          historicalRevenueSchedules: 0
        },
        exceptions: []
      },
      transferAssociations: {
        revenueSchedules: [],
        contacts: [],
        opportunities: [],
        groups: [],
        products: []
      }
    };
  };

  const transferSummary = impactPreview?.transferSummary;
  const transferAssociations = impactPreview?.transferAssociations;
  const transferExceptions = transferSummary?.exceptions ?? [];
  const hasTransferExceptions = transferExceptions.length > 0;

  const confirmPreviewSample = accountPreviewRows.slice(0, 3);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
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
                  <div className="space-y-6">
                    {/* New Owner Selection */}
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        New Owner <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={reassignmentData.newOwnerId}
                        onChange={(e) => setReassignmentData(prev => ({ ...prev, newOwnerId: e.target.value }))}
                        className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
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
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Assignment Role <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={reassignmentData.assignmentRole}
                        onChange={(e) => setReassignmentData(prev => ({ ...prev, assignmentRole: e.target.value as AssignmentRole }))}
                        className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
                      >
                        <option value="PrimaryOwner">Primary Owner</option>
                        <option value="SalesSupport">Sales Support</option>
                        <option value="Finance">Finance</option>
                        <option value="ReadOnly">Read Only</option>
                      </select>
                    </div>

                    {/* Effective Date */}
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Effective Date <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={reassignmentData.effectiveDate.toISOString().split('T')[0]}
                          onChange={(e) => setReassignmentData(prev => ({ ...prev, effectiveDate: new Date(e.target.value) }))}
                          className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:opacity-0"
                          style={{ colorScheme: 'light' }}
                        />
                        <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-xs text-gray-900">
                          {reassignmentData.effectiveDate.toISOString().split('T')[0] || <span className="text-gray-400">YYYY-MM-DD</span>}
                        </span>
                      </div>
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
                        Transfer to New Owner
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
                          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Select House Dummy Representative</label>
                          <select
                            value={reassignmentData.houseDummyRepId || ''}
                            onChange={(e) => setReassignmentData(prev => ({ ...prev, houseDummyRepId: e.target.value }))}
                            className="w-full border-b-2 border-gray-300 bg-transparent px-0 py-1 text-xs focus:outline-none focus:border-primary-500"
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
                  {previewLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                      <span className="ml-3 text-gray-600">Calculating impact...</span>
                    </div>
                  ) : impactPreview ? (
                    <div className="space-y-6">
                      {/* Selected Accounts Overview */}
                      <div>
                        <h4 className="text-md font-medium text-gray-900 mb-3">Selected Accounts</h4>
                        {accountPreviewRows.length === 0 ? (
                          <p className="text-sm text-gray-500">
                            No account details available for preview. This may indicate a permissions or data issue.
                          </p>
                        ) : (
                          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium text-gray-700">Account Name</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-700">Account Type</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-700">Current Owner</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-700">Open Opps</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-700">Revenue Schedules</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {accountPreviewRows.map((account: AccountPreviewRow) => (
                                  <tr key={account.id}>
                                    <td className="px-3 py-2">
                                      <div className="flex flex-col">
                                        <span className="font-medium text-gray-900">{account.accountName}</span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-gray-700">
                                      {account.accountType || '—'}
                                    </td>
                                    <td className="px-3 py-2 text-gray-700">
                                      {account.accountOwner || "Unassigned"}
                                    </td>
                                    <td className="px-3 py-2 text-gray-700">
                                      {account.status || '—'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-gray-700">
                                      {account.opportunityCount ?? 0}
                                    </td>
                                    <td className="px-3 py-2 text-right text-gray-700">
                                      {account.revenueScheduleCount ?? 0}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Associated Items */}
                      <div>
                        <h4 className="text-md font-medium text-gray-900 mb-3">Associated records moving with this reassignment</h4>
                        {transferAssociations ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-semibold text-gray-700">Future revenue schedules</p>
                                  <span className="text-xs text-gray-500">{formatNumber(transferAssociations.revenueSchedules.length)}</span>
                                </div>
                                {transferAssociations.revenueSchedules.length === 0 ? (
                                  <p className="mt-2 text-sm text-gray-500">No upcoming schedules will move.</p>
                                ) : (
                                  <ul className="mt-3 space-y-2 text-sm text-gray-700">
                                    {transferAssociations.revenueSchedules.slice(0, 4).map(schedule => (
                                      <li key={schedule.id} className="rounded border border-gray-100 p-2">
                                        <p className="font-medium text-gray-900">
                                          {schedule.opportunityName || schedule.accountName}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {formatDateValue(schedule.scheduleDate)} - {formatCurrency(schedule.amount ?? 0)} - {schedule.productName || 'General'}
                                        </p>
                                      </li>
                                    ))}
                                    {transferAssociations.revenueSchedules.length > 4 && (
                                      <li className="text-xs text-gray-500">
                                        +{transferAssociations.revenueSchedules.length - 4} more schedule(s)
                                      </li>
                                    )}
                                  </ul>
                                )}
                              </section>

                              <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-semibold text-gray-700">Contacts</p>
                                  <span className="text-xs text-gray-500">{formatNumber(transferAssociations.contacts.length)}</span>
                                </div>
                                {transferAssociations.contacts.length === 0 ? (
                                  <p className="mt-2 text-sm text-gray-500">No contacts tied to these accounts.</p>
                                ) : (
                                  <ul className="mt-3 space-y-2 text-sm text-gray-700">
                                    {transferAssociations.contacts.slice(0, 4).map(contact => (
                                      <li key={contact.id} className="rounded border border-gray-100 p-2">
                                        <p className="font-medium text-gray-900">{contact.fullName}</p>
                                        <p className="text-xs text-gray-500">
                                          {(contact.jobTitle || 'No title')} - {contact.email || 'No email'}
                                        </p>
                                      </li>
                                    ))}
                                    {transferAssociations.contacts.length > 4 && (
                                      <li className="text-xs text-gray-500">
                                        +{transferAssociations.contacts.length - 4} more contact(s)
                                      </li>
                                    )}
                                  </ul>
                                )}
                              </section>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-semibold text-gray-700">Opportunities</p>
                                  <span className="text-xs text-gray-500">{formatNumber(transferAssociations.opportunities.length)}</span>
                                </div>
                                {transferAssociations.opportunities.length === 0 ? (
                                  <p className="mt-2 text-sm text-gray-500">No open opportunities will be reassigned.</p>
                                ) : (
                                  <ul className="mt-3 space-y-2 text-sm text-gray-700">
                                    {transferAssociations.opportunities.slice(0, 4).map(opportunity => (
                                      <li key={opportunity.id} className="rounded border border-gray-100 p-2">
                                        <p className="font-medium text-gray-900">{opportunity.name}</p>
                                        <p className="text-xs text-gray-500">
                                          {opportunity.stage} - {formatDateValue(opportunity.estimatedCloseDate)} - {formatCurrency(opportunity.amount ?? 0)}
                                        </p>
                                      </li>
                                    ))}
                                    {transferAssociations.opportunities.length > 4 && (
                                      <li className="text-xs text-gray-500">
                                        +{transferAssociations.opportunities.length - 4} more opportunity(ies)
                                      </li>
                                    )}
                                  </ul>
                                )}
                              </section>

                              <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-semibold text-gray-700">Groups</p>
                                  <span className="text-xs text-gray-500">{formatNumber(transferAssociations.groups.length)}</span>
                                </div>
                                {transferAssociations.groups.length === 0 ? (
                                  <p className="mt-2 text-sm text-gray-500">No group memberships found.</p>
                                ) : (
                                  <ul className="mt-3 space-y-2 text-sm text-gray-700">
                                    {transferAssociations.groups.slice(0, 4).map(group => (
                                      <li key={group.id} className="rounded border border-gray-100 p-2">
                                        <p className="font-medium text-gray-900">{group.groupName}</p>
                                        <p className="text-xs text-gray-500">Member type: {group.memberType}</p>
                                      </li>
                                    ))}
                                    {transferAssociations.groups.length > 4 && (
                                      <li className="text-xs text-gray-500">
                                        +{transferAssociations.groups.length - 4} more group link(s)
                                      </li>
                                    )}
                                  </ul>
                                )}
                              </section>
                            </div>

                            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-gray-700">Associated products</p>
                                <span className="text-xs text-gray-500">{formatNumber(transferAssociations.products.length)}</span>
                              </div>
                              {transferAssociations.products.length === 0 ? (
                                <p className="mt-2 text-sm text-gray-500">No products are linked to the selected accounts.</p>
                              ) : (
                                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                                  {transferAssociations.products.slice(0, 4).map(product => (
                                    <li key={product.id} className="rounded border border-gray-100 p-2">
                                      <p className="font-medium text-gray-900">{product.productName}</p>
                                      <p className="text-xs text-gray-500">
                                        {product.opportunityName} - Qty {product.quantity ?? '—'}
                                      </p>
                                    </li>
                                  ))}
                                  {transferAssociations.products.length > 4 && (
                                    <li className="text-xs text-gray-500">
                                      +{transferAssociations.products.length - 4} more product(s)
                                    </li>
                                  )}
                                </ul>
                              )}
                            </section>

                            {(impactPreview.commissionTransfers || []).length > 0 && (
                              <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-4">
                                <p className="text-sm font-semibold text-indigo-900 mb-3">Commission transfers</p>
                                <div className="space-y-3">
                                  {impactPreview.commissionTransfers.map((transfer: CommissionTransfer, index: number) => (
                                    <div
                                      key={`${transfer.fromOwner}-${index}`}
                                      className="flex flex-col gap-1 border-b border-indigo-100 pb-2 last:border-0 last:pb-0 md:flex-row md:items-center md:justify-between"
                                    >
                                      <div>
                                        <p className="text-sm font-semibold text-indigo-900">
                                          {(transfer.fromOwnerName || `User ${transfer.fromOwner}`)} {'->'} {(transfer.toOwnerName || 'New Owner')}
                                        </p>
                                        <p className="text-xs text-indigo-700">
                                          Effective {formatDateValue(transfer.effectiveDate)}
                                        </p>
                                      </div>
                                      <div className="text-sm font-semibold text-indigo-900">
                                        {formatCurrency(transfer.amount)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {hasTransferExceptions && (
                              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                <p className="text-sm font-semibold text-amber-800 mb-2">Exceptions to review</p>
                                <ul className="list-disc list-inside space-y-1 text-sm text-amber-900">
                                  {transferExceptions.map((exception, index) => (
                                    <li key={index}>{exception}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Associated item details are not available for this preview.</p>
                        )}
                      </div>

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
                    {confirmPreviewSample.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="font-medium text-gray-900 mb-2">Sample accounts</h4>
                        <ul className="space-y-1 text-sm text-gray-700">
                          {confirmPreviewSample.map(account => (
                            <li key={account.id} className="flex justify-between">
                              <span>{account.accountName}</span>
                              <span className="text-gray-500">
                                {account.accountOwner || 'Unassigned'} - {account.status || '—'}
                              </span>
                            </li>
                          ))}
                          {accountPreviewRows.length > confirmPreviewSample.length && (
                            <li className="text-xs text-gray-500">
                              +{accountPreviewRows.length - confirmPreviewSample.length} more (see Preview step for details)
                            </li>
                          )}
                        </ul>
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
