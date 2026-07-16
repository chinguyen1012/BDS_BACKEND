export enum OrganizationStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  ARCHIVED = 'archived',
}

export enum OrgMembershipStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  LEFT = 'left',
}

export enum OrgInvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

export enum OrgRoleKey {
  OWNER = 'owner',
  MANAGER = 'manager',
  LEADER = 'leader',
  STAFF = 'staff',
  VIEWER = 'viewer',
}

export enum ListingContext {
  PERSONAL = 'personal',
  ORGANIZATION = 'organization',
}

export enum OrgTransactionType {
  TOPUP = 'topup',
  SPEND = 'spend',
  REFUND = 'refund',
  ADJUSTMENT = 'adjustment',
  TRANSFER = 'transfer',
}

export enum BudgetScope {
  ORGANIZATION = 'organization',
  DEPARTMENT = 'department',
  TEAM = 'team',
  USER = 'user',
}

export enum WalletType {
  PERSONAL = 'personal',
  ORGANIZATION = 'organization',
}
