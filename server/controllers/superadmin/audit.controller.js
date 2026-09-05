import AuditLog from "../../models/AuditLog.js";

// ──────────────────────────────────────────────────────────────────────────────
// HELPER: Log an action (fire-and-forget, never breaks the main request)
// ──────────────────────────────────────────────────────────────────────────────

export const logAction = async (userId, action, target, targetId = null, details = null) => {
  try {
    await AuditLog.create({ user: userId, action, target, targetId, details });
  } catch (err) {
    console.error("Audit log error:", err.message);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET AUDIT LOGS — paginated, filterable
// ──────────────────────────────────────────────────────────────────────────────

export const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, action, target, userId } = req.query;

    const filter = {};
    if (action) filter.action = action;
    if (target) filter.target = target;
    if (userId) filter.user = userId;

    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("user", "firstname lastname email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      logs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("Get audit logs error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET RECENT ACTIVITY — latest N entries (for dashboard feed)
// ──────────────────────────────────────────────────────────────────────────────

export const getRecentActivity = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const logs = await AuditLog.find()
      .populate("user", "firstname lastname email")
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    return res.status(200).json({ success: true, logs });
  } catch (err) {
    console.error("Get recent activity error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET AUDIT STATS — summary counts for dashboard widgets
// ──────────────────────────────────────────────────────────────────────────────

export const getAuditStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalLogs, todayLogs, actionCounts] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ createdAt: { $gte: today } }),
      AuditLog.aggregate([
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      totalLogs,
      todayLogs,
      actionCounts,
    });
  } catch (err) {
    console.error("Get audit stats error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};
