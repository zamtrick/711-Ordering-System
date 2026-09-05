import nodemailer from "nodemailer";

/* -------------------------------------------------------------------------- */
/* EMAIL SERVICE                                                              */
/* -------------------------------------------------------------------------- */
/* Currently in LOG-ONLY mode. To enable real emails, set these .env vars:   */
/*   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM                  */
/* -------------------------------------------------------------------------- */

const isEmailEnabled = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

let transporter = null;

if (isEmailEnabled) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  console.log("📧 Email service: ENABLED (SMTP)");
} else {
  console.log("📧 Email service: LOG-ONLY (set SMTP_HOST/PORT/USER/PASS to enable)");
}

const FROM = process.env.EMAIL_FROM || "7-Eleven Online Ordering <noreply@7eleven.com>";

async function sendMail(to, subject, html) {
  if (!isEmailEnabled || !transporter) {
    console.log(`\n📧 [EMAIL LOG] To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${html.replace(/<[^>]*>/g, "").slice(0, 200)}...\n`);
    return { success: true, mode: "log" };
  }

  try {
    const info = await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return { success: true, mode: "smtp", messageId: info.messageId };
  } catch (err) {
    console.error(`📧 Email failed to ${to}:`, err.message);
    return { success: false, mode: "smtp", error: err.message };
  }
}

/* -------------------------------------------------------------------------- */
/* NOTIFICATION FUNCTIONS                                                     */
/* -------------------------------------------------------------------------- */

export async function notifyOrderPlaced(order) {
  const orderId = order._id.toString().slice(-6).toUpperCase();

  // Notify customer
  await sendMail(
    order.customerEmail,
    `Order #${orderId} Placed Successfully`,
    `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <div style="background: #007A53; color: white; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">7-Eleven Online Ordering</h1>
      </div>
      <div style="padding: 24px; background: #f8f5f2;">
        <h2 style="color: #232323;">Order Confirmed! 🎉</h2>
        <p style="color: #555;">Hi ${order.customerName},</p>
        <p style="color: #555;">Your order <strong>#${orderId}</strong> has been placed successfully.</p>
        <div style="background: white; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #555;"><strong>Branch:</strong> ${order.branchName}</p>
          <p style="margin: 4px 0; color: #555;"><strong>Total:</strong> ₱${order.totalAmount.toFixed(2)}</p>
        </div>
        <p style="color: #777; font-size: 13px;">You'll receive another email when your order is being prepared.</p>
      </div>
      <div style="text-align: center; padding: 12px; color: #aaa; font-size: 11px;">
        © 7-Eleven Online Ordering System
      </div>
    </div>
    `,
  );
}

export async function notifyOrderStatusChanged(order) {
  const orderId = order._id.toString().slice(-6).toUpperCase();
  const statusMessages = {
    processing: "Your order is now being prepared! 👨‍🍳",
    completed: "Your order is ready for pickup! ✅",
    cancelled: "Your order has been cancelled. ❌",
  };

  const statusColors = {
    processing: "#FF6720",
    completed: "#007A53",
    cancelled: "#DA291C",
  };

  await sendMail(
    order.customerEmail,
    `Order #${orderId} - ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}`,
    `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <div style="background: #007A53; color: white; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">7-Eleven Online Ordering</h1>
      </div>
      <div style="padding: 24px; background: #f8f5f2;">
        <p style="color: #555;">Hi ${order.customerName},</p>
        <h2 style="color: ${statusColors[order.status] || '#232323'};">${statusMessages[order.status] || `Order status: ${order.status}`}</h2>
        <div style="background: white; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #555;"><strong>Order:</strong> #${orderId}</p>
          <p style="margin: 4px 0; color: #555;"><strong>Status:</strong> <span style="color: ${statusColors[order.status] || '#232323'}; font-weight: bold; text-transform: uppercase;">${order.status}</span></p>
          <p style="margin: 4px 0; color: #555;"><strong>Total:</strong> ₱${order.totalAmount.toFixed(2)}</p>
        </div>
      </div>
      <div style="text-align: center; padding: 12px; color: #aaa; font-size: 11px;">
        © 7-Eleven Online Ordering System
      </div>
    </div>
    `,
  );
}

