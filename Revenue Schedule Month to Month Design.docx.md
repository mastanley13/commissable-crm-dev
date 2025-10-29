**Revenue Schedule Data Flow Guide**

**For Development Team** **Commissable SaaS Platform**

---

**Document Purpose**

This guide provides development staff with a clear understanding of data sources, relationships, and processing logic for the Revenue Schedule creation functionality. Every field's origin and destination is mapped to ensure accurate implementation.

---

**Quick Overview**

When a user creates a Revenue Schedule, data flows from **5 core sources** through **3 processing steps** to create **2 main entities**. This guide maps exactly where every piece of data comes from and where it goes.

**High-Level Data Flow**

DATA SOURCES                    PROCESSING                    ENTITIES CREATED  
┌─────────────────┐             ┌─────────────────┐          ┌─────────────────┐  
│ 1\. Account      │────────────▶│ User Form Input │─────────▶│ Opportunity     │  
│ 2\. Product      │             │ Validation      │          │ Line Item       │  
│ 3\. Opportunity  │             │ Schedule Logic  │          │                 │  
│ 4\. Contacts     │             └─────────────────┘          ├─────────────────┤  
│ 5\. Deposits     │                                          │ Revenue         │  
└─────────────────┘                                          │ Schedule(s)     │  
                                                             └─────────────────┘  
---

**Data Sources and Field Origins**

**Account Data (Pre-existing Records)**

**Source Table:** accounts **Relationship:** One-to-many with opportunities **Access:** Read-only during schedule creation

| Field Name | Database Column | Usage Notes |
| ----- | ----- | ----- |
| Account Name | accounts.name | Display only, user context |
| Account Legal Name | accounts.legal\_name | Contract documentation |
| Billing Address | accounts.billing\_address | Auto-populated, financial records |
| Shipping Address | accounts.shipping\_address | Service location, fallback option |
| Owner | accounts.owner\_id | User assignment and permissions |

**Opportunity Data (Pre-existing Records)**

**Source Table:** opportunities **Relationship:** Parent container for line items **Access:** Read-only during schedule creation

| Field Name | Database Column | Usage Notes |
| ----- | ----- | ----- |
| Opportunity ID | opportunities.id | Primary foreign key relationship |
| Opportunity Name | opportunities.name | Context and display |
| Opportunity Stage | opportunities.stage | Status tracking |
| Estimated Close Date | opportunities.close\_date | Timeline reference |
| Opportunity Description | opportunities.description | Additional context |

**Product Catalog Data (Cascading Lookups)**

**Source Tables:** distributors, vendors, product\_families, products **Relationship:** Hierarchical filtering chain **Access:** Read-only, provides defaults and validation

| Field Name | Source Table | Lookup Chain | Notes |
| ----- | ----- | ----- | ----- |
| Distributor Name | distributors.name | User selects → filters vendors | First selection |
| Vendor Name | vendors.name | Filtered by distributor → filters families | Second selection |
| Product Family | product\_families.name | Filtered by vendor → filters products | Third selection |
| Product Name | products.name | Filtered by family → provides defaults | Final selection |
| Default Price | products.default\_price | Auto-populated | User can override |

**User Form Input (New Data Entry)**

**Source:** User interface form submission **Validation:** Applied before database operations **Storage:** opportunity\_line\_items table

| Field Name | Input Type | Validation Rules | Default Value |
| ----- | ----- | ----- | ----- |
| Order ID | Text (optional) | External vendor reference | None |
| Quantity | Integer | Must be ≥ 1 | 1 |
| Price Each | Decimal | Must be \> 0 | From product catalog |
| Expected Commission Rate % | Decimal | Must be ≥ 0 | User entry required |
| Number of Periods | Integer | Range: 1-60 | User entry required |
| Schedule Start Date | Date | ±12/24 month limits | 1st of current month |

**Commission Split Configuration**

**Source:** User configuration or manual entry **Validation:** Must sum to 100% (±0.01 tolerance) **Storage:** revenue\_schedules table

| Field Name | Data Type | Validation | Usage |
| ----- | ----- | ----- | ----- |
| House Split % | Decimal | Part of 100% total | Commission allocation |
| House Rep % | Decimal | Part of 100% total | Commission allocation |
| Subagent % | Decimal | Part of 100% total | Commission allocation |

