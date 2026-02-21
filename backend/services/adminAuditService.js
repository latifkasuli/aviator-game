const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class AdminAuditService {
  async log({
    adminUserId,
    action,
    targetType,
    targetId,
    before = null,
    after = null,
    notes = null,
    ip = null,
    userAgent = null,
    tx = null
  }) {
    try {
      const data = {
        adminUserId,
        action,
        targetType,
        targetId: String(targetId),
        before,
        after,
        notes,
        ip,
        userAgent
      };

      const db = tx || prisma;
      
      return await db.adminAuditLog.create({
        data
      });
    } catch (error) {
      console.error('Admin audit log error:', error);
      return null;
    }
  }

  async getLogsForTarget(targetType, targetId, limit = 50) {
    try {
      return await prisma.adminAuditLog.findMany({
        where: {
          targetType,
          targetId: String(targetId)
        },
        include: {
          adminUser: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }
  }

  async getLogsForAdmin(adminUserId, limit = 50) {
    try {
      return await prisma.adminAuditLog.findMany({
        where: {
          adminUserId
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit
      });
    } catch (error) {
      console.error('Error fetching admin logs:', error);
      return [];
    }
  }

  async searchLogs({
    action = null,
    targetType = null,
    adminUserId = null,
    startDate = null,
    endDate = null,
    page = 1,
    limit = 50
  }) {
    try {
      const where = {};
      
      if (action) where.action = action;
      if (targetType) where.targetType = targetType;
      if (adminUserId) where.adminUserId = adminUserId;
      
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        prisma.adminAuditLog.findMany({
          where,
          include: {
            adminUser: {
              select: {
                id: true,
                username: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take: limit
        }),
        prisma.adminAuditLog.count({ where })
      ]);

      return {
        logs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error searching audit logs:', error);
      return {
        logs: [],
        total: 0,
        page,
        limit,
        totalPages: 0
      };
    }
  }
}

module.exports = new AdminAuditService();
