import React, { useState } from 'react';

/**
 * Revenue Schedule Detail Component
 * Commissable CRM Platform
 * 
 * ============================================================================
 * DISTRIBUTOR FIELD MAPPING - TELARUS EXAMPLE
 * ============================================================================
 * 
 * Distributors (like Telarus) carry multiple vendors and report commission/usage
 * data using vendor-specific templates. Each template maps distributor field names
 * to Commissable CRM's standardized field names.
 * 
 * IMPORTANT: Field mapping is performed by the AI component in the Reconciliation
 * area of the SaaS application. The AI analyzes incoming deposit data and 
 * intelligently maps fields to the appropriate Revenue Schedule fields.
 * 
 * UNIVERSAL/COMMON FIELDS (apply to ALL vendor templates):
 * ┌─────────────────────┬─────────────────────────┬─────────────────────────────────┐
 * │ Distributor Field   │ Commissable Field       │ Destination                     │
 * ├─────────────────────┼─────────────────────────┼─────────────────────────────────┤
 * │ Customer Name       │ Account Legal Name      │ Header → Additional Details     │
 * │ Usage               │ Actual Usage - Gross    │ Financial Summary → Usage       │
 * │ Total Commission    │ Actual Commission       │ Financial Summary → Commission  │
 * │ Vendor Account      │ Vendor Name             │ Header → Partner Information    │
 * └─────────────────────┴─────────────────────────┴─────────────────────────────────┘
 * 
 * ============================================================================
 * MANUAL USER ADJUSTMENTS
 * ============================================================================
 * Users can manually adjust the following fields:
 * - Usage (Bill Amount)
 * - Expected Usage - Adjustment
 * - Quantity
 * - Price Per (ea)
 * - Expected Commission Rate %
 * 
 * ============================================================================
 * AI RECONCILIATION WIZARD - AUTOMATIC MATCHING
 * ============================================================================
 * The AI Reconciliation Wizard automatically:
 * 1. Processes deposit line items against expected Revenue Schedules
 * 2. If within allowable threshold (set in Admin settings, typically +/- %):
 *    - Automatically marks deposit line item as "Matched"
 *    - Automatically marks Revenue Schedule as "Matched"
 * 3. Makes adjustments automatically when within threshold
 * 
 * ============================================================================
 * RATE DISCREPANCY HANDLING
 * ============================================================================
 * When Expected Rate % ≠ Actual Rate %, but Usage is aligned:
 * - System flags for user direction
 * - User action options:
 *   1. "Create Ticket" - Opens ticket for low payment share investigation
 *   2. "Accept New Rate %" - Updates current schedule, marks as Matched
 *   3. "Apply New Rate % to All Future Schedules" - Updates current AND all
 *      future Revenue Schedules for this product within the Opportunity
 * 
 * ============================================================================
 * AI-POWERED RECONCILIATION DATA FLOW
 * ============================================================================
 * 1. Deposit file imported into Reconciliation area
 * 2. AI component analyzes deposit line items and identifies field mappings
 * 3. AI matches deposit line items to appropriate Revenue Schedules
 * 4. Universal fields (above) → Update core Revenue Schedule fields
 * 5. Known ID fields (Account ID, Order ID, etc.) → Update Opportunity Details tab
 * 6. Vendor-specific metadata fields → Create/update in Additional Information tab
 * 
 * FIELD POPULATION RULES:
 * - ID fields flow: Deposit → Revenue Schedule → Opportunity "Details" fields
 * - Metadata fields NOT present on schedule → Create NEW fields in Vendor/Distributor
 *   Product Metadata section (Additional Information tab)
 * - Fields fill columns top-to-bottom, overflow to next column (up to 4 columns)
 * 
 * ============================================================================
 */

