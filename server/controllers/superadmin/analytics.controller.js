import Branch from "../../models/Branch.js";
import Admin from "../../models/Admin.js";
import Customer from "../../models/Customer.js";
import Rider from "../../models/Rider.js";
import Order from "../../models/Order.js";
import Payment from "../../models/Payment.js";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import User from "../../models/User.js";

// ──────────────────────────────────────────────────────────────────────────────
// HELPER: Build date ranges used across all analytics queries
// ──────────────────────────────────────────────────────────────────────────────

function getDateRanges() {
  const now = new Date();
  return {
    now,
    startOfDay: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    startOfWeek: (() => {
      const d = new Date(now);
      d.setDate(now.getDate() - now.getDay());
      d.setHours(0, 0, 0, 0);
      return d;
    })(),
    startOfMonth: new Date(now.getFullYear(), now.getMonth(), 1),
    sevenDaysAgo: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// QUERY FUNCTIONS: Each returns a focused piece of analytics
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Branch analytics — counts by status + aggregated breakdown
 */
async function getBranchAnalytics() {
  const [total, active, inactive, maintenance, byStatus] = await Promise.all([
    Branch.countDocuments(),
    Branch.countDocuments({ status: "active" }),
    Branch.countDocuments({ status: "inactive" }),
    Branch.countDocuments({ status: "maintenance" }),
    Branch.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  return { total, active, inactive, maintenance, byStatus };
}

/**
 * Admin analytics — total, active, inactive
 */
async function getAdminAnalytics() {
  const [total, active, inactive] = await Promise.all([
    Admin.countDocuments(),
    User.countDocuments({ role: "admin", isActive: true }),
    User.countDocuments({ role: "admin", isActive: false }),
  ]);

  return { total, active, inactive };
}

/**
 * Customer analytics — total + new this month
 */
async function getCustomerAnalytics(startOfMonth) {
  const [total, newThisMonth] = await Promise.all([
    Customer.countDocuments(),
    Customer.countDocuments({ createdAt: { $gte: startOfMonth } }),
  ]);

  return { total, newThisMonth };
}

/**
 * Rider analytics — counts by availability status
 */
async function getRiderAnalytics() {
  const [total, available, offline, delivering] = await Promise.all([
    Rider.countDocuments(),
    Rider.countDocuments({ availabilityStatus: "available" }),
    Rider.countDocuments({ availabilityStatus: "offline" }),
    Rider.countDocuments({ availabilityStatus: "delivering" }),
  ]);

  return { total, available, offline, delivering };
}

/**
 * Product analytics — totals, low stock, categories
 */
async function getProductAnalytics() {
  const [total, inactive, lowStock, categories, categoryBreakdown, lowStockList] =
    await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ isActive: false }),
      Product.countDocuments({ stock: { $lte: 5 }, isActive: true }),
      Category.countDocuments(),
      Product.aggregate([
        { $group: { _id: "$categoryId", count: { $sum: 1 } } },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, count: 1, name: "$category.name" } },
        { $sort: { count: -1 } },
      ]),
      Product.find({ stock: { $lte: 5 }, isActive: true })
        .populate("categoryId", "name")
        .sort({ stock: 1 })
        .limit(5)
        .select("name sku stock categoryId"),
    ]);

  return { total, inactive, lowStock, categories, categoryBreakdown, lowStockList };
}

/**
 * Order analytics — counts, status breakdown, recent, trends, top branches
 */
async function getOrderAnalytics({ startOfDay, startOfWeek, startOfMonth, sevenDaysAgo }) {
  const [
    total,
    today,
    thisWeek,
    thisMonth,
    pending,
    processing,
    completed,
    cancelled,
    refunded,
    recent,
    overTime,
    topBranches,
  ] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ createdAt: { $gte: startOfDay } }),
    Order.countDocuments({ createdAt: { $gte: startOfWeek } }),
    Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Order.countDocuments({ status: "pending" }),
    Order.countDocuments({ status: "processing" }),
    Order.countDocuments({ status: "completed" }),
    Order.countDocuments({ status: "cancelled" }),
    Order.countDocuments({ status: "refunded" }),
    Order.find()
      .populate("user", "firstname lastname email")
      .populate("branch", "name branchCode")
      .sort({ createdAt: -1 })
      .limit(5)
      .select("status totalAmount createdAt"),
    Order.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orders: { $sum: 1 },
          revenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      {
        $group: {
          _id: "$branch",
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
        },
      },
      {
        $lookup: {
          from: "branches",
          localField: "_id",
          foreignField: "_id",
          as: "branch",
        },
      },
      { $unwind: { path: "$branch", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          orderCount: 1,
          totalRevenue: 1,
          name: "$branch.name",
          branchCode: "$branch.branchCode",
        },
      },
      { $sort: { orderCount: -1 } },
      { $limit: 5 },
    ]),
  ]);

  return {
    total,
    today,
    thisWeek,
    thisMonth,
    byStatus: { pending, processing, completed, cancelled, refunded },
    recent,
    overTime,
    topBranches,
  };
}

/**
 * Revenue analytics — totals by period + payment method breakdown
 */
async function getRevenueAnalytics({ startOfDay, startOfWeek, startOfMonth }) {
  const [totalAgg, todayAgg, weekAgg, monthAgg, byPaymentMethod] = await Promise.all([
    Order.aggregate([
      { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: startOfDay } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: startOfWeek } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { status: "paid" } },
      {
        $group: {
          _id: "$paymentMethod",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]),
  ]);

  const total = totalAgg[0] || { total: 0, count: 0 };
  const today = todayAgg[0] || { total: 0, count: 0 };
  const week = weekAgg[0] || { total: 0, count: 0 };
  const month = monthAgg[0] || { total: 0, count: 0 };

  return {
    total: total.total,
    today: today.total,
    thisWeek: week.total,
    thisMonth: month.total,
    averageOrderValue: total.count > 0 ? Math.round(total.total / total.count) : 0,
    byPaymentMethod,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN CONTROLLER: Assembles all analytics into a single response
// ──────────────────────────────────────────────────────────────────────────────

export const getDashboardAnalytics = async (req, res) => {
  try {
    const ranges = getDateRanges();

    // Run all domain queries in parallel
    const [branches, admins, customers, riders, products, orders, revenue] =
      await Promise.all([
        getBranchAnalytics(),
        getAdminAnalytics(),
        getCustomerAnalytics(ranges.startOfMonth),
        getRiderAnalytics(),
        getProductAnalytics(),
        getOrderAnalytics(ranges),
        getRevenueAnalytics(ranges),
      ]);

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalBranches: branches.total,
          activeBranches: branches.active,
          totalAdmins: admins.total,
          activeAdmins: admins.active,
          totalCustomers: customers.total,
          newCustomersMonth: customers.newThisMonth,
          totalRiders: riders.total,
          totalProducts: products.total,
          totalCategories: products.categories,
          totalOrders: orders.total,
        },
        branches,
        admins,
        customers,
        riders,
        products,
        orders,
        revenue,
      },
    });
  } catch (err) {
    console.error("Get analytics error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};
