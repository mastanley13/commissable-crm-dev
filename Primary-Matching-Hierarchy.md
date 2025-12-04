. Primary Matching Hierarchy (Order of Precedence)
The system evaluates fields in the following specific order to establish a match. Distributor and Vendor matches are treated as absolute prerequisites.
1. Distributor (Exact Match),
2. Vendor (Exact Match),
3. Account Legal Name,
4. Strong Identifiers (Exact Match Priority):
    ◦ Order ID (House, Vendor, Distributor),
    ◦ Customer ID (House, Vendor, Distributor),
    ◦ Account ID (House, Vendor)
5. Location ID / Customer PO #,
6. Product Name & Part Number,
7. Product Description
8. Revenue Schedule Date
2. Execution Logic: The Two-Pass System
Pass A: Exact Matching (Priority 1) The system first attempts to find a match using strong identifiers. It looks for identical values in fields such as Distributor, Vendor, Account Legal Name, Order ID, and Customer ID. If a match is found here with 1.0 (100%) confidence and the variance is within the user's tolerance (default 0.00%), the system can auto-apply the match,.
Pass B: Fuzzy Matching (Priority 2) If no exact match is found on ID fields, the system applies fuzzy logic to "softer" fields,. This pass generates a Confidence Score based on weighted similarities:
• Account Name Similarity: ~40% weight
• Product Name Similarity: ~30% weight
• Amount Proximity: ~20% weight
• Date Proximity: ~10% weight
This logic accommodates vendor-specific formatting differences, such as extra spaces or punctuation in names and descriptions.
3. Tie-Breakers and Filtering Rules
• FIFO (First-In, First-Out) Rule: If a deposit line item matches the same product across multiple revenue schedules (i.e., multiple candidates found), the system automatically applies the FIFO rule, prioritizing the schedule with the earliest date,.
• Date Filtering: By default, the system only matches against revenue schedules dated on or before the current month. Future-dated schedules are excluded unless the user explicitly toggles "Include Future-Dated Schedules",.
• Status Filtering: The system only queries revenue schedules with a status of OPEN or PARTIALLY_PAID that have positive commission differences.
Analogy: Think of the matching order like a postman delivering a letter. First, they verify the City and Zip Code (Distributor/Vendor) — if these are wrong, they stop immediately. Next, they look for the specific Street Address and Apartment Number (Order ID/Customer ID) — this is the "Exact Match" pass. If the address is smudged or incomplete, they look at the Recipient's Name (Account Name/Product Name) and check if it sounds similar or is spelled slightly differently (e.g., "Jon" vs. "John") — this is the "Fuzzy Match" pass. Finally, if there are two letters for "John Smith" at the same address, they deliver the one with the oldest postmark first (FIFO Rule).