import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import Rider from "../../models/Rider.js";
import Customer from "../../models/Customer.js";
import Order from "../../models/Order.js";
import Payment from "../../models/Payment.js";

// ==========================================
// GET ADMIN DASHBOARD ANALYTICS
// ==========================================
export const getAdminDashboard = async (req, res) => {
  try {
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
      Product.countDocuments({ stock: { $lte: 5 }, isActive: true }),
      Category.countDocuments(),
      Product.aggregate([
        { $group: { _id: "$categoryId", count: { $sum: 1 } } },
        { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, count: 1, name: "$category.name" } },
        { $sort: { count: -1 } },
      ]),
      Product.find({ stock: { $lte: 5 }, isActive: true })
        .populate("categoryId", "name")
        .sort({ stock: 1 })
        .limit(5)
        .select("name sku stock categoryId"),
      Rider.countDocuments(),
      Rider.countDocuments({ availabilityStatus: "available" }),
      Rider.countDocuments({ availabilityStatus: "offline" }),
      Rider.countDocuments({ availabilityStatus: "delivering" }),
      Customer.countDocuments(),
      Customer.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: startOfDay } }),
      Order.countDocuments({ status: "pending" }),
      Order.countDocuments({ status: "processing" }),
      Order.countDocuments({ status: "completed" }),
      Order.countDocuments({ status: "cancelled" }),
      Order.aggregate([{ $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { status: "paid" } },
        { $group: { _id: "$paymentMethod", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
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
    ]);

    const revenue = revenueAgg[0] || { total: 0, count: 0 };
    const todayRevenue = todayRevenueAgg[0] || { total: 0, count: 0 };

    return res.status(200).json({
      success: true,
      data: {
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
