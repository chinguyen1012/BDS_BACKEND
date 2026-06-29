import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type JwtPayload = {
  sub: string;
  email: string;
};

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
