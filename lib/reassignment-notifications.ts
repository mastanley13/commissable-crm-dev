import { prisma } from "@/lib/db";

interface NotificationData {
  accountIds: string[];
  newOwnerId: string;
  previousOwners: (string | null)[];
  reassignedBy: any;
  effectiveDate: string;
}

export async function sendReassignmentNotifications({
  accountIds,
  newOwnerId,
  previousOwners,
  reassignedBy,
  effectiveDate
}: NotificationData): Promise<void> {

  // Get account details for notifications
  const accounts = await prisma.account.findMany({
    where: {
      id: { in: accountIds }
    },
    select: {
      id: true,
      accountName: true,
      ownerId: true
    }
  });

  // Notify new owner
  if (newOwnerId !== 'house' && newOwnerId !== 'unassigned') {
    await sendNotification({
      recipientId: newOwnerId,
      type: 'ACCOUNT_ASSIGNMENT',
      title: 'New Account Assignment',
      message: `You have been assigned ${accountIds.length} new account${accountIds.length !== 1 ? 's' : ''} effective ${formatDate(effectiveDate)}`,
      actionUrl: '/accounts?filter=assigned-to-me',
      priority: 'high',
      metadata: {
        accountIds,
        reassignedBy: reassignedBy.id,
        effectiveDate
      }
    });
  }

  // Notify previous owners
  const uniquePreviousOwners = [...new Set(previousOwners.filter(Boolean))];

  for (const previousOwnerId of uniquePreviousOwners) {
    if (previousOwnerId && previousOwnerId !== reassignedBy.id) {
      const previousOwner = await prisma.user.findFirst({
        where: { id: previousOwnerId }
      });

      if (previousOwner) {
        await sendNotification({
          recipientId: previousOwnerId,
          type: 'ACCOUNT_REASSIGNMENT',
          title: 'Account Reassignment Notice',
          message: `Some of your accounts have been reassigned by ${reassignedBy.fullName}`,
          actionUrl: '/accounts?filter=recently-changed',
          priority: 'medium',
          metadata: {
            accountIds,
            newOwnerId,
            reassignedBy: reassignedBy.id,
            effectiveDate
          }
        });
      }
    }
  }

  // Send email notifications
  await sendEmailNotifications({
    accountIds,
    newOwnerId,
    previousOwners: uniquePreviousOwners,
    reassignedBy,
    effectiveDate
  });
}

