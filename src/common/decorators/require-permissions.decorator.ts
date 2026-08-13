import { SetMetadata } from '@nestjs/common';

import { Permission } from '../permissions/permission.constants';

export const PERMISSIONS_KEY = 'requiredPermissions';

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const REQUIRE_ORG_CONTEXT_KEY = 'requireOrgContext';

export const RequireOrgContext = () =>
  SetMetadata(REQUIRE_ORG_CONTEXT_KEY, true);
