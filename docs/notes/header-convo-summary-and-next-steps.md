Column chooser & blank headers on Revenue Schedules page – We matched the available columns to the Opportunity details tab, added missing percentage columns, computed their values, and made the dynamic table fall back to a friendly label when none is provided.

Headers still missing – We discovered the next layer: user preferences stored in TablePreference contained blank labels. Added hydration logic in useTablePreferences to copy labels from the base definitions.

Root cause – Even with hydration, some preferences still referenced obsolete column IDs (e.g., status, owner). The GitHub version worked because its database didn’t have those outdated rows.

Database inspection – Connected via Cloud SQL proxy, pulled the preference data, and confirmed the stale IDs.

Plan to fix – Instead of reverting the hydration step, the path forward is normalizing the stored preferences: map old IDs to the current ones, drop unknown IDs, and ensure every columnOrder/hiddenColumns entry matches the current column definitions so headers render correctly.

You don’t need to rip out the hydrate step— it’s just a safety net that fills in missing metadata. The real problem is the stale preference rows that still mention legacy column ids (status, owner, sicCode, taxId, etc.). Even if you revert the hook, those bad ids would still be passed straight to the table and you’d keep seeing blank headers.

To bring your current environment in line with the GitHub snapshot, tackle the data instead of the code:

Map legacy ids to the current ones.

If you know how the ids were renamed (e.g., status → accountStatus, owner → accountOwner), create an alias map.
Update the TablePreference rows so each entry in columnOrder, hiddenColumns, and columnWidths gets swapped to the new id.
UPDATE "TablePreference"
SET "columnOrder"   = jsonb_rename_keys("columnOrder"::jsonb, '{"status":"accountStatus","owner":"accountOwner"}'),
    "hiddenColumns" = jsonb_rename_values(...),
    "columnWidths"  = jsonb_rename_keys("columnWidths"::jsonb, '{...}')
WHERE "pageKey" = 'accounts:list';
(You can implement jsonb_rename_* via small SQL functions or do it in a script with Prisma/Node.)
Drop any ids that no longer exist.

If there’s no modern equivalent (e.g., sicCode), remove it from hiddenColumns and don’t put it back into columnOrder. Missing columns will be auto-added by the UI the next time preferences save.
(Optional) seed new rows.

After cleaning, rebuild each TablePreference row by intersecting with the valid id list so future code changes don’t resurrect old ids. Writing a one-time script is less error-prone than manual SQL.
Once the stored preferences reference only the current column ids, the dynamic table renders headers correctly—independent of the hydrate logic. The GitHub commit appears to work simply because its database (or the lack of persisted preferences) already matched the column definitions.

Okay let's implement these changes so that the stored preferences reference only the current column ids the dynamic table renders headers correctly—independent of the hydrate logic. I want the current project to work like the github commit. The GitHub commit appears to work simply because its database (or the lack of persisted preferences) already matched the column definitions.

So I need the current project to have the database updated to match the column definitions

review the [header-convo-summary-and-next-steps.md](header-convo-summary-and-next-steps.md) . Okay let's implement these changes so that the stored preferences reference only the current column ids the dynamic table renders headers correctly—independent of the hydrate logic. I want the current project to work like the github commit. The GitHub commit appears to work simply because its database (or the lack of persisted preferences) already matched the column definitions. 

Complete everything except executing the database update. I would like to review your database update before you push changes to the database. Our goal is for the current column ids to reflect in the database so they match the column definitions