import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

import { AuditLogsService } from './audit-logs.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const orgId =
      request.params?.id ||
      request.params?.orgId ||
      request.headers['x-organization-id'];

    if (!orgId || !request.user?.sub) {
      return next.handle();
    }

    const method = request.method;
    if (method === 'GET' || method === 'HEAD') {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        void this.auditService.log({
          userId: request.user.sub,
          organizationId: String(orgId),
          action: `${method} ${request.route?.path ?? request.url}`,
          targetType: 'http',
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        });
      }),
    );
  }
}
