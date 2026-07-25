export function formatEmailPayload(orderPayload) {
  return {
    customer_name: orderPayload.customer.fullName,
    customer_email: orderPayload.customer.email,
    customer_phone: orderPayload.customer.phone,
    shipping_address: orderPayload.customer.shippingAddress,
    shipping_city: orderPayload.customer.shippingCity,
    shipping_state: orderPayload.customer.shippingState,
    shipping_zip: orderPayload.customer.shippingPostal,
    billing_address: orderPayload.customer.billingSameAsShipping ? orderPayload.customer.shippingAddress : orderPayload.customer.billingAddress,
    billing_city: orderPayload.customer.billingCity,
    billing_state: orderPayload.customer.billingState,
    billing_zip: orderPayload.customer.billingPostal,
    payment_method: orderPayload.customer.paymentMethod,
    order_notes: orderPayload.customer.orderNotes,
    order_total: orderPayload.total,
    order_items: orderPayload.items.map((item) => `${item.quantity} × ${item.name} (${item.brand})`).join('\n')
  };
}