---

**Data Processing Logic**

**Step 1: Form Validation**

**Function:** validateScheduleForm() **Purpose:** Ensure data integrity before processing

// Validation Logic Pseudo-code  
function validateScheduleForm(formData) {  
    // Required field validation  
    const requiredFields \= \[  
        'distributor', 'vendor', 'productFamily', 'productName',  
        'quantity', 'priceEach', 'periods', 'startDate'  
    \];  
      
    // Business rule validation  
    if (formData.quantity \< 1\) throw "Quantity must be ≥ 1";  
    if (formData.priceEach \<= 0\) throw "Price Each must be \> 0";  
    if (formData.commissionRate \< 0\) throw "Commission Rate must be ≥ 0";  
    if (formData.periods \< 1 || formData.periods \> 60\) throw "Periods must be 1-60";  
      
    // Split validation  
    const splitTotal \= formData.houseSplit \+ formData.repSplit \+ formData.subagentSplit;  
    if (Math.abs(splitTotal \- 100\) \> 0.01) throw "Splits must sum to 100%";  
      
    // Date validation  
    validateDateRange(formData.startDate);  
      
    return true;  
}

**Step 2: Schedule Generation Logic**

**Function:** generateRevenueSchedules() **Purpose:** Create multiple schedule records based on periods

// Schedule Generation Logic  
function generateRevenueSchedules(lineItemData) {  
    const schedules \= \[\];  
    let currentDate \= getFirstOfMonth(lineItemData.startDate);  
      
    for (let i \= 0; i \< lineItemData.periods; i++) {  
        const schedule \= {  
            opportunityId: lineItemData.opportunityId,  
            lineItemId: lineItemData.id,  
            scheduleDate: currentDate,  
            usageExpectedGross: lineItemData.quantity \* lineItemData.priceEach,  
            commissionExpected: calculateCommission(lineItemData),  
            splitHousePercent: lineItemData.houseSplit,  
            splitRepPercent: lineItemData.repSplit,  
            splitSubagentPercent: lineItemData.subagentSplit,  
            status: 'Unreconciled'  
        };  
          
        schedules.push(schedule);  
        currentDate \= addMonths(currentDate, 1);  
    }  
      
    return schedules;  
}

**Step 3: Database Transaction**

**Function:** createRevenueScheduleTransaction() **Purpose:** Atomic creation of line item and schedules

\-- Database Transaction Logic  
BEGIN TRANSACTION;

\-- Step 3a: Create Opportunity Line Item  
INSERT INTO opportunity\_line\_items (  
    opportunity\_id, distributor\_id, vendor\_id,   
    product\_family\_id, product\_id, order\_id,  
    quantity, unit\_price, expected\_commission\_rate,  
    periods, start\_date, created\_at, updated\_at  
) VALUES (  
    @opportunityId, @distributorId, @vendorId,  
    @productFamilyId, @productId, @orderId,  
    @quantity, @unitPrice, @expectedCommissionRate,  
    @periods, @startDate, NOW(), NOW()  
);

\-- Get the created line item ID  
SET @lineItemId \= LAST\_INSERT\_ID();

\-- Step 3b: Create Multiple Revenue Schedules  
INSERT INTO revenue\_schedules (  
    opportunity\_id, line\_item\_id, schedule\_date,  
    usage\_expected\_gross, usage\_expected\_net,  
    commission\_expected, commission\_actual,  
    split\_house\_percent, split\_rep\_percent, split\_subagent\_percent,  
    status, created\_at, updated\_at  
) VALUES   
    (@opportunityId, @lineItemId, @scheduleDate1, @usageGross1, @usageNet1, @commissionExp1, 0, @houseSplit, @repSplit, @subagentSplit, 'Unreconciled', NOW(), NOW()),  
    (@opportunityId, @lineItemId, @scheduleDate2, @usageGross2, @usageNet2, @commissionExp2, 0, @houseSplit, @repSplit, @subagentSplit, 'Unreconciled', NOW(), NOW()),  
    \-- ... additional schedules for each period  
    ;

COMMIT TRANSACTION;  
---

**Entity Relationships and Database Schema**

**Primary Relationships**

