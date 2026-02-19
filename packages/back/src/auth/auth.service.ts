import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { DbService } from '../db/db.service';
import { account } from '../db/schema';
import { CryptoService } from '../crypto/crypto.service';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private dbService: DbService,
    private jwt: JwtService,
    private config: ConfigService,
    private crypto: CryptoService,
  ) {}

  async register(email: string, password: string, infomaniakToken: string): Promise<TokenPair> {
    const [existing] = await this.dbService.db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.email, email))
      .limit(1);

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const encryptedToken = this.crypto.encrypt(infomaniakToken);

    const [created] = await this.dbService.db
      .insert(account)
      .values({ email, passwordHash, infomaniakToken: encryptedToken })
      .returning({ id: account.id, email: account.email });

    return this.generateTokens(created.id, created.email);
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const [found] = await this.dbService.db
      .select({ id: account.id, email: account.email, passwordHash: account.passwordHash })
      .from(account)
      .where(eq(account.email, email))
      .limit(1);

    if (!found) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, found.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(found.id, found.email);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return this.generateTokens(payload.sub, payload.email);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async localAccountHasToken(): Promise<boolean> {
    const [localAccount] = await this.dbService.db
      .select({ infomaniakToken: account.infomaniakToken })
      .from(account)
      .where(eq(account.email, 'local'))
      .limit(1);
    if (!localAccount) return false;
    try {
      const decrypted = this.crypto.decrypt(localAccount.infomaniakToken);
      return decrypted.length > 0;
    } catch {
      return false;
    }
  }

  async updateToken(accountId: string, infomaniakToken: string): Promise<void> {
    const encryptedToken = this.crypto.encrypt(infomaniakToken);
    await this.dbService.db
      .update(account)
      .set({ infomaniakToken: encryptedToken, updatedAt: new Date() })
      .where(eq(account.id, accountId));
  }

  private generateTokens(accountId: string, email: string): TokenPair {
    const accessToken = this.jwt.sign(
      { sub: accountId, email, type: 'access' },
      { expiresIn: this.config.get<string>('JWT_EXPIRY', '15m') as any },
    );

    const refreshToken = this.jwt.sign(
      { sub: accountId, email, type: 'refresh' },
      { expiresIn: this.config.get<string>('REFRESH_TOKEN_EXPIRY', '7d') as any },
    );

    return { accessToken, refreshToken };
  }
}
