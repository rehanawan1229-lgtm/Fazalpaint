export function formatCurrency(value) {
  if (value == null) return 'Call for Price';
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  }).format(value).replace('PKR', 'Rs.');
}
