import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const ORG_CONTEXT_KEY = 'orgContext';

export type OrgContextPayload = {
  organizationId: string;
  membershipId: string;
  permissions: string[];
  roleKey: string;
};

export const OrgContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OrgContextPayload | null => {
    const request = ctx.switchToHttp().getRequest();
    return request[ORG_CONTEXT_KEY] ?? null;
  },
);

export const ORG_ID_HEADER = 'x-organization-id';
