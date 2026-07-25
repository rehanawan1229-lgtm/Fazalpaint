import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

function formatOrderEmail(order) {
  const billingAddress = order.customer.billingSameAsShipping
    ? order.customer.shippingAddress
    : order.customer.billingAddress;

  const itemsText = order.items
  .map((item, index) => `${index + 1}. ${item.quantity} x ${item.name} (${item.brand}) — ${item.packaging} — ${item.colorName || 'Standard'}`)
  .join('\n');
  
  return `New order received\n\nOrder date: ${order.orderDate}\n\nCustomer details:\nName: ${order.customer.fullName}\nEmail: ${order.customer.email}\nPhone: ${order.customer.phone}\n\nShipping address:\n${order.customer.shippingAddress}\n${order.customer.shippingCity}, ${order.customer.shippingState} ${order.customer.shippingPostal}\n\nBilling address:\n${billingAddress}\n\nPayment method: ${order.customer.paymentMethod}\n\nOrder notes:\n${order.customer.orderNotes || 'None'}\n\nItems:\n${itemsText}\n\nSubtotal: ${order.total}\n`;  
}

export async function POST({ request }) {
  const order = await request.json();

  const mailOptions = {
    from: process.env.SMTP_FROM || 'order@fazalpainthardware.com',
    to: 'fazalpainthardware1@outlook.com',
    subject: `New order from ${order.customer.fullName}`,
    text: formatOrderEmail(order)
  };

  await transporter.sendMail(mailOptions);

  return new Response(JSON.stringify({ message: 'Order sent' }), { status: 200 });
}