export async function notifyDeliveryAssigned(rider) {
  const orderId = rider.order.orderId.slice(-6).toUpperCase();

  await sendMail(
    rider.email,
    `New Delivery Assignment - Order #${orderId}`,
    `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <div style="background: #007A53; color: white; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">7-Eleven Delivery</h1>
      </div>
      <div style="padding: 24px; background: #f8f5f2;">
        <p style="color: #555;">Hi ${rider.name},</p>
        <h2 style="color: #232323;">New Delivery! 🚚</h2>
        <p style="color: #555;">You have been assigned a new delivery.</p>
        <div style="background: white; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #555;"><strong>Order:</strong> #${orderId}</p>
          <p style="margin: 4px 0; color: #555;"><strong>Customer:</strong> ${rider.order.customerName}</p>
          <p style="margin: 4px 0; color: #555;"><strong>Branch:</strong> ${rider.order.branchName}</p>
          <p style="margin: 4px 0; color: #555;"><strong>Address:</strong> ${rider.order.branchAddress}</p>
          <p style="margin: 4px 0; color: #555;"><strong>Amount:</strong> ₱${rider.order.totalAmount.toFixed(2)}</p>
        </div>
        <p style="color: #777; font-size: 13px;">Open the rider app to accept and start the delivery.</p>
      </div>
      <div style="text-align: center; padding: 12px; color: #aaa; font-size: 11px;">
        © 7-Eleven Online Ordering System
      </div>
    </div>
    `,
  );
}

export async function notifyDeliveryCompleted(order) {
  const orderId = order._id.toString().slice(-6).toUpperCase();

  await sendMail(
    order.customerEmail,
    `Order #${orderId} Delivered! 🎉`,
    `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <div style="background: #007A53; color: white; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">7-Eleven Online Ordering</h1>
      </div>
      <div style="padding: 24px; background: #f8f5f2;">
        <p style="color: #555;">Hi ${order.customerName},</p>
        <h2 style="color: #007A53;">Order Delivered! 🎉</h2>
        <p style="color: #555;">Your order <strong>#${orderId}</strong> has been delivered successfully.</p>
        <div style="background: white; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #555;"><strong>Order:</strong> #${orderId}</p>
          <p style="margin: 4px 0; color: #555;"><strong>Total:</strong> ₱${order.totalAmount.toFixed(2)}</p>
          <p style="margin: 4px 0; color: #555;"><strong>Status:</strong> <span style="color: #007A53; font-weight: bold;">DELIVERED</span></p>
        </div>
        <p style="color: #777; font-size: 13px;">Thank you for ordering with us! We hope to serve you again.</p>
      </div>
      <div style="text-align: center; padding: 12px; color: #aaa; font-size: 11px;">
        © 7-Eleven Online Ordering System
      </div>
    </div>
    `,
  );
}

export async function notifyAdminCreated(admin) {
  await sendMail(
    admin.email,
    `Welcome to 7-Eleven Admin Panel`,
    `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <div style="background: #007A53; color: white; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">7-Eleven Admin</h1>
      </div>
      <div style="padding: 24px; background: #f8f5f2;">
        <p style="color: #555;">Hi ${admin.name},</p>
        <h2 style="color: #232323;">Welcome Aboard! 🎉</h2>
        <p style="color: #555;">An admin account has been created for you.</p>
        <div style="background: white; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #555;"><strong>Email:</strong> ${admin.email}</p>
          <p style="margin: 4px 0; color: #555;"><strong>Password:</strong> ${admin.tempPassword}</p>
          <p style="margin: 4px 0; color: #555;"><strong>Branch:</strong> ${admin.branchName}</p>
        </div>
        <p style="color: #DA291C; font-size: 13px;">⚠️ Please change your password after your first login.</p>
        <p style="color: #777; font-size: 13px;">Login at: <a href="http://localhost:5173/login" style="color: #007A53;">Admin Panel</a></p>
      </div>
      <div style="text-align: center; padding: 12px; color: #aaa; font-size: 11px;">
        © 7-Eleven Online Ordering System
      </div>
    </div>
    `,
  );
}

export async function notifyRiderCreated(rider) {
  await sendMail(
    rider.email,
    `Welcome to 7-Eleven Rider App`,
    `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <div style="background: #007A53; color: white; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">7-Eleven Rider</h1>
      </div>
      <div style="padding: 24px; background: #f8f5f2;">
        <p style="color: #555;">Hi ${rider.name},</p>
        <h2 style="color: #232323;">Welcome to the Team! 🚚</h2>
        <p style="color: #555;">A rider account has been created for you.</p>
        <div style="background: white; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #555;"><strong>Email:</strong> ${rider.email}</p>
          <p style="margin: 4px 0; color: #555;"><strong>Password:</strong> ${rider.tempPassword}</p>
        </div>
        <p style="color: #DA291C; font-size: 13px;">⚠️ Please change your password after your first login.</p>
        <p style="color: #777; font-size: 13px;">Download the 7-Eleven Rider app to start accepting deliveries.</p>
      </div>
      <div style="text-align: center; padding: 12px; color: #aaa; font-size: 11px;">
        © 7-Eleven Online Ordering System
      </div>
    </div>
    `,
  );
}