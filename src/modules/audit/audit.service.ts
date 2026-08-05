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

const REDACTED_AUDIT_VALUE = '[REDACTED]';
const SENSITIVE_AUDIT_KEY_PATTERN =
  /(token|secret|password|authorization|cookie|credential|api[_-]?key)/i;

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
      data.payloadJson = sanitizeAuditPayload(entry.payloadJson);
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

function sanitizeAuditPayload(
  payload: Prisma.InputJsonValue,
): Prisma.InputJsonValue;
function sanitizeAuditPayload(
  payload: Prisma.InputJsonValue | null,
): Prisma.InputJsonValue | null;
function sanitizeAuditPayload(
  payload: Prisma.InputJsonValue | null,
): Prisma.InputJsonValue | null {
  if (
    payload === null ||
    typeof payload === 'string' ||
    typeof payload === 'number' ||
    typeof payload === 'boolean'
  ) {
    return payload;
  }

  if (isJsonArray(payload)) {
    return payload.map((item) => sanitizeAuditPayload(item));
  }

  if (!isJsonObject(payload)) {
    return payload;
  }

  const sanitizedObject: Record<string, Prisma.InputJsonValue> = {};

  for (const key in payload) {
    const value = payload[key];

    if (value === undefined) {
      continue;
    }

    sanitizedObject[key] = SENSITIVE_AUDIT_KEY_PATTERN.test(key)
      ? REDACTED_AUDIT_VALUE
      : sanitizeAuditPayload(value);
  }

  return sanitizedObject;
}

function isJsonObject(
  payload: Prisma.InputJsonValue,
): payload is Record<string, Prisma.InputJsonValue> {
  return (
    typeof payload === 'object' && payload !== null && !Array.isArray(payload)
  );
}

function isJsonArray(
  payload: Prisma.InputJsonValue,
): payload is Prisma.InputJsonArray {
  return Array.isArray(payload);
}