accounts (1) ────────────── (many) opportunities  
    │                              │  
    │                              │  
    └── billing\_address            └── (many) opportunity\_line\_items  
    └── shipping\_address                      │  
                                              │  
distributors (1) ──── (many) vendors         │  
    │                        │               │  
    └── name                 └── (many) product\_families  
                                     │       │  
                                     └── (many) products  
                                             │  
                                             │  
opportunity\_line\_items (1) ─────────── (many) revenue\_schedules  
            │                                │  
            │                                │  
contacts ───┘                                │  
deposits ────────────────────────────────────┘

**Key Foreign Key Constraints**

| Child Table | Parent Table | Foreign Key | Constraint |
| ----- | ----- | ----- | ----- |
| opportunities | accounts | account\_id | CASCADE DELETE |
| opportunity\_line\_items | opportunities | opportunity\_id | CASCADE DELETE |
| opportunity\_line\_items | distributors | distributor\_id | RESTRICT |
| opportunity\_line\_items | vendors | vendor\_id | RESTRICT |
| opportunity\_line\_items | products | product\_id | RESTRICT |
| revenue\_schedules | opportunity\_line\_items | line\_item\_id | CASCADE DELETE |
| revenue\_schedules | opportunities | opportunity\_id | CASCADE DELETE |

---

**API Endpoints and Data Flow**

**Frontend to Backend Communication**

**Create Revenue Schedule**

POST /api/opportunities/{opportunityId}/line-items  
Content-Type: application/json  
Authorization: Bearer {token}

Request Body:  
{  
  "distributorId": 123,  
  "vendorId": 456,  
  "productFamilyId": 789,  
  "productId": 101,  
  "orderId": "EXT-12345",  
  "quantity": 1,  
  "unitPrice": 1000.00,  
  "expectedCommissionRate": 12.0,  
  "periods": 12,  
  "startDate": "2025-09-01",  
  "splits": {  
    "house": 50.0,  
    "rep": 30.0,  
    "subagent": 20.0  
  }  
}

**Backend Processing Sequence**

1\. GET /api/opportunities/{opportunityId}     // Validate access  
2\. GET /api/products/{productId}              // Validate product  
3\. POST /api/validation/schedule-data         // Validate business rules  
4\. POST /api/calculations/schedule-dates      // Calculate schedule dates  
5\. POST /api/database/transaction             // Execute atomic transaction  
6\. GET /api/schedules/created                 // Return created entities

**Response Data Structure**

**Successful Creation Response**

{  
  "success": true,  
  "lineItem": {  
    "id": 999,  
    "opportunityId": 123,  
    "distributorId": 1,  
    "vendorId": 2,  
    "productFamilyId": 3,  
    "productId": 4,  
    "orderId": "EXT-12345",  
    "quantity": 1,  
    "unitPrice": 1000.00,  
    "expectedCommissionRate": 12.0,  
    "periods": 12,  
    "startDate": "2025-09-01",  
    "createdAt": "2025-08-18T10:30:00Z"  
  },  
  "schedules": \[  
    {  
      "id": 1001,  
      "opportunityId": 123,  
      "lineItemId": 999,  
      "scheduleDate": "2025-09-01",  
      "usageExpectedGross": 1000.00,  
      "usageExpectedNet": 1000.00,  
      "commissionExpected": 120.00,  
      "commissionActual": 0.00,  
      "splitHousePercent": 50.0,  
      "splitRepPercent": 30.0,  
      "splitSubagentPercent": 20.0,  
      "status": "Unreconciled"  
    },  
    {  
      "id": 1002,  
      "scheduleDate": "2025-10-01",  
      // ... same structure for remaining 10 months  
    }  
  \],  
  "totalSchedulesCreated": 12  
}  
---

**Calculation Formulas and Business Logic**

**Core Financial Calculations**

| Field | Formula | Example |
| ----- | ----- | ----- |
| **Expected Usage Gross** | Quantity × Price Each | 1 × $1,000 \= $1,000 |
| **Expected Usage Net** | Expected Usage Gross \+ Expected Usage Adjustment | $1,000 \+ $0 \= $1,000 |
| **Commission Expected** | Expected Usage Net × (Expected Commission Rate % ÷ 100\) | $1,000 × (12% ÷ 100\) \= $120 |
| **Commission Net House** | Commission Actual × (House Split % ÷ 100\) | $120 × (50% ÷ 100\) \= $60 |
| **Commission Net Rep** | Commission Actual × (House Rep % ÷ 100\) | $120 × (30% ÷ 100\) \= $36 |
| **Commission Net Subagent** | Commission Actual × (Subagent % ÷ 100\) | $120 × (20% ÷ 100\) \= $24 |

