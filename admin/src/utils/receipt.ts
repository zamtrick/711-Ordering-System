// --------------------------------------------------
// RECEIPT PRINTING (branch side)
// --------------------------------------------------
// Generates the same thermal-friendly receipt the customer app shows and
// opens the browser print dialog so branch staff can print the hardcopy
// that goes into the rider's pouch for COD collection.
// --------------------------------------------------

export type ReceiptOrder = {
  _id: string;
  status: string;
  totalAmount: number;
  deliveryFee?: number;
  deliveryAddress?: string;
  createdAt: string;
  user?: { firstname?: string; lastname?: string; email?: string } | null;
  branch?: { name?: string; branchCode?: string; location?: string } | null;
  payment?: { paymentMethod: string; status: string } | null;
  orderItems?: {
    _id?: string;
    quantity: number;
    unitPrice?: number;
    subTotal?: number;
    product?: { name?: string } | null;
  }[];
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash on Delivery",
  card: "Card",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

const peso = (n: number) => `₱${(Number(n) || 0).toFixed(2)}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Escape user-derived strings for safe HTML interpolation
const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const buildReceiptHtml = (order: ReceiptOrder): string => {
  const subtotal =
    order.orderItems?.reduce((s, i) => s + (i.subTotal ?? 0), 0) ??
    order.totalAmount;
  const deliveryFee = order.deliveryFee ?? 0;
  const isCod = (order.payment?.paymentMethod ?? "cash") === "cash";
  const paid = order.payment?.status === "paid" || order.status === "completed";
  const receiptNo = `R-${new Date(order.createdAt).getFullYear()}-${order._id
    .slice(-6)
    .toUpperCase()}`;
  const printedAt = new Date().toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const rows = (order.orderItems ?? [])
    .map(
      (i) => `
        <tr>
          <td class="item">${esc(i.product?.name ?? "Item")}<span class="qty"> × ${i.quantity}</span></td>
          <td class="amount">${peso(i.subTotal ?? 0)}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${esc(receiptNo)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    width: 320px;
    margin: 0 auto;
    padding: 18px 16px 24px;
    font-size: 12px;
    line-height: 1.45;
  }
  @media print {
    body { width: auto; max-width: 320px; }
  }
  .brand { text-align: center; }
  .brand .name { font-size: 20px; font-weight: 800; letter-spacing: 1px; }
  .brand .tag { font-size: 10px; color: #666; margin-top: 2px; }
  .rule { border-top: 1px dashed #999; margin: 12px 0; }
  .rule.solid { border-top: 1px solid #1a1a1a; }
  .meta { font-size: 11px; color: #333; }
  .meta .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .meta .k { color: #666; }
  .meta .v { text-align: right; max-width: 200px; }
  .receipt-no { text-align: center; font-weight: 800; font-size: 13px; margin-bottom: 2px; }
  .branch-name { font-weight: 700; font-size: 13px; margin-bottom: 1px; }
  .branch-loc { font-size: 11px; color: #555; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 0; vertical-align: top; }
  td.item { padding-right: 8px; }
  td.amount { text-align: right; white-space: nowrap; }
  .qty { color: #666; font-size: 11px; }
  .totals .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
  .totals .grand {
    display: flex; justify-content: space-between;
    font-size: 15px; font-weight: 800; margin-top: 6px;
  }
  .grand .p { color: #007A53; }
  .badge {
    display: block; text-align: center;
    margin: 10px auto 0; padding: 5px 10px;
    width: fit-content;
    border: 1.5px solid #007A53; border-radius: 8px;
    color: #007A53; font-weight: 800; font-size: 11px; letter-spacing: 0.5px;
  }
  .badge.pending { border-color: #C77700; color: #C77700; }
  .footer { text-align: center; font-size: 10px; color: #777; margin-top: 12px; }
  .footer .thanks { font-weight: 700; color: #1a1a1a; margin-bottom: 2px; }
  .printed-at { text-align: center; font-size: 9px; color: #aaa; margin-top: 6px; }
</style>
</head>
<body>
  <div class="brand">
    <div class="name">7-ELEVEN</div>
    <div class="tag">ONLINE ORDERING · DELIVERY RECEIPT</div>
  </div>

  <div class="rule"></div>

  <div class="receipt-no">${esc(receiptNo)}</div>
  <div class="meta">
    <div class="row"><span class="k">Date</span><span>${esc(formatDate(order.createdAt))}</span></div>
    <div class="row"><span class="k">Order ID</span><span>#${esc(order._id.slice(-8).toUpperCase())}</span></div>
  </div>

  <div class="rule"></div>

  <div class="branch-name">${esc(order.branch?.name ?? "Branch")}${order.branch?.branchCode ? ` · #${esc(order.branch.branchCode)}` : ""}</div>
  ${order.branch?.location ? `<div class="branch-loc">${esc(order.branch.location)}</div>` : ""}

  <div class="rule"></div>

  ${order.user ? `<div class="meta" style="margin-bottom:8px;"><div class="row"><span class="k">Billed to</span><span class="v">${esc(order.user.firstname ?? "")} ${esc(order.user.lastname ?? "")}</span></div></div>` : ""}
  ${order.deliveryAddress ? `<div class="meta" style="margin-bottom:8px;"><div class="row"><span class="k">Deliver to</span><span class="v">${esc(order.deliveryAddress)}</span></div></div>` : ""}

  <div class="rule"></div>

  <table>${rows}</table>

  <div class="rule"></div>

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${peso(subtotal)}</span></div>
    <div class="row"><span>Delivery Fee</span><span>${peso(deliveryFee)}</span></div>
    <div class="grand"><span>TOTAL</span><span class="p">${peso(order.totalAmount)}</span></div>
  </div>

  <div class="rule solid"></div>

  <div class="meta">
    <div class="row"><span class="k">Payment method</span><span>${esc(PAYMENT_LABELS[order.payment?.paymentMethod ?? "cash"] ?? order.payment?.paymentMethod ?? "Cash")}</span></div>
    <div class="row"><span class="k">Payment status</span><span>${paid ? "PAID" : isCod ? "TO BE COLLECTED ON DELIVERY" : "PENDING"}</span></div>
  </div>
  ${!paid && isCod ? `<div class="badge pending">CASH ON DELIVERY — PLEASE COLLECT ${peso(order.totalAmount)}</div>` : ""}
  ${paid ? `<div class="badge">PAID IN FULL</div>` : ""}

  <div class="rule"></div>

  <div class="footer">
    <div class="thanks">Thank you for your order!</div>
    <div>This receipt serves as proof of purchase.</div>
    <div>Keep this copy for your records and any returns.</div>
    <div class="printed-at">Printed ${esc(printedAt)}</div>
  </div>
</body>
</html>`;
};

/** Open the browser print dialog with the rendered receipt. */
export const printReceipt = (order: ReceiptOrder): void => {
  const win = window.open("", "_blank", "width=420,height=640");

  if (!win) {
    // Popup blocked — fall back to a hidden iframe print
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);

    frame.contentDocument?.write(buildReceiptHtml(order));
    frame.contentDocument?.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    frame.onload = () => setTimeout(() => frame.remove(), 1000);
    return;
  }

  win.document.write(buildReceiptHtml(order));
  win.document.close();
  win.focus();
  win.onload = () => win.print();
  // Fallback if onload already fired
  setTimeout(() => win.print(), 300);
};