const RevenueScheduleDetail = () => {
  const [activeTab, setActiveTab] = useState('splits');
  const [transactionFilter, setTransactionFilter] = useState('all');
  const [balanceView, setBalanceView] = useState('overall');
  const [splitsDisplayMode, setSplitsDisplayMode] = useState('percent');
  const [paymentSplitFilter, setPaymentSplitFilter] = useState('all');
  const [financialSummaryExpanded, setFinancialSummaryExpanded] = useState(true);

  // ===== CORE INPUT VALUES =====
  const quantity = 1;
  const pricePer = 500.00;
  const expectedCommissionRate = 8.00;
  const actualCommissionRate = 8.00;
  
  // Actual usage is 5% higher than expected gross
  const expectedUsageGross = quantity * pricePer; // 500.00
  const actualUsageGross = expectedUsageGross * 1.05; // 525.00 (5% higher)
  
  // Adjustment to make expected net match actual usage
  const expectedUsageGrossAdjustment = actualUsageGross - expectedUsageGross; // +25.00
  const expectedUsageNet = expectedUsageGross + expectedUsageGrossAdjustment; // 525.00
  
  // Usage difference (should be 0 after adjustment)
  const actualUsageDifference = actualUsageGross - expectedUsageNet; // 0.00

  // ===== COMMISSION CALCULATIONS =====
  const actualCommissionRateDiff = actualCommissionRate - expectedCommissionRate; // 0.00
  
  // Expected Commission based on ORIGINAL expected usage (before adjustment)
  const expectedCommission = expectedUsageGross * (expectedCommissionRate / 100); // 500 * 0.08 = 40.00
  
  // Actual Commission based on actual usage received
  const actualCommission = actualUsageGross * (actualCommissionRate / 100); // 525 * 0.08 = 42.00
  
  // Expected Commission Adjustment - reconciles expected to actual
  const actualCommissionAdjustment = actualCommission - expectedCommission; // 42 - 40 = +2.00
  
  // Expected Commission Net = Expected + Adjustment
  const expectedCommissionNet = expectedCommission + actualCommissionAdjustment; // 40 + 2 = 42.00
  
  // Actual Commission = Expected + Adjustment (the actual commission received from deposit)
  const actualCommissionNet = expectedCommission + actualCommissionAdjustment; // 40 + 2 = 42.00
  
  // Commission Difference = Expected Commission Net - Actual Commission
  const commissionDifference = expectedCommissionNet - actualCommissionNet; // 42 - 42 = 0.00

  // ===== SPLIT PERCENTAGES =====
  const houseSplit = 20.00;
  const houseRepSplit = 30.00;
  const subagentSplit = 50.00;

  // ===== COMMISSION SPLIT CALCULATIONS (based on actual commission net) =====
  const commissionNetHouse = actualCommissionNet * (houseSplit / 100); // 42 * 0.20 = 8.40
  const commissionNetHouseRep = actualCommissionNet * (houseRepSplit / 100); // 42 * 0.30 = 12.60
  const commissionNetSubagent = actualCommissionNet * (subagentSplit / 100); // 42 * 0.50 = 21.00
  
  // Expected commission splits (for transaction expected column)
  const commissionBalanceHouse = 0; // All payments made
  const commissionBalanceHouseRep = 0; // All payments made
  const commissionBalanceSubagent = 0; // All payments made

  // Format helpers
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  const formatDiff = (value: number) => {
    const formatted = formatCurrency(Math.abs(value));
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return formatted;
  };

  const formatPercentDiff = (value: number) => {
    const formatted = `${Math.abs(value).toFixed(2)}%`;
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return formatted;
  };

  // Tabs below Financial Summary
  const tabs = [
    { id: 'opportunity', label: 'Opportunity Details' },
    { id: 'product', label: 'Additional Information' },
    { id: 'splits', label: 'Commission Splits' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'activities', label: 'Activities' },
    { id: 'tickets', label: 'Tickets' },
  ];

  // Split data for reuse
  const splits = {
    house: {
      id: 'house',
      label: 'Algave LLC',
      percent: houseSplit,
      commissionNet: commissionNetHouse,
      commissionBalance: commissionBalanceHouse
    },
    houseRep: {
      id: 'houseRep',
      label: 'House Rep - Jane Smith',
      percent: houseRepSplit,
      commissionNet: commissionNetHouseRep,
      commissionBalance: commissionBalanceHouseRep
    },
    subagent: {
      id: 'subagent',
      label: 'Subagent - Jim Smith',
      percent: subagentSplit,
      commissionNet: commissionNetSubagent,
      commissionBalance: commissionBalanceSubagent
    }
  };

  // ===== Commission Splits - Side-by-Side Cards =====
  const CommissionSplitsContent = () => (
    <div className="grid grid-cols-3 gap-3">
      {Object.values(splits).map((split) => (
        <div key={split.id} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-blue-900 text-white px-3 py-2">
            <h4 className="text-xs font-semibold">{split.label} - {formatPercent(split.percent)}</h4>
          </div>
          <div className="p-2 space-y-2">
            <div className="bg-gray-50 rounded p-2">
              <h5 className="text-xs font-semibold text-blue-800 mb-1 uppercase">Reconciled</h5>
              <div className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Actual Commission</span>
                  <span className="font-medium">{formatCurrency(actualCommissionNet)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Split %</span>
                  <span className="font-medium">× {formatPercent(split.percent)}</span>
                </div>
                <div className="border-t border-gray-300 pt-0.5 mt-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-gray-700">Net</span>
                    <span className="font-bold text-blue-900">{formatCurrency(split.commissionNet)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 rounded p-2">
              <h5 className="text-xs font-semibold text-blue-800 mb-1 uppercase">Receivables</h5>
              <div className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Actual Commission</span>
                  <span className="font-medium">{formatCurrency(split.commissionNet)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Paid</span>
                  <span className="font-medium">- {formatCurrency(split.commissionNet)}</span>
                </div>
                <div className="border-t border-blue-200 pt-0.5 mt-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-gray-700">Total</span>
                    <span className="font-bold text-blue-900">{formatCurrency(split.commissionBalance)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 px-6 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 bg-blue-900 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xs">C</span>
              </div>
              <span className="font-bold text-blue-900 text-base">COMMISSABLE</span>
            </div>
            <div className="flex items-center space-x-5 text-xs">
              <a href="#" className="text-gray-600 hover:text-blue-900">Dashboard</a>
              <a href="#" className="text-gray-600 hover:text-blue-900">Accounts</a>
              <a href="#" className="text-gray-600 hover:text-blue-900">Opportunities</a>
              <a href="#" className="bg-blue-900 text-white px-2 py-1 rounded">Revenue Schedules</a>
              <a href="#" className="text-gray-600 hover:text-blue-900">Catalog</a>
              <a href="#" className="text-gray-600 hover:text-blue-900">More ▼</a>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-blue-900 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">AA</span>
            </div>
            <span className="text-xs text-gray-700">Avery Admin</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="px-4 py-2">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Breadcrumbs */}
          <div className="bg-gray-50 px-6 py-1.5 border-b border-gray-200">
            <nav className="flex items-center space-x-2 text-xs">
              <a href="#" className="text-gray-500 hover:text-blue-600">Home</a>
              <span className="text-gray-400">›</span>
              <a href="#" className="text-gray-500 hover:text-blue-600">Account Details</a>
              <span className="text-gray-400">›</span>
              <a href="#" className="text-gray-500 hover:text-blue-600">Revenue Schedules</a>
              <span className="text-gray-400">›</span>
              <span className="text-gray-700 font-medium">RS-12222</span>
            </nav>
          </div>

          {/* Revenue Schedule Detail Header Section - Colored Background */}
          <div className="bg-blue-50">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-2 border-b border-blue-100">
              <div className="flex items-center space-x-3">
                <h1 className="text-xl font-semibold text-blue-900">REVENUE SCHEDULE DETAIL</h1>
                <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded font-medium">Reconciled</span>
              </div>
              <div className="flex items-center space-x-3">
                <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded text-sm font-medium">
                  Create Ticket
                </button>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm font-medium">
                  Update
                </button>
              </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-3 gap-4 px-6 py-2">
              {/* Opportunity Overview */}
              <div>
                <h3 className="text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide">Opportunity Overview</h3>
                <div className="space-y-1">
                  <div className="flex">
                    <span className="text-xs text-gray-600 w-48 shrink-0">Revenue Schedule Name</span>
                    <span className="text-sm font-medium text-gray-900 ml-4">RS-12222</span>
                  </div>
                  <div className="flex">
                    <span className="text-xs text-gray-600 w-48 shrink-0">Revenue Schedule Date</span>
                    <span className="text-sm font-medium text-gray-900 ml-4">2025-12-01</span>
                  </div>
                  <div className="flex">
                    <span className="text-xs text-gray-600 w-48 shrink-0">Opportunity</span>
                    <span className="text-sm font-medium text-blue-600 ml-4">DW Realty GA - Telarus - ACC - ADI</span>
                  </div>
                  <div className="flex">
                    <span className="text-xs text-gray-600 w-48 shrink-0">Revenue Month</span>
                    <span className="text-sm font-medium text-gray-900 ml-4">2025-11</span>
                  </div>
                  <div className="flex">
                    <span className="text-xs text-gray-600 w-48 shrink-0">Product Name - House</span>
                    <span className="text-sm font-medium text-gray-900 ml-4">ADI - 10/100 Ethernet</span>
                  </div>
                  <div className="flex">
                    <span className="text-xs text-gray-600 w-48 shrink-0">Opportunity Owner</span>
                    <span className="text-sm font-medium text-blue-600 ml-4">Rob Hootselle</span>
                  </div>
                </div>
              </div>

              {/* Section 2 - no header */}
              <div>
                <div className="space-y-1 mt-5">
                  <div className="flex">
                    <span className="text-xs text-gray-600 w-40 shrink-0">Subagent</span>
                    <span className="text-sm font-medium text-gray-900 ml-4">Jim Smith</span>
                  </div>
                  <div className="flex">
                    <span className="text-xs text-gray-600 w-40 shrink-0">House Rep</span>
                    <span className="text-sm font-medium text-gray-900 ml-4">Jane Smith</span>
                  </div>
                  <div className="flex">
                    <span className="text-xs text-gray-600 w-40 shrink-0">Distributor</span>
                    <span className="text-sm font-medium text-gray-900 ml-4">Telarus</span>
                  </div>
                  <div className="flex">
                    <span className="text-xs text-gray-600 w-40 shrink-0">Vendor</span>
                    <span className="text-sm font-medium text-gray-900 ml-4">ACC Business</span>
                  </div>
                  <div className="flex">
                    <span className="text-xs text-gray-600 w-40 shrink-0">Payment Type</span>
                    <span className="text-sm font-medium text-gray-900 ml-4">MRC - 3rd Party</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs text-gray-600 w-40 shrink-0">Comments</span>
                    <input 
                      type="text"
                      className="ml-4 flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Enter comments..."
                    />
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div>
                <h3 className="text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide">Additional Details</h3>
                <div className="space-y-1">
                  <div className="flex">
                    <span className="text-xs text-gray-600 w-40 shrink-0">Account Name</span>
                    <span className="text-sm font-medium text-gray-900 ml-4">DW Realty Partners</span>
                  </div>
                  <div className="flex">
                    <span className="text-xs text-gray-600 w-40 shrink-0">Account Legal Name</span>
                    <span className="text-sm font-medium text-gray-900 ml-4">DW Realty Partners, LLC</span>
                  </div>
                  <div className="flex">
                    <span className="text-xs text-gray-600 w-40 shrink-0">Shipping Address</span>
                    <span className="text-sm font-medium text-gray-900 ml-4">91 Somerville Drive, Ponte Vedra, FL, 32081</span>
                  </div>
                  <div className="flex">
                    <span className="text-xs text-gray-600 w-40 shrink-0">Billing Address</span>
                    <span className="text-sm font-medium text-gray-900 ml-4">91 Somerville Drive, Ponte Vedra, FL, 32081</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Summary - Collapsible */}
          <div className="bg-white px-6 py-1">
            <div 
              className="flex items-center cursor-pointer mb-1"
              onClick={() => setFinancialSummaryExpanded(!financialSummaryExpanded)}
            >
              <span className="text-gray-500 text-sm mr-2">
                {financialSummaryExpanded ? '▼' : '▶'}
              </span>
              <h3 className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Financial Summary</h3>
            </div>
            {financialSummaryExpanded && (
            <div className="grid grid-cols-3 gap-4">
              {/* Column 1: Usage Summary */}
              <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                <h4 className="text-xs font-semibold text-blue-900 mb-1 pb-1 border-b border-gray-300">
                  Usage Summary
                </h4>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Quantity</span>
                    <span className="text-xs font-medium text-gray-900">{quantity}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Price Per</span>
                    <span className="text-xs font-medium text-gray-900">× {formatCurrency(pricePer)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Expected Usage Gross</span>
                    <span className="text-xs font-medium text-gray-900">= {formatCurrency(expectedUsageGross)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Expected Usage Adjustment</span>
                    <span className="text-xs font-medium text-gray-900 underline">+ {formatCurrency(expectedUsageGrossAdjustment)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-gray-100 -mx-1 px-1 py-0.5 rounded">
                    <span className="text-xs text-gray-700 font-bold">Expected Usage Net</span>
                    <span className="text-xs font-bold text-gray-900">= {formatCurrency(expectedUsageNet)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 mt-1 border-t border-gray-300">
                    <span className="text-xs text-blue-600">Actual Usage</span>
                    <span className="text-xs font-medium text-blue-600 underline cursor-pointer">{formatCurrency(actualUsageGross)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 mt-1 border-t border-gray-300 bg-gray-100 -mx-1 px-1 py-0.5 rounded">
                    <span className="text-xs text-gray-700 font-bold">Usage Difference (+/-)</span>
                    <span className={`text-xs font-bold ${actualUsageDifference === 0 ? 'text-gray-900' : actualUsageDifference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      = {formatDiff(actualUsageDifference)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Column 2: Commission Summary */}
              <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                <h4 className="text-xs font-semibold text-blue-900 mb-1 pb-1 border-b border-gray-300">
                  Commission Summary
                </h4>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Billing Month</span>
                    <span className="text-xs font-medium text-gray-900">2025-07-01</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 mt-1 border-t border-gray-300">
                    <span className="text-xs text-gray-600">Expected Commission</span>
                    <span className="text-xs font-medium text-gray-900">{formatCurrency(expectedCommission)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Expected Commission Adjustment</span>
                    <span className={`text-xs font-medium underline ${actualCommissionAdjustment === 0 ? 'text-gray-900' : actualCommissionAdjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      + {formatDiff(actualCommissionAdjustment)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 font-bold">Expected Commission Net</span>
                    <span className="text-xs font-medium text-blue-600">{formatCurrency(expectedCommissionNet)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 font-bold">Actual Commission</span>
                    <span className="text-xs font-medium text-gray-900 underline cursor-pointer">{formatCurrency(actualCommissionNet)}</span>
                  </div>
                  <div className="flex justify-between items-center h-4">
                    <span className="text-xs">&nbsp;</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 mt-1 border-t border-gray-300 bg-gray-100 -mx-1 px-1 py-0.5 rounded">
                    <span className="text-xs text-gray-700 font-bold">Commission Difference</span>
                    <span className={`text-xs font-bold ${(expectedCommissionNet - actualCommissionNet) === 0 ? 'text-gray-900' : (expectedCommissionNet - actualCommissionNet) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      = {formatDiff(expectedCommissionNet - actualCommissionNet)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Column 3: Splits */}
              <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                <div className="flex justify-between items-center mb-1 pb-1 border-b border-gray-300">
                  <h4 className="text-xs font-semibold text-blue-900">
                    Splits
                  </h4>
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={() => setSplitsDisplayMode('percent')}
                      className={`text-xs px-2 py-0.5 rounded ${splitsDisplayMode === 'percent' ? 'bg-blue-600 text-white font-medium' : 'text-blue-600 hover:bg-blue-100 underline cursor-pointer'}`}
                    >%</button>
                    <button 
                      onClick={() => setSplitsDisplayMode('dollar')}
                      className={`text-xs px-2 py-0.5 rounded ${splitsDisplayMode === 'dollar' ? 'bg-blue-600 text-white font-medium' : 'text-blue-600 hover:bg-blue-100 underline cursor-pointer'}`}
                    >$</button>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">{splitsDisplayMode === 'percent' ? 'House Split %' : 'House Split'}</span>
                    <span className="text-xs font-medium text-gray-900">
                      {splitsDisplayMode === 'percent' ? formatPercent(houseSplit) : formatCurrency(commissionNetHouse)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">{splitsDisplayMode === 'percent' ? 'House Rep Split %' : 'House Rep Split'}</span>
                    <span className="text-xs font-medium text-gray-900 underline">
                      + {splitsDisplayMode === 'percent' ? formatPercent(houseRepSplit) : formatCurrency(commissionNetHouseRep)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">{splitsDisplayMode === 'percent' ? 'Subagent Split %' : 'Subagent Split'}</span>
                    <span className="text-xs font-medium text-gray-900">
                      + {splitsDisplayMode === 'percent' ? formatPercent(subagentSplit) : formatCurrency(commissionNetSubagent)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-gray-100 -mx-1 px-1 py-0.5 rounded">
                    <span className="text-xs text-gray-700 font-bold">{splitsDisplayMode === 'percent' ? 'Total Split %' : 'Total Split'}</span>
                    <span className="text-xs font-bold text-gray-900">
                      = {splitsDisplayMode === 'percent' ? formatPercent(houseSplit + houseRepSplit + subagentSplit) : formatCurrency(actualCommissionNet)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 mt-1 border-t border-gray-300">
                    <span className="text-xs text-gray-600">Expected Rate %</span>
                    <span className="text-xs font-medium text-gray-900">{formatPercent(expectedCommissionRate)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-blue-600">Actual Rate %</span>
                    <span className="text-xs font-medium text-blue-600 underline cursor-pointer">- {formatPercent(actualCommissionRate)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 mt-1 border-t border-gray-300 bg-gray-100 -mx-1 px-1 py-0.5 rounded">
                    <span className="text-xs text-gray-700 font-bold">Commission Rate Difference</span>
                    <span className={`text-xs font-bold ${actualCommissionRateDiff === 0 ? 'text-gray-900' : actualCommissionRateDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      = {formatPercentDiff(actualCommissionRateDiff)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>

          {/* Dividing Line between Financial Summary and Tabs */}
          <div className="border-t-2 border-gray-300"></div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {/* Commission Splits */}
            {activeTab === 'splits' && <CommissionSplitsContent />}

            {/* Opportunity Details Tab */}
            {activeTab === 'opportunity' && (
              <div>
                {/* 
                  Opportunity Details - Deposit Data Flow Business Logic:
                  
                  When deposit line items are matched/reconciled to this revenue schedule:
                  1. KNOWN ID FIELDS (House, Vendor, Distributor IDs) from the deposit:
                     - Account ID, Order ID, Customer ID, Location ID, Service ID
                     - These specific fields flow: Deposit → Revenue Schedule → Opportunity "Details" fields
                     - Updates the corresponding row in the consolidated IDs table below
                     - If the Opportunity already has values, they are updated/overwritten
                  
                  2. This is DIFFERENT from the Additional Information tab behavior:
                     - Additional Information receives OTHER metadata fields (Services, Product Name, Sales ID, Product Code, etc.)
                     - Fields NOT present in the revenue schedule create NEW fields in Vendor/Distributor Product Metadata
                     
                  Summary:
                  - Known ID fields → Update Opportunity Details (this tab)
                  - Unknown/new metadata fields → Create in Additional Information tab
                */}
                {/* Consolidated IDs Table */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-blue-900 text-white px-3 py-2">
                    <h4 className="text-xs font-semibold">Account, Order, Customer, Location & Service IDs</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2"></th>
                          <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2">Account ID</th>
                          <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2">Order ID</th>
                          <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2">Customer ID</th>
                          <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2">Location ID</th>
                          <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2">Service ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs font-medium text-gray-600">HOUSE</td>
                          <td className="px-3 py-2 text-xs text-gray-900">233</td>
                          <td className="px-3 py-2 text-xs text-gray-900">001231</td>
                          <td className="px-3 py-2 text-xs text-gray-900">0012</td>
                          <td className="px-3 py-2 text-xs text-gray-900">0015</td>
                          <td className="px-3 py-2 text-xs text-gray-900">132433</td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs font-medium text-gray-600">VENDOR</td>
                          <td className="px-3 py-2 text-xs text-gray-900">0008</td>
                          <td className="px-3 py-2 text-xs text-gray-900">0016</td>
                          <td className="px-3 py-2 text-xs text-gray-900">0013</td>
                          <td className="px-3 py-2 text-xs text-gray-900">—</td>
                          <td className="px-3 py-2 text-xs text-gray-900">—</td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs font-medium text-gray-600">DISTRIBUTOR</td>
                          <td className="px-3 py-2 text-xs text-gray-900">0002</td>
                          <td className="px-3 py-2 text-xs text-gray-900">0017</td>
                          <td className="px-3 py-2 text-xs text-gray-900">0014</td>
                          <td className="px-3 py-2 text-xs text-gray-900">—</td>
                          <td className="px-3 py-2 text-xs text-gray-900">—</td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs font-medium text-gray-600">CUSTOMER</td>
                          <td className="px-3 py-2 text-xs text-gray-900">0101</td>
                          <td className="px-3 py-2 text-xs text-gray-900">—</td>
                          <td className="px-3 py-2 text-xs text-gray-900">—</td>
                          <td className="px-3 py-2 text-xs text-gray-900">—</td>
                          <td className="px-3 py-2 text-xs text-gray-900">—</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Product Details Tab */}
            {activeTab === 'product' && (
              <div>
                {/* 
                  Vendor/Distributor Product Metadata - Business Logic:
                  
                  IMPORTANT: This section handles DIFFERENT data than Opportunity Details tab.
                  
                  Data Flow from Deposit Line Items:
                  
                  1. KNOWN ID FIELDS (Account ID, Order ID, Customer ID, Location ID, Service ID):
                     - These go to OPPORTUNITY DETAILS tab → Update the consolidated IDs table
                     - They flow: Deposit → Revenue Schedule → Opportunity "Details" fields
                     - NOT displayed here
                  
                  2. OTHER METADATA FIELDS (handled by THIS section):
                     - Any field NOT already present in the revenue schedule
                     - Examples: Services, Product Name - Vendor, Sales ID, Product Code, etc.
                     - These create NEW fields in the Vendor/Distributor Product Metadata cards below
                  
                  Field Population Rules:
                  - If a field label already exists in this section: Value is amended/updated
                  - If the field label is NEW: System adds a new field with that label
                  - Fields populate within each card column from top to bottom
                  - Once a column reaches the bottom margin, new fields flow to the next column (2nd, 3rd, 4th)
                  - Each reconciled deposit gets its own card with its associated metadata fields
                */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-blue-900 text-white px-3 py-2">
                    <h4 className="text-xs font-semibold">Vendor/Distributor Product Metadata</h4>
                  </div>
                  <div className="p-3 bg-gray-50">
                    <p className="text-xs text-gray-500 italic mb-3">
                      This section displays metadata from vendor/distributor deposit line items as they are reconciled with this revenue schedule. 
                      Known ID fields (Account, Order, Customer, Location, Service) update the Opportunity Details tab. 
                      Other metadata fields not present on the schedule are added here dynamically. Data is read-only.
                    </p>
                    
                    <div className="grid grid-cols-4 gap-3">
                      {/* Commission Deposit Metadata Card */}
                      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                        <div className="bg-gray-100 border-b border-gray-200 px-3 py-1.5 flex justify-between items-center">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs bg-blue-900 text-white px-2 py-0.5 rounded font-medium">Commission Deposit</span>
                            <span className="text-xs font-semibold text-gray-700">DEP-2025-001</span>
                          </div>
                        </div>
                        <div className="p-3 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Reconciled</span>
                            <span className="text-xs font-medium text-gray-900">2025-12-01</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Services</span>
                            <span className="text-xs font-medium text-gray-900">Ethernet Fiber</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Product Name - Vendor</span>
                            <span className="text-xs font-medium text-gray-900">ADI</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Sales ID</span>
                            <span className="text-xs font-medium text-gray-900">EL004348</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Product Code</span>
                            <span className="text-xs font-medium text-gray-900">IN</span>
                          </div>
                        </div>
                      </div>

                      {/* Empty Placeholder Card 2 */}
                      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                        <div className="bg-gray-100 border-b border-gray-200 px-3 py-1.5 flex justify-between items-center">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded font-medium">—</span>
                            <span className="text-xs font-semibold text-gray-400">No Data</span>
                          </div>
                        </div>
                        <div className="p-3 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">New Field</span>
                            <span className="text-xs font-medium text-gray-400">—</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">New Field</span>
                            <span className="text-xs font-medium text-gray-400">—</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">New Field</span>
                            <span className="text-xs font-medium text-gray-400">—</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">New Field</span>
                            <span className="text-xs font-medium text-gray-400">—</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">New Field</span>
                            <span className="text-xs font-medium text-gray-400">—</span>
                          </div>
                        </div>
                      </div>

                      {/* Empty Placeholder Card 3 */}
                      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                        <div className="bg-gray-100 border-b border-gray-200 px-3 py-1.5 flex justify-between items-center">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded font-medium">—</span>
                            <span className="text-xs font-semibold text-gray-400">No Data</span>
                          </div>
                        </div>
                        <div className="p-3 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">New Field</span>
                            <span className="text-xs font-medium text-gray-400">—</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">New Field</span>
                            <span className="text-xs font-medium text-gray-400">—</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">New Field</span>
                            <span className="text-xs font-medium text-gray-400">—</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">New Field</span>
                            <span className="text-xs font-medium text-gray-400">—</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">New Field</span>
                            <span className="text-xs font-medium text-gray-400">—</span>
                          </div>
                        </div>
                      </div>

                      {/* Empty Placeholder Card 4 */}
                      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                        <div className="bg-gray-100 border-b border-gray-200 px-3 py-1.5 flex justify-between items-center">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded font-medium">—</span>
                            <span className="text-xs font-semibold text-gray-400">No Data</span>
                          </div>
                        </div>
                        <div className="p-3 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">New Field</span>
                            <span className="text-xs font-medium text-gray-400">—</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">New Field</span>
                            <span className="text-xs font-medium text-gray-400">—</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">New Field</span>
                            <span className="text-xs font-medium text-gray-400">—</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">New Field</span>
                            <span className="text-xs font-medium text-gray-400">—</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">New Field</span>
                            <span className="text-xs font-medium text-gray-400">—</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Transactions Tab - Streamlined Single-Row Design */}
            {activeTab === 'transactions' && (
              <div className="space-y-3">
                {/* Full-Width Transaction Ledger */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-blue-900 text-white px-3 py-1.5 flex justify-between items-center">
                    <div className="flex items-center">
                      <h4 className="text-xs font-semibold">Transaction Ledger</h4>
                      <span className="text-xs text-blue-300 italic" style={{ marginLeft: '24px', marginRight: '12px' }}>Choose One:</span>
                      <div className="flex items-center space-x-1">
                        <button 
                          onClick={() => { setTransactionFilter('all'); setPaymentSplitFilter('all'); }}
                          className={`text-xs px-2 py-0.5 rounded ${transactionFilter === 'all' ? 'bg-white text-blue-900 font-medium' : 'bg-blue-700 hover:bg-blue-600'}`}
                        >All</button>
                        <button 
                          onClick={() => setTransactionFilter('billings')}
                          className={`text-xs px-2 py-0.5 rounded ${transactionFilter === 'billings' ? 'bg-white text-blue-900 font-medium' : 'bg-blue-700 hover:bg-blue-600'}`}
                        >Billings</button>
                        <button 
                          onClick={() => setTransactionFilter('deposits')}
                          className={`text-xs px-2 py-0.5 rounded ${transactionFilter === 'deposits' ? 'bg-white text-blue-900 font-medium' : 'bg-blue-700 hover:bg-blue-600'}`}
                        >Commission Deposits</button>
                        <button 
                          onClick={() => setTransactionFilter('payments')}
                          className={`text-xs px-2 py-0.5 rounded ${transactionFilter === 'payments' ? 'bg-white text-blue-900 font-medium' : 'bg-blue-700 hover:bg-blue-600'}`}
                        >Payments</button>
                        {transactionFilter === 'payments' && (
                          <select
                            value={paymentSplitFilter}
                            onChange={(e) => setPaymentSplitFilter(e.target.value)}
                            className="text-xs bg-blue-700 text-white border-none rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-white ml-1"
                          >
                            <option value="all">All Splits</option>
                            <option value="subagent">Subagent</option>
                            <option value="houseRep">House Rep</option>
                          </select>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-blue-200">{transactionFilter === 'all' ? 4 : transactionFilter === 'billings' ? 1 : transactionFilter === 'deposits' ? 1 : (paymentSplitFilter === 'all' ? 2 : 1)} transactions</span>
                  </div>
                  
                  {/* Full-Width Table */}
                  <div className="overflow-auto" style={{ maxHeight: '350px' }}>
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left text-xs font-semibold text-gray-600 px-2 py-2 whitespace-nowrap">Date</th>
                          <th className="text-left text-xs font-semibold text-gray-600 px-2 py-2 whitespace-nowrap">Type</th>
                          <th className="text-left text-xs font-semibold text-gray-600 px-2 py-2 whitespace-nowrap">Account</th>
                          <th className="text-left text-xs font-semibold text-gray-600 px-2 py-2 whitespace-nowrap">Split</th>
                          <th className="text-left text-xs font-semibold text-gray-600 px-2 py-2 whitespace-nowrap">ID</th>
                          <th className="text-right text-xs font-semibold text-gray-600 px-2 py-2 whitespace-nowrap">Amount</th>
                          <th className="text-right text-xs font-semibold text-gray-600 px-2 py-2 whitespace-nowrap">Commission</th>
                          <th className="text-right text-xs font-semibold text-gray-600 px-2 py-2 whitespace-nowrap">Paid</th>
                          <th className="text-right text-xs font-semibold text-gray-600 px-2 py-2 whitespace-nowrap">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Billing Row */}
                        {(transactionFilter === 'all' || transactionFilter === 'billings') && (
                          <tr className="hover:bg-gray-50 border-b border-gray-200">
                            <td className="px-2 py-2 text-xs text-gray-900 whitespace-nowrap">2025-11-15</td>
                            <td className="px-2 py-2 whitespace-nowrap"><span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Billing</span></td>
                            <td className="px-2 py-2 text-xs text-gray-900 whitespace-nowrap">DW Realty GA</td>
                            <td className="px-2 py-2 text-xs text-gray-500 whitespace-nowrap">—</td>
                            <td className="px-2 py-2 text-xs text-blue-600 whitespace-nowrap">BIL-2025-001</td>
                            <td className="px-2 py-2 text-xs text-right font-medium text-green-600 whitespace-nowrap">+{formatCurrency(actualUsageGross)}</td>
                            <td className="px-2 py-2 text-xs text-right text-gray-500 whitespace-nowrap">—</td>
                            <td className="px-2 py-2 text-xs text-right text-gray-500 whitespace-nowrap">—</td>
                            <td className="px-2 py-2 text-xs text-right text-gray-500 whitespace-nowrap">—</td>
                          </tr>
                        )}

                        {/* Commission Deposit Row */}
                        {(transactionFilter === 'all' || transactionFilter === 'deposits') && (
                          <tr className="hover:bg-gray-50 border-b border-gray-200">
                            <td className="px-2 py-2 text-xs text-gray-900 whitespace-nowrap">2025-12-01</td>
                            <td className="px-2 py-2 whitespace-nowrap"><span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Commission Deposit</span></td>
                            <td className="px-2 py-2 text-xs text-gray-900 whitespace-nowrap">Telarus</td>
                            <td className="px-2 py-2 text-xs text-gray-500 whitespace-nowrap">—</td>
                            <td className="px-2 py-2 text-xs text-blue-600 whitespace-nowrap">DEP-2025-001</td>
                            <td className="px-2 py-2 text-xs text-right text-gray-500 whitespace-nowrap">—</td>
                            <td className="px-2 py-2 text-xs text-right font-medium text-green-600 whitespace-nowrap">+{formatCurrency(actualCommissionNet)}</td>
                            <td className="px-2 py-2 text-xs text-right text-gray-500 whitespace-nowrap">—</td>
                            <td className="px-2 py-2 text-xs text-right text-gray-500 whitespace-nowrap">—</td>
                          </tr>
                        )}

                        {/* Subagent Payment Row */}
                        {(transactionFilter === 'all' || transactionFilter === 'payments') && (paymentSplitFilter === 'all' || paymentSplitFilter === 'subagent') && (
                          <tr className="hover:bg-gray-50 border-b border-gray-200">
                            <td className="px-2 py-2 text-xs text-gray-900 whitespace-nowrap">2025-12-05</td>
                            <td className="px-2 py-2 whitespace-nowrap"><span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Payment</span></td>
                            <td className="px-2 py-2 text-xs text-gray-900 whitespace-nowrap">Jim Smith</td>
                            <td className="px-2 py-2 whitespace-nowrap"><span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Subagent {formatPercent(subagentSplit)}</span></td>
                            <td className="px-2 py-2 text-xs text-blue-600 whitespace-nowrap">PAY-2025-001</td>
                            <td className="px-2 py-2 text-xs text-right text-gray-500 whitespace-nowrap">—</td>
                            <td className="px-2 py-2 text-xs text-right text-gray-500 whitespace-nowrap">—</td>
                            <td className="px-2 py-2 text-xs text-right font-medium text-red-600 whitespace-nowrap">-{formatCurrency(commissionNetSubagent)}</td>
                            <td className="px-2 py-2 text-xs text-right text-gray-500 whitespace-nowrap">—</td>
                          </tr>
                        )}

                        {/* House Rep Payment Row */}
                        {(transactionFilter === 'all' || transactionFilter === 'payments') && (paymentSplitFilter === 'all' || paymentSplitFilter === 'houseRep') && (
                          <tr className="hover:bg-gray-50 border-b border-gray-200">
                            <td className="px-2 py-2 text-xs text-gray-900 whitespace-nowrap">2025-12-05</td>
                            <td className="px-2 py-2 whitespace-nowrap"><span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Payment</span></td>
                            <td className="px-2 py-2 text-xs text-gray-900 whitespace-nowrap">Jane Smith</td>
                            <td className="px-2 py-2 whitespace-nowrap"><span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">House Rep {formatPercent(houseRepSplit)}</span></td>
                            <td className="px-2 py-2 text-xs text-blue-600 whitespace-nowrap">PAY-2025-002</td>
                            <td className="px-2 py-2 text-xs text-right text-gray-500 whitespace-nowrap">—</td>
                            <td className="px-2 py-2 text-xs text-right text-gray-500 whitespace-nowrap">—</td>
                            <td className="px-2 py-2 text-xs text-right font-medium text-red-600 whitespace-nowrap">-{formatCurrency(commissionNetHouseRep)}</td>
                            <td className="px-2 py-2 text-xs text-right text-gray-500 whitespace-nowrap">—</td>
                          </tr>
                        )}

                        {/* Totals Row */}
                        <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                          <td className="px-2 py-2 text-xs text-gray-700 whitespace-nowrap" colSpan={5}>TOTALS</td>
                          <td className="px-2 py-2 text-xs text-right font-bold text-blue-600 whitespace-nowrap">{formatCurrency(actualUsageGross)}</td>
                          <td className="px-2 py-2 text-xs text-right font-bold text-green-600 whitespace-nowrap">{formatCurrency(actualCommissionNet)}</td>
                          <td className="px-2 py-2 text-xs text-right font-bold text-red-600 whitespace-nowrap">-{formatCurrency(commissionNetSubagent + commissionNetHouseRep)}</td>
                          <td className="px-2 py-2 text-xs text-right font-bold text-blue-900 whitespace-nowrap">{formatCurrency(actualCommissionNet - (commissionNetSubagent + commissionNetHouseRep))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Activities and Notes Tab */}
            {activeTab === 'activities' && (
              <div className="space-y-4">
                {/* Search and Filter Bar */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    {/* Search */}
                    <div className="relative flex-1 max-w-xs">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search activities"
                        className="w-full pl-10 pr-4 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    {/* Status Filter */}
                    <select className="px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Active</option>
                      <option>All</option>
                      <option>Completed</option>
                      <option>Pending</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Create New Button */}
                    <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create New
                    </button>
                    {/* Settings Icon */}
                    <button className="p-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    {/* Column Filter */}
                    <select className="px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Filter By Column</option>
                      <option>Activity ID</option>
                      <option>Activity Date</option>
                      <option>Activity Type</option>
                      <option>Activity Owner</option>
                      <option>Activity Status</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Enter filter value"
                      className="px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
                    />
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-medium">
                      Apply Filter
                    </button>
                  </div>
                </div>

                {/* Activities Table */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-blue-900 text-white">
                        <tr>
                          <th className="px-3 py-2 text-left">
                            <input type="checkbox" className="rounded border-gray-300" />
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">
                            <div className="flex items-center gap-1 cursor-pointer">
                              Activity ID
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                              </svg>
                            </div>
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">
                            <div className="flex items-center gap-1 cursor-pointer">
                              Activity Date
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                              </svg>
                            </div>
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">
                            <div className="flex items-center gap-1 cursor-pointer">
                              Activity Type
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                              </svg>
                            </div>
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">
                            <div className="flex items-center gap-1 cursor-pointer">
                              Activity Owner
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                              </svg>
                            </div>
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">
                            <div className="flex items-center gap-1 cursor-pointer">
                              Activity Description
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                              </svg>
                            </div>
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">
                            <div className="flex items-center gap-1 cursor-pointer">
                              Activity Status
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                              </svg>
                            </div>
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">
                            <div className="flex items-center gap-1 cursor-pointer">
                              Attachment
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                              </svg>
                            </div>
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">
                            <div className="flex items-center gap-1 cursor-pointer">
                              File Name
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                              </svg>
                            </div>
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">Created By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {/* Sample Activity Row 1 */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <input type="checkbox" className="rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2 text-xs font-medium text-blue-600 cursor-pointer hover:underline">ACT-001</td>
                          <td className="px-3 py-2 text-xs text-gray-900">2025-12-01</td>
                          <td className="px-3 py-2">
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Note</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-900">Avery Admin</td>
                          <td className="px-3 py-2 text-xs text-gray-900">Initial revenue schedule created for DW Realty Partners</td>
                          <td className="px-3 py-2">
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Active</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">—</td>
                          <td className="px-3 py-2 text-xs text-gray-500">—</td>
                          <td className="px-3 py-2 text-xs text-gray-900">Avery Admin</td>
                        </tr>
                        {/* Sample Activity Row 2 */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <input type="checkbox" className="rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2 text-xs font-medium text-blue-600 cursor-pointer hover:underline">ACT-002</td>
                          <td className="px-3 py-2 text-xs text-gray-900">2025-12-01</td>
                          <td className="px-3 py-2">
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Task</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-900">Jane Smith</td>
                          <td className="px-3 py-2 text-xs text-gray-900">Verify commission rate with vendor</td>
                          <td className="px-3 py-2">
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Completed</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">—</td>
                          <td className="px-3 py-2 text-xs text-gray-500">—</td>
                          <td className="px-3 py-2 text-xs text-gray-900">Jane Smith</td>
                        </tr>
                        {/* Sample Activity Row 3 */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <input type="checkbox" className="rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2 text-xs font-medium text-blue-600 cursor-pointer hover:underline">ACT-003</td>
                          <td className="px-3 py-2 text-xs text-gray-900">2025-12-05</td>
                          <td className="px-3 py-2">
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">File</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-900">Avery Admin</td>
                          <td className="px-3 py-2 text-xs text-gray-900">Uploaded vendor payment confirmation</td>
                          <td className="px-3 py-2">
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Active</span>
                          </td>
                          <td className="px-3 py-2">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                          </td>
                          <td className="px-3 py-2 text-xs text-blue-600 cursor-pointer hover:underline">payment_confirm.pdf</td>
                          <td className="px-3 py-2 text-xs text-gray-900">Avery Admin</td>
                        </tr>
                        {/* Sample Activity Row 4 */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <input type="checkbox" className="rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2 text-xs font-medium text-blue-600 cursor-pointer hover:underline">ACT-004</td>
                          <td className="px-3 py-2 text-xs text-gray-900">2025-12-05</td>
                          <td className="px-3 py-2">
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Note</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-900">Avery Admin</td>
                          <td className="px-3 py-2 text-xs text-gray-900">Commission deposit received and reconciled</td>
                          <td className="px-3 py-2">
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Active</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">—</td>
                          <td className="px-3 py-2 text-xs text-gray-500">—</td>
                          <td className="px-3 py-2 text-xs text-gray-900">Avery Admin</td>
                        </tr>
                        {/* Sample Activity Row 5 */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <input type="checkbox" className="rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2 text-xs font-medium text-blue-600 cursor-pointer hover:underline">ACT-005</td>
                          <td className="px-3 py-2 text-xs text-gray-900">2025-12-06</td>
                          <td className="px-3 py-2">
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Task</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-900">Jane Smith</td>
                          <td className="px-3 py-2 text-xs text-gray-900">Process Algave LLC payment for remaining balance</td>
                          <td className="px-3 py-2">
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Pending</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">—</td>
                          <td className="px-3 py-2 text-xs text-gray-500">—</td>
                          <td className="px-3 py-2 text-xs text-gray-900">Avery Admin</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded">Previous</button>
                    <button className="px-3 py-1 text-xs bg-blue-600 text-white rounded">1</button>
                    <button className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded">Next</button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span>Showing 1 to 5 of 5 entries</span>
                    <span className="ml-4">Show</span>
                    <select className="px-2 py-1 border border-gray-300 rounded text-xs">
                      <option>10</option>
                      <option>25</option>
                      <option>50</option>
                    </select>
                    <span>entries</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tickets Tab */}
            {activeTab === 'tickets' && (
              <div className="space-y-4">
                {/* Header with Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {/* Search */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search tickets..."
                        className="pl-8 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                      />
                      <svg className="w-4 h-4 text-gray-400 absolute left-2 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    {/* Settings */}
                    <button className="p-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    {/* Column Filter */}
                    <select className="px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Filter By Column</option>
                      <option>Ticket ID</option>
                      <option>Created Date</option>
                      <option>Priority</option>
                      <option>Status</option>
                      <option>Assigned To</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Enter filter value"
                      className="px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
                    />
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-medium">
                      Apply Filter
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-medium">
                      Create Ticket
                    </button>
                  </div>
                </div>

                {/* Tickets Table */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-blue-900 text-white">
                        <tr>
                          <th className="px-3 py-2 text-left">
                            <input type="checkbox" className="rounded border-gray-300" />
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">
                            <div className="flex items-center gap-1 cursor-pointer">
                              Ticket ID
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                              </svg>
                            </div>
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">
                            <div className="flex items-center gap-1 cursor-pointer">
                              Created Date
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                              </svg>
                            </div>
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">
                            <div className="flex items-center gap-1 cursor-pointer">
                              Subject
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                              </svg>
                            </div>
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">
                            <div className="flex items-center gap-1 cursor-pointer">
                              Priority
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                              </svg>
                            </div>
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">
                            <div className="flex items-center gap-1 cursor-pointer">
                              Status
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                              </svg>
                            </div>
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">
                            <div className="flex items-center gap-1 cursor-pointer">
                              Assigned To
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                              </svg>
                            </div>
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">
                            <div className="flex items-center gap-1 cursor-pointer">
                              Last Updated
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z"/>
                              </svg>
                            </div>
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold">Created By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {/* Sample Ticket Row 1 */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <input type="checkbox" className="rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2 text-xs font-medium text-blue-600 cursor-pointer hover:underline">TKT-001</td>
                          <td className="px-3 py-2 text-xs text-gray-900">2025-12-01</td>
                          <td className="px-3 py-2 text-xs text-gray-900">Commission discrepancy investigation</td>
                          <td className="px-3 py-2">
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">High</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">In Progress</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-900">Jane Smith</td>
                          <td className="px-3 py-2 text-xs text-gray-900">2025-12-03</td>
                          <td className="px-3 py-2 text-xs text-gray-900">Rob Hootselle</td>
                        </tr>
                        {/* Sample Ticket Row 2 */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <input type="checkbox" className="rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2 text-xs font-medium text-blue-600 cursor-pointer hover:underline">TKT-002</td>
                          <td className="px-3 py-2 text-xs text-gray-900">2025-12-02</td>
                          <td className="px-3 py-2 text-xs text-gray-900">Vendor payment delay inquiry</td>
                          <td className="px-3 py-2">
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Medium</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Resolved</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-900">Avery Admin</td>
                          <td className="px-3 py-2 text-xs text-gray-900">2025-12-04</td>
                          <td className="px-3 py-2 text-xs text-gray-900">Jane Smith</td>
                        </tr>
                        {/* Sample Ticket Row 3 */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <input type="checkbox" className="rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2 text-xs font-medium text-blue-600 cursor-pointer hover:underline">TKT-003</td>
                          <td className="px-3 py-2 text-xs text-gray-900">2025-12-05</td>
                          <td className="px-3 py-2 text-xs text-gray-900">Update billing address request</td>
                          <td className="px-3 py-2">
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">Low</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Open</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">Unassigned</td>
                          <td className="px-3 py-2 text-xs text-gray-900">2025-12-05</td>
                          <td className="px-3 py-2 text-xs text-gray-900">Rob Hootselle</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded">Previous</button>
                    <button className="px-3 py-1 text-xs bg-blue-600 text-white rounded">1</button>
                    <button className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded">Next</button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span>Showing 1 to 3 of 3 entries</span>
                    <span className="ml-4">Show</span>
                    <select className="px-2 py-1 border border-gray-300 rounded text-xs">
                      <option>10</option>
                      <option>25</option>
                      <option>50</option>
                    </select>
                    <span>entries</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueScheduleDetail;
