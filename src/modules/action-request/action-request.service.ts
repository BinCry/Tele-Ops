import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ActionRequest, ActionRequestStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { SettingsService } from 'src/modules/settings/settings.service';

export type CreateActionRequestInput = {
  actorUserId: string;
  actionType: string;
  resourceType: string;
  resourceId?: string;
  payloadJson?: Prisma.InputJsonValue;
};

export type ActionRequestResolution =
  | {
      status: 'ready';
      request: ActionRequest;
    }
  | {
      status: 'not_found' | 'wrong_actor' | 'already_used' | 'expired';
    };

@Injectable()
export class ActionRequestService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async createPendingRequest(
    input: CreateActionRequestInput,
  ): Promise<ActionRequest> {
    const expiresAt = new Date(
      Date.now() +
        (await this.settingsService.getConfirmationTtlSeconds()) * 1000,
    );
    const data: Prisma.ActionRequestUncheckedCreateInput = {
      token: randomUUID(),
      actorUserId: input.actorUserId,
      actionType: input.actionType,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      expiresAt,
    };

    if (input.payloadJson !== undefined) {
      data.payloadJson = input.payloadJson;
    }

    return this.prismaService.actionRequest.create({
      data,
    });
  }

  async resolveForActor(
    token: string,
    actorUserId: string,
  ): Promise<ActionRequestResolution> {
    const request = await this.prismaService.actionRequest.findUnique({
      where: {
        token,
      },
    });

    if (!request) {
      return {
        status: 'not_found',
      };
    }

    if (request.actorUserId !== actorUserId) {
      return {
        status: 'wrong_actor',
      };
    }

    if (request.status !== ActionRequestStatus.PENDING) {
      return {
        status: 'already_used',
      };
    }

    if (request.expiresAt.getTime() <= Date.now()) {
      await this.prismaService.actionRequest.update({
        where: {
          id: request.id,
        },
        data: {
          status: ActionRequestStatus.EXPIRED,
        },
      });

      return {
        status: 'expired',
      };
    }

    return {
      status: 'ready',
      request,
    };
  }

  async markConfirmed(id: string): Promise<void> {
    await this.prismaService.actionRequest.update({
      where: {
        id,
      },
      data: {
        status: ActionRequestStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });
  }

  async markExecuted(id: string): Promise<void> {
    await this.prismaService.actionRequest.update({
      where: {
        id,
      },
      data: {
        status: ActionRequestStatus.EXECUTED,
        executedAt: new Date(),
      },
    });
  }

  async markCancelled(id: string): Promise<void> {
    await this.prismaService.actionRequest.update({
      where: {
        id,
      },
      data: {
        status: ActionRequestStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });
  }

  async markFailed(id: string): Promise<void> {
    await this.prismaService.actionRequest.update({
      where: {
        id,
      },
      data: {
        status: ActionRequestStatus.FAILED,
        executedAt: new Date(),
      },
    });
  }
}
