import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, asc } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { account, drive } from '../db/schema';
import { CryptoService } from '../crypto/crypto.service';
import { KdriveService } from '../kdrive/kdrive.service';

@Injectable()
export class DrivesService {
  private readonly logger = new Logger(DrivesService.name);

  constructor(
    private dbService: DbService,
    private crypto: CryptoService,
    private kdrive: KdriveService,
  ) {}

  async getDecryptedToken(accountId: string): Promise<string> {
    const [row] = await this.dbService.db
      .select({ infomaniakToken: account.infomaniakToken })
      .from(account)
      .where(eq(account.id, accountId))
      .limit(1);

    if (!row) throw new NotFoundException('Account not found');
    return this.crypto.decrypt(row.infomaniakToken);
  }

  async syncDrives(accountId: string) {
    const token = await this.getDecryptedToken(accountId);
    const remoteDrives = await this.kdrive.listDrives(token);

    for (const rd of remoteDrives) {
      await this.dbService.db
        .insert(drive)
        .values({
          accountId,
          kdriveId: rd.id,
          name: rd.name,
          color: rd.color,
        })
        .onConflictDoUpdate({
          target: [drive.accountId, drive.kdriveId],
          set: { name: rd.name, color: rd.color },
        });
    }

    return this.dbService.db
      .select()
      .from(drive)
      .where(eq(drive.accountId, accountId))
      .orderBy(asc(drive.name));
  }

  async listDrives(accountId: string) {
    return this.dbService.db
      .select()
      .from(drive)
      .where(eq(drive.accountId, accountId))
      .orderBy(asc(drive.name));
  }

  async setIndexing(driveId: string) {
    await this.dbService.db
      .update(drive)
      .set({ indexStatus: 'INDEXING', totalPhotos: 0 })
      .where(eq(drive.id, driveId));
  }

  async getDriveStatus(accountId: string, kdriveId: number) {
    const [row] = await this.dbService.db
      .select({
        kdriveId: drive.kdriveId,
        indexStatus: drive.indexStatus,
        totalPhotos: drive.totalPhotos,
        lastIndexedAt: drive.lastIndexedAt,
        minPhotoDate: drive.minPhotoDate,
        maxPhotoDate: drive.maxPhotoDate,
      })
      .from(drive)
      .where(and(eq(drive.accountId, accountId), eq(drive.kdriveId, kdriveId)))
      .limit(1);

    if (!row) throw new NotFoundException('Drive not found');
    return row;
  }

  async findDrive(accountId: string, kdriveId: number) {
    const [row] = await this.dbService.db
      .select()
      .from(drive)
      .where(and(eq(drive.accountId, accountId), eq(drive.kdriveId, kdriveId)))
      .limit(1);

    if (!row) throw new NotFoundException('Drive not found');
    return row;
  }
}