**Schedule Date Calculation Logic**

function calculateScheduleDates(startDate, periods) {  
    const dates \= \[\];  
    let currentDate \= new Date(startDate);  
      
    // Always use 1st of the month  
    currentDate.setDate(1);  
      
    for (let i \= 0; i \< periods; i++) {  
        dates.push(new Date(currentDate));  
          
        // Move to next month  
        currentDate.setMonth(currentDate.getMonth() \+ 1);  
    }  
      
    return dates;  
}

// Example: startDate \= "2025-09-15", periods \= 3  
// Result: \["2025-09-01", "2025-10-01", "2025-11-01"\]  
---

**Critical Dependencies and Error Handling**

**System Dependencies**

| Dependency | Impact if Failed | Mitigation Strategy |
| ----- | ----- | ----- |
| **Product Catalog Lookup** | No default prices, invalid references | Cache frequently used products, provide manual override |
| **Date Validation** | Invalid schedule generation | Server-side validation with clear error messages |
| **Split Validation** | Incorrect commission calculations | Real-time frontend validation \+ backend verification |
| **Transaction Rollback** | Orphaned records, data inconsistency | Proper transaction boundaries, comprehensive logging |
| **Foreign Key Constraints** | Broken relationships, cascade issues | Careful constraint design, referential integrity checks |

**Error Handling Strategies**

**Validation Errors**

// Return structured validation errors  
{  
  "success": false,  
  "errors": {  
    "quantity": "Quantity must be greater than or equal to 1",  
    "priceEach": "Price Each must be greater than 0",  
    "splits": "Commission splits must sum to 100% (currently 98.5%)"  
  },  
  "errorCode": "VALIDATION\_FAILED"  
}

**Transaction Errors**

// Handle database transaction failures  
try {  
    await db.transaction(async (trx) \=\> {  
        const lineItem \= await createLineItem(trx, data);  
        const schedules \= await createSchedules(trx, lineItem.id, data);  
        return { lineItem, schedules };  
    });  
} catch (error) {  
    logger.error('Schedule creation failed', { error, data });  
    return {  
        success: false,  
        message: "Unable to create revenue schedule. Please try again.",  
        errorCode: "TRANSACTION\_FAILED"  
    };  
}  
---

**Month-to-Month (M2M) Automated Schedule Creation**

**Business Context**

When opportunity products complete their initial contract periods but customers continue paying, the system must automatically create ongoing revenue schedules to avoid manual intervention. This "Month-to-Month" functionality prevents administrative overhead while enabling contract renewal tracking.

**Technical Requirements**

**Trigger Conditions**

The M2M automation runs on the 1st of each month and evaluates:

\-- Products eligible for M2M schedule creation  
SELECT ol.id, ol.opportunity\_id, ol.status, MAX(rs.schedule\_date) as last\_schedule  
FROM opportunity\_line\_items ol  
JOIN revenue\_schedules rs ON ol.id \= rs.line\_item\_id  
WHERE ol.status \= 'Billing'  
  AND ol.id NOT IN (  
    SELECT DISTINCT line\_item\_id   
    FROM revenue\_schedules   
    WHERE schedule\_date \>= DATE\_FORMAT(NOW(), '%Y-%m-01')  
  )  
GROUP BY ol.id, ol.opportunity\_id, ol.status;

**Automated Processing Logic**

