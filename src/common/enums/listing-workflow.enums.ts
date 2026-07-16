/** Trạng thái tin đăng — mở rộng workflow Organization. */
export enum ListingWorkflowStatus {
  DRAFT = 'draft',
  PENDING_MANAGER = 'pending_manager',
  REJECTED_BY_MANAGER = 'rejected_by_manager',
  PENDING_ADMIN = 'pending_admin',
  REJECTED_BY_ADMIN = 'rejected_by_admin',
  PUBLISHED = 'published',
  EXPIRED = 'expired',
  ARCHIVED = 'archived',
  /** Legacy — tin cá nhân sau thanh toán trực tiếp */
  PENDING = 'pending',
  ACTIVE = 'active',
  REJECTED = 'rejected',
}
