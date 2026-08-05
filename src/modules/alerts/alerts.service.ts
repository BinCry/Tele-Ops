import { Injectable } from '@nestjs/common';
import { AlertEventStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import {
  MonitoringTargetStatus,
  MonitoringOverview,
} from 'src/modules/monitoring/monitoring.service';
import { AlertNotifierService } from './alert-notifier.service';
import {
  AlertRuleSummary,
  AlertRulesOverview,
  AlertRulesService,
} from './alert-rules.service';

export type ActiveAlertSummary = {
  ruleName: string;
  displayName: string;
  severity: 'info' | 'warning' | 'critical';
  targetName: string;
  summary: string;
  notificationState: 'sent' | 'suppressed' | 'disabled';
};

export type AlertsOverview = AlertRulesOverview & {
  activeAlertCount: number;
  resolvedAlertCount: number;
  alerts: ActiveAlertSummary[];
};

@Injectable()
export class AlertsService {
  constructor(
    private readonly alertRulesService: AlertRulesService,
    private readonly alertNotifierService: AlertNotifierService,
    private readonly prismaService: PrismaService,
  ) {}

  async evaluateTargets(
    monitoringOverview: Pick<MonitoringOverview, 'targets'>,
  ): Promise<AlertsOverview> {
    const rulesOverview = await this.alertRulesService.getOverview();
    const openEvents = await this.prismaService.alertEvent.findMany({
      where: {
        status: AlertEventStatus.OPEN,
        ruleName: {
          in: rulesOverview.rules.map((rule) => rule.name),
        },
      },
    });

    const now = new Date();
    const alerts: ActiveAlertSummary[] = [];
    let resolvedAlertCount = 0;

    for (const rule of rulesOverview.rules) {
      if (!rule.enabled) {
        continue;
      }

      const target = monitoringOverview.targets.find(
        (item) => item.name === rule.targetName,
      );
      const openEvent = openEvents.find(
        (event) => event.ruleName === rule.name,
      );
      const triggerSummary = target ? buildTriggerSummary(rule, target) : null;

      if (triggerSummary && target) {
        const notificationState = await this.openOrRefreshAlert(
          rule,
          target,
          openEvent ?? null,
          triggerSummary,
          now,
        );

        alerts.push({
          ruleName: rule.name,
          displayName: rule.displayName,
          severity: rule.severity,
          targetName: rule.targetName,
          summary: triggerSummary,
          notificationState,
        });
        continue;
      }

      if (openEvent) {
        await this.prismaService.alertEvent.update({
          where: {
            id: openEvent.id,
          },
          data: {
            status: AlertEventStatus.RESOLVED,
            resolvedAt: now,
          },
        });
        await this.alertNotifierService.notifyResolvedAlert({
          displayName: rule.displayName,
          summary: openEvent.summary,
        });
        resolvedAlertCount += 1;
      }
    }

    return {
      ...rulesOverview,
      activeAlertCount: alerts.length,
      resolvedAlertCount,
      alerts,
    };
  }

  private async openOrRefreshAlert(
    rule: AlertRuleSummary,
    target: MonitoringTargetStatus,
    openEvent: {
      id: string;
      summary: string;
      lastNotifiedAt: Date | null;
    } | null,
    triggerSummary: string,
    now: Date,
  ): Promise<'sent' | 'suppressed' | 'disabled'> {
    if (!openEvent) {
      const notificationSent = await this.alertNotifierService.notifyOpenAlert({
        displayName: rule.displayName,
        severity: rule.severity,
        summary: triggerSummary,
      });

      await this.prismaService.alertEvent.create({
        data: {
          ruleName: rule.name,
          status: AlertEventStatus.OPEN,
          summary: triggerSummary,
          detailsJson: buildAlertDetails(rule, target),
          openedAt: now,
          lastNotifiedAt: notificationSent ? now : null,
        },
      });

      return notificationSent ? 'sent' : 'disabled';
    }

    const shouldNotify =
      openEvent.lastNotifiedAt === null ||
      now.getTime() - openEvent.lastNotifiedAt.getTime() >=
        rule.cooldownMinutes * 60_000;
    const notificationSent = shouldNotify
      ? await this.alertNotifierService.notifyOpenAlert({
          displayName: rule.displayName,
          severity: rule.severity,
          summary: triggerSummary,
        })
      : false;

    await this.prismaService.alertEvent.update({
      where: {
        id: openEvent.id,
      },
      data: {
        summary: triggerSummary,
        detailsJson: buildAlertDetails(rule, target),
        lastNotifiedAt: notificationSent ? now : openEvent.lastNotifiedAt,
      },
    });

    if (!shouldNotify) {
      return 'suppressed';
    }

    return notificationSent ? 'sent' : 'disabled';
  }
}

function buildTriggerSummary(
  rule: AlertRuleSummary,
  target: MonitoringTargetStatus,
): string | null {
  const reasons: string[] = [];

  if (
    target.status !== 'DISABLED' &&
    rule.triggerOnStatuses.includes(target.status)
  ) {
    reasons.push(`status ${target.status}`);
  }

  if (
    rule.responseTimeMsAbove !== undefined &&
    target.responseTimeMs !== null &&
    target.responseTimeMs > rule.responseTimeMsAbove
  ) {
    reasons.push(
      `response ${target.responseTimeMs}ms vượt ngưỡng ${rule.responseTimeMsAbove}ms`,
    );
  }

  if (reasons.length === 0) {
    return null;
  }

  return `${target.displayName}: ${reasons.join(', ')}`;
}

function buildAlertDetails(
  rule: AlertRuleSummary,
  target: MonitoringTargetStatus,
): Prisma.InputJsonValue {
  return {
    ruleName: rule.name,
    targetName: target.name,
    targetStatus: target.status,
    responseTimeMs: target.responseTimeMs,
    statusCode: target.statusCode,
    errorMessage: target.errorMessage,
    checkedAt: target.checkedAt?.toISOString() ?? null,
  };
}