// Monthly M2M Schedule Creation Process  
async function processMonthToMonthSchedules() {  
    const currentMonth \= new Date();  
    currentMonth.setDate(1); // 1st of current month  
      
    // Find products needing M2M schedules  
    const eligibleProducts \= await findEligibleM2MProducts(currentMonth);  
      
    for (const product of eligibleProducts) {  
        // Get template from most recent schedule  
        const lastSchedule \= await getLastSchedule(product.lineItemId);  
          
        // Create new M2M schedule  
        const newSchedule \= {  
            opportunityId: product.opportunityId,  
            lineItemId: product.lineItemId,  
            scheduleDate: currentMonth,  
            usageExpectedGross: lastSchedule.usageExpectedGross,  
            usageExpectedNet: lastSchedule.usageExpectedNet,  
            commissionExpected: lastSchedule.commissionExpected,  
            splitHousePercent: lastSchedule.splitHousePercent,  
            splitRepPercent: lastSchedule.splitRepPercent,  
            splitSubagentPercent: lastSchedule.splitSubagentPercent,  
            status: 'Unreconciled',  
            isM2M: true // Flag for M2M schedules  
        };  
          
        // Execute transaction  
        await db.transaction(async (trx) \=\> {  
            // Create new schedule  
            await trx('revenue\_schedules').insert(newSchedule);  
              
            // Update product status to M2M  
            await trx('opportunity\_line\_items')  
                .where('id', product.lineItemId)  
                .update({   
                    status: 'Billing \- M2M',  
                    m2m\_start\_date: currentMonth,  
                    updated\_at: new Date()  
                });  
        });  
          
        // Log M2M creation  
        await logM2MActivity(product.lineItemId, currentMonth);  
    }  
}

**Status Management**

| Status | Trigger | Action | Business Purpose |
| ----- | ----- | ----- | ----- |
| **Billing** | Initial contract active | Normal schedule creation | Standard billing cycle |
| **Billing \- M2M** | Contract expired, still billing | Auto-create monthly schedules | Track renewal opportunities |
| **Billing Ended** | No billing activity \>3 months in M2M | Flag schedules for deletion | Cleanup inactive products |

**M2M Cleanup Logic**

// Quarterly cleanup process for inactive M2M products  
async function cleanupInactiveM2MProducts() {  
    const threeMonthsAgo \= new Date();  
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() \- 3);  
      
    // Find M2M products with no deposits for 3+ months  
    const inactiveProducts \= await db('opportunity\_line\_items as ol')  
        .leftJoin('revenue\_schedules as rs', 'ol.id', 'rs.line\_item\_id')  
        .leftJoin('deposit\_line\_items as dl', 'rs.id', 'dl.revenue\_schedule\_id')  
        .where('ol.status', 'Billing \- M2M')  
        .whereNull('dl.id') // No matching deposits  
        .where('rs.schedule\_date', '\<', threeMonthsAgo)  
        .groupBy('ol.id')  
        .select('ol.id', 'ol.opportunity\_id');  
      
    for (const product of inactiveProducts) {  
        await db.transaction(async (trx) \=\> {  
            // Update product status  
            await trx('opportunity\_line\_items')  
                .where('id', product.id)  
                .update({   
                    status: 'Billing Ended',  
                    billing\_end\_date: new Date(),  
                    updated\_at: new Date()  
                });  
              
            // Flag unreconciled M2M schedules for deletion  
            await trx('revenue\_schedules')  
                .where('line\_item\_id', product.id)  
                .where('isM2M', true)  
                .where('status', 'Unreconciled')  
                .update({   
                    flagged\_for\_deletion: true,  
                    flagged\_date: new Date()  
                });  
        });  
    }  
}

**Database Schema Changes**

**Required Table Modifications**

\-- Add M2M tracking fields to opportunity\_line\_items  
ALTER TABLE opportunity\_line\_items   
ADD COLUMN m2m\_start\_date DATE NULL,  
ADD COLUMN billing\_end\_date DATE NULL,  
ADD INDEX idx\_status\_m2m (status, m2m\_start\_date);

\-- Add M2M flag to revenue\_schedules  
ALTER TABLE revenue\_schedules  
ADD COLUMN isM2M BOOLEAN DEFAULT FALSE,  
ADD COLUMN flagged\_for\_deletion BOOLEAN DEFAULT FALSE,  
ADD COLUMN flagged\_date DATE NULL,  
ADD INDEX idx\_m2m\_cleanup (isM2M, flagged\_for\_deletion, schedule\_date);

**Status Enum Updates**

\-- Update status enum to include M2M states  
ALTER TABLE opportunity\_line\_items   
MODIFY COLUMN status ENUM(  
    'Active', 'Billing', 'Billing \- M2M', 'Billing Ended',   
    'Cancelled', 'On Hold'  
) NOT NULL DEFAULT 'Active';

