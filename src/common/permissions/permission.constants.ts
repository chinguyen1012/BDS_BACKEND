/** Permission registry — mở rộng bằng cách thêm constant mới. */
export const PERMISSIONS = {
  ORG_READ: 'org.read',
  ORG_UPDATE: 'org.update',
  ORG_DELETE: 'org.delete',
  ORG_SETTINGS: 'org.settings.manage',

  ORG_MEMBERS_INVITE: 'org.members.invite',
  ORG_MEMBERS_REMOVE: 'org.members.remove',
  ORG_MEMBERS_UPDATE_ROLE: 'org.members.update_role',
  ORG_MEMBERS_LIST: 'org.members.list',

  ORG_WALLET_TOPUP: 'org.wallet.topup',
  ORG_WALLET_VIEW: 'org.wallet.view',
  ORG_WALLET_ADJUST: 'org.wallet.adjust',

  ORG_BUDGET_READ: 'org.budget.read',
  ORG_BUDGET_MANAGE: 'org.budget.manage',

  LISTING_CREATE: 'listing.create',
  LISTING_UPDATE_OWN: 'listing.update.own',
  LISTING_UPDATE_ANY: 'listing.update.any',
  LISTING_DELETE_OWN: 'listing.delete.own',
  LISTING_DELETE_ANY: 'listing.delete.any',
  LISTING_VIEW_ANY: 'listing.view.any',

  LISTING_APPROVE_MANAGER: 'listing.approve.manager',
  LISTING_APPROVE_PLATFORM: 'listing.approve.platform',

  DASHBOARD_VIEW: 'dashboard.view',
  DASHBOARD_ANALYTICS: 'dashboard.analytics',

  AUDIT_VIEW: 'audit.view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/** Wildcard — Owner có toàn quyền. */
export const PERMISSION_WILDCARD = '*';

export function hasPermission(
  granted: string[],
  required: Permission | Permission[],
): boolean {
  if (granted.includes(PERMISSION_WILDCARD)) return true;
  const needed = Array.isArray(required) ? required : [required];
  return needed.every((p) => granted.includes(p));
}

/** System role templates — seed vào DB. */
export const SYSTEM_ROLE_PERMISSIONS: Record<
  string,
  { name: string; description: string; permissions: string[] }
> = {
  owner: {
    name: 'Owner',
    description: 'Toàn quyền trong Organization',
    permissions: [PERMISSION_WILDCARD],
  },
  manager: {
    name: 'Manager',
    description: 'Quản lý thành viên, ngân sách và duyệt tin',
    permissions: [
      PERMISSIONS.ORG_READ,
      PERMISSIONS.ORG_MEMBERS_INVITE,
      PERMISSIONS.ORG_MEMBERS_REMOVE,
      PERMISSIONS.ORG_MEMBERS_LIST,
      PERMISSIONS.ORG_BUDGET_READ,
      PERMISSIONS.ORG_BUDGET_MANAGE,
      PERMISSIONS.LISTING_VIEW_ANY,
      PERMISSIONS.LISTING_APPROVE_MANAGER,
      PERMISSIONS.DASHBOARD_VIEW,
    ],
  },
  staff: {
    name: 'Staff',
    description: 'Đăng tin và xem phân tích',
    permissions: [
      PERMISSIONS.ORG_READ,
      PERMISSIONS.LISTING_CREATE,
      PERMISSIONS.LISTING_UPDATE_OWN,
      PERMISSIONS.LISTING_DELETE_OWN,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.DASHBOARD_ANALYTICS,
    ],
  },
};
