import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import Rider from "../../models/Rider.js";
import Customer from "../../models/Customer.js";
import Order from "../../models/Order.js";
import Payment from "../../models/Payment.js";
import BranchProduct from "../../models/BranchProduct.js";
import Branch from "../../models/Branch.js";
import {
  branchQuery,
  isBranchScoped,
} from "../../middlewares/branchScope.middleware.js";

// ==========================================
// GET ADMIN DASHBOARD ANALYTICS
// ==========================================
export const getAdminDashboard = async (req, res) => {
  try {
    // Branch scoping: regular admins see stats for their branch only,
    // superadmins see platform-wide numbers. Products, categories and
    // customers are global catalog/accounting entities and stay unscoped.
    const orderFilter = branchQuery(req, "branch");
    const riderFilter = branchQuery(req, "assignedBranch");

    const scoped = isBranchScoped(req);

    // Customer counts: branch admins only count customers who ordered at
    // their branch; superadmins count everyone.
    let customerFilter = {};
    if (scoped) {
      const rows = await Order.find({ branch: req.adminBranchId })
        .select("user")
        .lean();
      const userIds = [...new Set(rows.map((o) => o.user.toString()))];
      const customers = userIds.length
        ? await Customer.find({ user: { $in: userIds } })
            .select("_id createdAt")
            .lean()
        : [];
      customerFilter = { _id: { $in: customers.map((c) => c._id) } };
      var customerCreatedAt = customers.map((c) => c.createdAt);
    } else {
      var customerCreatedAt = null;
    }

    // Low stock: branch admins see stock from their branch inventory
    // (BranchProduct overrides); superadmins see the global catalogue.
    let lowStockWhere = { stock: { $lte: 5 }, isActive: true };
    if (scoped) {
      const recs = await BranchProduct.find({
        branch: req.adminBranchId,
        isAvailable: true,
        stock: { $ne: null, $lte: 5 },
      })
        .select("product")
        .lean();
      lowStockWhere = {
        _id: { $in: recs.map((r) => r.product) },
        isActive: true,
      };
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalProducts,
      lowStockProducts,
      totalCategories,
      categoryBreakdown,
      lowStockList,
      totalRiders,
      ridersAvailable,
      ridersOffline,
      ridersDelivering,
      totalCustomers,
      newCustomersMonth,
      totalOrders,
      todayOrders,
      pendingOrders,
      processingOrders,
      completedOrders,
      cancelledOrders,
      revenueAgg,
      todayRevenueAgg,
      paymentMethodAgg,
      recentOrders,
      ordersOverTime,
    ] = await Promise.all([
      Product.countDocuments(),
      lowStockWhere === null ? 0 : Product.countDocuments(lowStockWhere),
      Category.countDocuments(),
      Product.aggregate([
        { $group: { _id: "$categoryId", count: { $sum: 1 } } },
        { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, count: 1, name: "$category.name" } },
        { $sort: { count: -1 } },
      ]),
      lowStockWhere === null ? [] : Product.find(lowStockWhere)
        .populate("categoryId", "name")
        .sort({ stock: 1 })
        .limit(5)
        .select("name sku stock categoryId"),
      Rider.countDocuments(riderFilter),
      Rider.countDocuments({ ...riderFilter, availabilityStatus: "available" }),
      Rider.countDocuments({ ...riderFilter, availabilityStatus: "offline" }),
      Rider.countDocuments({ ...riderFilter, availabilityStatus: "delivering" }),
      Customer.countDocuments(customerFilter),
      // New this month — computed from the same scoped customer set
      customerCreatedAt === null
        ? Customer.countDocuments({ createdAt: { $gte: startOfMonth } })
        : customerCreatedAt.filter(
            (d) => new Date(d) >= startOfMonth,
          ).length,
      Order.countDocuments(orderFilter),
      Order.countDocuments({ ...orderFilter, createdAt: { $gte: startOfDay } }),
      Order.countDocuments({ ...orderFilter, status: "pending" }),
      Order.countDocuments({ ...orderFilter, status: "processing" }),
      Order.countDocuments({ ...orderFilter, status: "completed" }),
      Order.countDocuments({ ...orderFilter, status: "cancelled" }),
      Order.aggregate([
        // Revenue only accrues from delivered (completed) orders —
        // pending, cancelled and refunded orders add nothing to sales.
        { $match: { ...orderFilter, status: "completed" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { ...orderFilter, status: "completed", createdAt: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      ]),
      // Payment method split. For branch admins, payments are attributed via
      // their order's branch (payments themselves are not branch-bound).
      isBranchScoped(req)
        ? Payment.aggregate([
            { $match: { status: "paid" } },
            { $lookup: { from: "orders", localField: "order", foreignField: "_id", as: "orderDoc" } },
            { $unwind: "$orderDoc" },
            { $match: { "orderDoc.branch": req.adminBranchId } },
            { $group: { _id: "$paymentMethod", total: { $sum: "$amount" }, count: { $sum: 1 } } },
            { $sort: { total: -1 } },
          ])
        : Payment.aggregate([
            { $match: { status: "paid" } },
            { $group: { _id: "$paymentMethod", total: { $sum: "$amount" }, count: { $sum: 1 } } },
            { $sort: { total: -1 } },
          ]),
      Order.find(orderFilter)
        .populate("user", "firstname lastname email")
        .populate("branch", "name branchCode")
        .sort({ createdAt: -1 })
        .limit(5)
        .select("status totalAmount createdAt"),
      Order.aggregate([
        { $match: { ...orderFilter, createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            orders: { $sum: 1 },
            // Chart revenue counts delivered (completed) orders only
            revenue: {
              $sum: {
                $cond: [{ $eq: ["$status", "completed"] }, "$totalAmount", 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Branch display name so branch admins see which branch the numbers
    // belong to (superadmins get a platform-wide label).
    let branchInfo = null;
    if (scoped) {
      const b = await Branch.findById(req.adminBranchId).select("name branchCode");
      branchInfo = b ? { _id: b._id, name: b.name, branchCode: b.branchCode } : null;
    }

    const revenue = revenueAgg[0] || { total: 0, count: 0 };
    const todayRevenue = todayRevenueAgg[0] || { total: 0, count: 0 };

    return res.status(200).json({
      success: true,
      data: {
        branch: branchInfo,
        overview: {
          totalProducts,
          totalCategories,
          totalRiders,
          totalCustomers,
          newCustomersMonth,
          totalOrders,
        },
        products: {
          total: totalProducts,
          lowStock: lowStockProducts,
          categories: totalCategories,
          categoryBreakdown,
          lowStockList,
        },
        riders: {
          total: totalRiders,
          available: ridersAvailable,
          offline: ridersOffline,
          delivering: ridersDelivering,
        },
        customers: {
          total: totalCustomers,
          newThisMonth: newCustomersMonth,
        },
        orders: {
          total: totalOrders,
          today: todayOrders,
          byStatus: { pending: pendingOrders, processing: processingOrders, completed: completedOrders, cancelled: cancelledOrders },
          recent: recentOrders,
          overTime: ordersOverTime,
        },
        revenue: {
          total: revenue.total,
          today: todayRevenue.total,
          averageOrderValue: revenue.count > 0 ? Math.round(revenue.total / revenue.count) : 0,
          byPaymentMethod: paymentMethodAgg,
        },
      },
    });
  } catch (err) {
    console.error("Get admin analytics error:", err.message);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