**Scheduled Job Implementation**

**Cron Job Configuration**

// Schedule M2M processing for 1st of each month at 2 AM  
const schedule \= require('node-cron');

// Monthly M2M schedule creation  
schedule.schedule('0 2 1 \* \*', async () \=\> {  
    console.log('Starting M2M schedule creation process...');  
    try {  
        await processMonthToMonthSchedules();  
        console.log('M2M schedule creation completed successfully');  
    } catch (error) {  
        console.error('M2M schedule creation failed:', error);  
        // Alert admin/monitoring system  
        await notifyAdministrators('M2M Schedule Creation Failed', error);  
    }  
});

// Quarterly cleanup on 1st of quarter at 3 AM  
schedule.schedule('0 3 1 \*/3 \*', async () \=\> {  
    console.log('Starting M2M cleanup process...');  
    try {  
        await cleanupInactiveM2MProducts();  
        console.log('M2M cleanup completed successfully');  
    } catch (error) {  
        console.error('M2M cleanup failed:', error);  
        await notifyAdministrators('M2M Cleanup Failed', error);  
    }  
});

**Reporting Integration**

**M2M Products Report Query**

\-- Products eligible for contract renewal (M2M status)  
SELECT   
    a.name as account\_name,  
    o.name as opportunity\_name,  
    d.name as distributor\_name,  
    v.name as vendor\_name,  
    p.name as product\_name,  
    ol.m2m\_start\_date,  
    DATEDIFF(NOW(), ol.m2m\_start\_date) as days\_in\_m2m,  
    COUNT(rs.id) as m2m\_schedules\_created,  
    SUM(rs.commission\_expected) as m2m\_commission\_total  
FROM opportunity\_line\_items ol  
JOIN opportunities o ON ol.opportunity\_id \= o.id  
JOIN accounts a ON o.account\_id \= a.id  
JOIN distributors d ON ol.distributor\_id \= d.id  
JOIN vendors v ON ol.vendor\_id \= v.id  
JOIN products p ON ol.product\_id \= p.id  
LEFT JOIN revenue\_schedules rs ON ol.id \= rs.line\_item\_id AND rs.isM2M \= true  
WHERE ol.status \= 'Billing \- M2M'  
GROUP BY ol.id, a.name, o.name, d.name, v.name, p.name, ol.m2m\_start\_date  
ORDER BY ol.m2m\_start\_date ASC;

**Error Handling and Monitoring**

**Critical Monitoring Points**

1. **M2M Creation Failures**: Alert if monthly process fails  
2. **Duplicate Schedule Detection**: Prevent duplicate M2M schedules  
3. **Status Transition Validation**: Ensure proper status progression  
4. **Cleanup Process Monitoring**: Track deletion flagging accuracy