export async function sendNotification({
  recipientId,
  type,
  title,
  message,
  actionUrl,
  priority = 'medium',
  metadata = {}
}: {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  priority?: 'low' | 'medium' | 'high';
  metadata?: any;
}): Promise<void> {
  try {
    // Create in-app notification
    await prisma.notification.create({
      data: {
        tenantId: metadata.tenantId || null,
        userId: recipientId,
        type,
        title,
        message,
        actionUrl,
        priority,
        metadata,
        isRead: false,
        createdAt: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

export async function sendEmailNotifications({
  accountIds,
  newOwnerId,
  previousOwners,
  reassignedBy,
  effectiveDate
}: NotificationData): Promise<void> {
  try {
    // Get system settings for email configuration
    const emailSettings = await getEmailSettings();

    if (!emailSettings.enabled) {
      return;
    }

    // Get detailed account information
    const accounts = await prisma.account.findMany({
      where: {
        id: { in: accountIds }
      },
      select: {
        id: true,
        accountName: true,
        accountType: {
          select: {
            name: true
          }
        },
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    // Get new owner information
    let newOwner = null;
    if (newOwnerId !== 'house' && newOwnerId !== 'unassigned') {
      newOwner = await prisma.user.findFirst({
        where: { id: newOwnerId },
        select: {
          id: true,
          fullName: true,
          email: true
        }
      });
    }

    // Send email to new owner
    if (newOwner && newOwner.email) {
      await sendReassignmentEmail({
        to: newOwner.email,
        subject: `New Account Assignment - ${accounts.length} Account${accounts.length !== 1 ? 's' : ''}`,
        template: 'account-assignment',
        data: {
          recipientName: newOwner.fullName,
          accounts: accounts.map(acc => ({
            name: acc.accountName,
            type: acc.accountType?.name || 'Unknown',
            previousOwner: acc.owner?.fullName || 'Unassigned'
          })),
          reassignedBy: reassignedBy.fullName,
          effectiveDate: formatDate(effectiveDate),
          totalAccounts: accounts.length
        }
      });
    }

    // Send emails to previous owners
    const uniquePreviousOwners = [...new Set(previousOwners.filter(Boolean))];

    for (const previousOwnerId of uniquePreviousOwners) {
      if (previousOwnerId && previousOwnerId !== reassignedBy.id) {
        const previousOwner = await prisma.user.findFirst({
          where: { id: previousOwnerId },
          select: {
            id: true,
            fullName: true,
            email: true
          }
        });

        if (previousOwner && previousOwner.email) {
          // Get accounts that were reassigned from this owner
          const reassignedFromThisOwner = accounts.filter(acc =>
            acc.owner?.id === previousOwnerId
          );

          await sendReassignmentEmail({
            to: previousOwner.email,
            subject: `Account Reassignment Notice - ${reassignedFromThisOwner.length} Account${reassignedFromThisOwner.length !== 1 ? 's' : ''}`,
            template: 'account-reassignment',
            data: {
              recipientName: previousOwner.fullName,
              accounts: reassignedFromThisOwner.map(acc => ({
                name: acc.accountName,
                type: acc.accountType?.name || 'Unknown',
                newOwner: newOwner?.fullName || (newOwnerId === 'house' ? 'House Account' : 'Unassigned')
              })),
              reassignedBy: reassignedBy.fullName,
              effectiveDate: formatDate(effectiveDate),
              totalAccounts: reassignedFromThisOwner.length
            }
          });
        }
      }
    }

  } catch (error) {
    console.error('Failed to send email notifications:', error);
  }
}

async function sendReassignmentEmail({
  to,
  subject,
  template,
  data
}: {
  to: string;
  subject: string;
  template: string;
  data: any;
}): Promise<void> {
  try {
    // This would integrate with your email service (SendGrid, Mailgun, etc.)
    // For now, we'll create an email queue record

    await prisma.emailQueue.create({
      data: {
        to,
        subject,
        template,
        data,
        status: 'pending',
        priority: 'medium',
        createdAt: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to queue email:', error);
  }
}

async function getEmailSettings(): Promise<{
  enabled: boolean;
  provider?: string;
  fromEmail?: string;
  templates?: any;
}> {
  try {
    // Get email settings from system configuration
    const settings = await prisma.systemSettings.findMany({
      where: {
        settingKey: {
          startsWith: 'email.'
        }
      }
    });

    const emailConfig = settings.reduce((acc, setting) => {
      const key = setting.settingKey.replace('email.', '');
      acc[key] = setting.settingValue;
      return acc;
    }, {} as any);

    return {
      enabled: emailConfig.enabled !== false,
      provider: emailConfig.provider || 'default',
      fromEmail: emailConfig.fromEmail || 'noreply@commissable.com',
      templates: emailConfig.templates || {}
    };
  } catch (error) {
    console.error('Failed to get email settings:', error);
    return {
      enabled: false
    };
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export async function getUserNotificationPreferences(userId: string): Promise<{
  inApp: boolean;
  email: boolean;
  types: string[];
}> {
  try {
    const preferences = await prisma.userNotificationSettings.findFirst({
      where: { userId }
    });

    if (!preferences) {
      // Default preferences
      return {
        inApp: true,
        email: true,
        types: ['ACCOUNT_ASSIGNMENT', 'ACCOUNT_REASSIGNMENT']
      };
    }

    return {
      inApp: preferences.inAppEnabled,
      email: preferences.emailEnabled,
      types: preferences.notificationTypes || []
    };
  } catch (error) {
    console.error('Failed to get notification preferences:', error);
    return {
      inApp: true,
      email: true,
      types: []
    };
  }
}
