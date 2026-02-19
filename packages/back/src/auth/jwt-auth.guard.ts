import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (process.env.LOCAL_MODE === 'true') {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: process.env.LOCAL_ACCOUNT_ID, email: 'local' };
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  // Allow token from ?token= query param (for <img src> tags)
  getRequest(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (!req.headers.authorization && req.query?.token) {
      req.headers.authorization = `Bearer ${req.query.token}`;
    }
    return req;
  }
}
