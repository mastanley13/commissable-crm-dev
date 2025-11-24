-- Script to grant audit log permissions to roles that need them
-- This grants auditLogs.read to any role that has opportunities.manage or admin permissions

-- First, let's see what roles exist and what permissions they have
SELECT
  r."code" as role_code,
  r."name" as role_name,
  p."code" as permission_code,
  p."name" as permission_name
FROM "Role" r
LEFT JOIN "RolePermission" rp ON r."id" = rp."roleId"
LEFT JOIN "Permission" p ON rp."permissionId" = p."id"
WHERE p."code" IN (
  'opportunities.manage',
  'accounts.manage',
  'admin.audit.access',
  'system.all_modules'
)
ORDER BY r."code", p."code";

-- Grant auditLogs.read to any role that has opportunities.manage
INSERT INTO "RolePermission" ("id", "tenantId", "roleId", "permissionId", "grantedAt")
SELECT
  gen_random_uuid(),
  rp."tenantId",
  rp."roleId",
  (SELECT "id" FROM "Permission" WHERE "code" = 'auditLogs.read'),
  NOW()
FROM "RolePermission" rp
JOIN "Permission" p ON rp."permissionId" = p."id"
WHERE p."code" = 'opportunities.manage'
AND NOT EXISTS (
  SELECT 1 FROM "RolePermission" rp2
  JOIN "Permission" p2 ON rp2."permissionId" = p2."id"
  WHERE rp2."roleId" = rp."roleId"
  AND p2."code" = 'auditLogs.read'
)
GROUP BY rp."tenantId", rp."roleId";

-- Grant auditLogs.read to any role that has accounts.manage
INSERT INTO "RolePermission" ("id", "tenantId", "roleId", "permissionId", "grantedAt")
SELECT
  gen_random_uuid(),
  rp."tenantId",
  rp."roleId",
  (SELECT "id" FROM "Permission" WHERE "code" = 'auditLogs.read'),
  NOW()
FROM "RolePermission" rp
JOIN "Permission" p ON rp."permissionId" = p."id"
WHERE p."code" = 'accounts.manage'
AND NOT EXISTS (
  SELECT 1 FROM "RolePermission" rp2
  JOIN "Permission" p2 ON rp2."permissionId" = p2."id"
  WHERE rp2."roleId" = rp."roleId"
  AND p2."code" = 'auditLogs.read'
)
GROUP BY rp."tenantId", rp."roleId";

-- Grant auditLogs.read to any role that has activities.manage
INSERT INTO "RolePermission" ("id", "tenantId", "roleId", "permissionId", "grantedAt")
SELECT
  gen_random_uuid(),
  rp."tenantId",
  rp."roleId",
  (SELECT "id" FROM "Permission" WHERE "code" = 'auditLogs.read'),
  NOW()
FROM "RolePermission" rp
JOIN "Permission" p ON rp."permissionId" = p."id"
WHERE p."code" = 'activities.manage'
AND NOT EXISTS (
  SELECT 1 FROM "RolePermission" rp2
  JOIN "Permission" p2 ON rp2."permissionId" = p2."id"
  WHERE rp2."roleId" = rp."roleId"
  AND p2."code" = 'auditLogs.read'
)
GROUP BY rp."tenantId", rp."roleId";

-- Verify the grants
SELECT
  r."code" as role_code,
  r."name" as role_name,
  COUNT(DISTINCT CASE WHEN p."code" = 'auditLogs.read' THEN 1 END) as has_audit_read,
  COUNT(DISTINCT CASE WHEN p."code" = 'auditLogs.manage' THEN 1 END) as has_audit_manage
FROM "Role" r
LEFT JOIN "RolePermission" rp ON r."id" = rp."roleId"
LEFT JOIN "Permission" p ON rp."permissionId" = p."id"
GROUP BY r."id", r."code", r."name"
ORDER BY r."code";
