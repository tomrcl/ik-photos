import { Controller, Post, Get, Put, Body, Req, Res, HttpCode, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { KdriveService } from '../kdrive/kdrive.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
    private kdrive: KdriveService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() body: { email: string; password: string; infomaniakToken: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.register(body.email, body.password, body.infomaniakToken);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.login(body.email, body.password);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'];
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token' });
    }
    const tokens = await this.auth.refresh(refreshToken);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @Get('local-session')
  async localSession() {
    if (process.env.LOCAL_MODE !== 'true') {
      return { enabled: false };
    }
    const hasToken = await this.auth.localAccountHasToken();
    return { enabled: true, ...(hasToken ? { accessToken: 'local-mode' } : {}) };
  }

  @Public()
  @Post('verify-token')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async verifyToken(@Body() body: { infomaniakToken: string }) {
    if (!body.infomaniakToken) {
      throw new BadRequestException('Token is required');
    }
    try {
      await this.kdrive.listDrives(body.infomaniakToken);
      return { valid: true };
    } catch {
      return { valid: false };
    }
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token');
    return { message: 'Logged out' };
  }

  @Put('token')
  @HttpCode(200)
  async updateToken(
    @Req() req: Request,
    @Body() body: { infomaniakToken: string },
  ) {
    const user = (req as any).user;
    await this.auth.updateToken(user.sub, body.infomaniakToken);
    return { message: 'Token updated' };
  }

  @Get('me')
  me(@Req() req: Request) {
    const user = (req as any).user;
    return { id: user.sub, email: user.email };
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth',
    });
  }
}