// M2M Health Check Function  
async function validateM2MProcess() {  
    const issues \= \[\];  
      
    // Check for missing M2M schedules  
    const missedSchedules \= await findMissedM2MSchedules();  
    if (missedSchedules.length \> 0\) {  
        issues.push(\`${missedSchedules.length} products missing M2M schedules\`);  
    }  
      
    // Check for duplicate M2M schedules  
    const duplicates \= await findDuplicateM2MSchedules();  
    if (duplicates.length \> 0\) {  
        issues.push(\`${duplicates.length} duplicate M2M schedules detected\`);  
    }  
      
    // Check for stale M2M products  
    const staleProducts \= await findStaleM2MProducts();  
    if (staleProducts.length \> 0\) {  
        issues.push(\`${staleProducts.length} M2M products may need cleanup\`);  
    }  
      
    return issues;  
}

**Testing Requirements**

**Unit Tests for M2M Logic**

describe('Month-to-Month Schedule Creation', () \=\> {  
    test('should create M2M schedule when contract expires', async () \=\> {  
        // Setup: Product with expired schedules, still billing  
        const product \= await createTestProduct({ status: 'Billing' });  
        await createSchedules(product.id, { endDate: lastMonth() });  
          
        // Execute: Run M2M process  
        await processMonthToMonthSchedules();  
          
        // Verify: New M2M schedule created, status updated  
        const updatedProduct \= await getProduct(product.id);  
        const m2mSchedules \= await getM2MSchedules(product.id);  
          
        expect(updatedProduct.status).toBe('Billing \- M2M');  
        expect(m2mSchedules).toHaveLength(1);  
        expect(m2mSchedules\[0\].isM2M).toBe(true);  
    });  
      
    test('should cleanup inactive M2M products after 3 months', async () \=\> {  
        // Setup: M2M product with no deposits for 4 months  
        const product \= await createM2MProduct({   
            m2mStartDate: fourMonthsAgo(),  
            hasDeposits: false   
        });  
          
        // Execute: Run cleanup process  
        await cleanupInactiveM2MProducts();  
          
        // Verify: Status changed to ended, schedules flagged  
        const updatedProduct \= await getProduct(product.id);  
        const flaggedSchedules \= await getFlaggedSchedules(product.id);  
          
        expect(updatedProduct.status).toBe('Billing Ended');  
        expect(flaggedSchedules.length).toBeGreaterThan(0);  
    });  
});  
---

**Testing and Quality Assurance**

**Unit Test Coverage Requirements**

**Data Validation Tests**

* Required field validation  
* Data type validation  
* Range validation (quantities, dates, percentages)  
* Split percentage validation

**Calculation Tests**

* Schedule date generation  
* Commission calculations  
* Split allocations  
* Rounding and precision

**Integration Tests**

* End-to-end workflow testing  
* Database transaction integrity  
* API endpoint responses  
* Error handling scenarios

**Sample Test Cases**

describe('Revenue Schedule Creation', () \=\> {  
    test('should create 12 schedules for 12-month period', () \=\> {  
        const input \= {  
            startDate: '2025-09-01',  
            periods: 12,  
            // ... other required fields  
        };  
          
        const result \= createRevenueSchedule(input);  
          
        expect(result.schedules).toHaveLength(12);  
        expect(result.schedules\[0\].scheduleDate).toBe('2025-09-01');  
        expect(result.schedules\[11\].scheduleDate).toBe('2026-08-01');  
    });  
      
    test('should validate split percentages sum to 100%', () \=\> {  
        const input \= {  
            splits: { house: 50, rep: 30, subagent: 19 } // Sum \= 99%  
        };  
          
        expect(() \=\> validateSplits(input.splits))  
            .toThrow('Splits must sum to 100%');  
    });  
});  
---

**Implementation Checklist**

**Database Schema**

* \[ \] Create/verify opportunity\_line\_items table  
* \[ \] Create/verify revenue\_schedules table  
* \[ \] Implement foreign key constraints  
* \[ \] Add appropriate indexes for performance  
* \[ \] Set up cascade delete rules

**API Endpoints**

* \[ \] Implement POST /opportunities/{id}/line-items  
* \[ \] Implement GET /schedules/{id} for detail view  
* \[ \] Implement PUT /schedules/{id} for updates  
* \[ \] Implement DELETE /schedules/{id} for removal  
* \[ \] Add proper authentication and authorization

**Business Logic**

* \[ \] Implement validation functions  
* \[ \] Implement calculation functions  
* \[ \] Implement schedule generation logic  
* \[ \] Add comprehensive error handling  
* \[ \] Implement audit logging

**Frontend Integration**

* \[ \] Product catalog cascading dropdowns  
* \[ \] Real-time validation feedback  
* \[ \] Success/error message handling  
* \[ \] Form state management  
* \[ \] Data submission and response handling

---

**Performance Considerations**

**Optimization Strategies**

**Database Performance**

* Index on frequently queried fields (opportunity\_id, schedule\_date)  
* Consider partitioning for large datasets  
* Optimize bulk insert operations for schedule creation  
* Use appropriate connection pooling

**API Performance**

* Implement caching for product catalog data  
* Use pagination for schedule listing endpoints  
* Consider async processing for bulk operations  
* Implement rate limiting

**Frontend Performance**

* Cache product catalog responses  
* Implement debouncing for real-time validation  
* Use optimistic UI updates where appropriate  
* Minimize unnecessary re-renders

---

**Document Version:** 1.0  
**Last Updated:** August 18, 2025  
**Next Review:** September 1, 2025

---

*This document serves as the definitive technical reference for implementing Revenue Schedule functionality. All developers should refer to this guide during implementation and update it as the system evolves.*

