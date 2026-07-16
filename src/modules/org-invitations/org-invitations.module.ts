import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  OrgInvitation,
  OrgInvitationSchema,
} from './schemas/org-invitation.schema';
import { OrgInvitationsService } from './org-invitations.service';
import { OrgMembershipsModule } from '../org-memberships/org-memberships.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  Organization,
  OrganizationSchema,
} from '../organizations/schemas/organization.schema';
import {
  OrgRoleTemplate,
  OrgRoleTemplateSchema,
} from '../org-roles/schemas/org-role-template.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    OrgMembershipsModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: OrgInvitation.name, schema: OrgInvitationSchema },
      { name: User.name, schema: UserSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: OrgRoleTemplate.name, schema: OrgRoleTemplateSchema },
    ]),
  ],
  providers: [OrgInvitationsService],
  exports: [OrgInvitationsService, MongooseModule],
})
export class OrgInvitationsModule {}
