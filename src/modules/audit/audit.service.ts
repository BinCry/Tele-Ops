import { Injectable } from '@nestjs/common';
import { AuditResult, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';

type AuditEntryInput = {
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId?: string;
  payloadJson?: Prisma.InputJsonValue | undefined;
  result: AuditResult;
  errorCode?: string;
  errorMessage?: string;
};

export type RecentAuditEntry = {
  action: string;
  resourceType: string;
  resourceId: string | null;
  result: AuditResult;
  createdAt: Date;
  actorDisplayName: string | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prismaService: PrismaService) {}

  async record(entry: AuditEntryInput): Promise<void> {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      requestId: entry.requestId ?? null,
      result: entry.result,
      errorCode: entry.errorCode ?? null,
      errorMessage: entry.errorMessage ?? null,
    };

    if (entry.payloadJson !== undefined) {
      data.payloadJson = entry.payloadJson;
    }

    await this.prismaService.auditLog.create({
      data,
    });
  }

  async listRecent(limit = 8): Promise<RecentAuditEntry[]> {
    const entries = await this.prismaService.auditLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      include: {
        actorUser: {
          select: {
            displayName: true,
          },
        },
      },
    });

    return entries.map((entry) => ({
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      result: entry.result,
      createdAt: entry.createdAt,
      actorDisplayName: entry.actorUser?.displayName ?? null,
    }));
  }
}
