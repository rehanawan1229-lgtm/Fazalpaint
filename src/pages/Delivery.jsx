import { Link } from 'react-router-dom';
import InfoPage from '../components/InfoPage';
import { BRANCHES, SHOP } from '../data/shopInfo';

const sections = [
  {
    heading: 'Delivery',
    paragraphs: [
      'We deliver across Pakistan. Delivery charges and the expected time depend on your city and the size of your order, so our team confirms them with you by phone or WhatsApp after you place the order.'
    ]
  },
  {
    heading: 'How your order moves',
    items: [
      'You place the order on the website. It reaches the shop immediately.',
      'Our team contacts you to confirm the items, the delivery or pickup, and the payment method.',
      'Your order is prepared and then dispatched or kept ready for pickup.',
      'You can follow the status any time on the Track Order page using your invoice number and phone number.'
    ]
  },
  {
    heading: 'Pickup from the shop',
    paragraphs: [
      `You can collect your order from either branch on Bannu Road, Dera Ismail Khan (${BRANCHES.map((b) => b.landmark.toLowerCase()).join(' or ')}). ${SHOP.hours}.`
    ]
  },
  {
    heading: 'Payment methods',
    items: [
      'Cash on Delivery: pay when your order reaches you. Our team confirms the order by phone first.',
      'Bank Transfer: our team shares the payment details with you after you place the order, and your order is processed once the payment is confirmed.',
      'Pay at Store: pay when you collect your order from the shop.'
    ]
  },
  {
    heading: 'Please keep your phone reachable',
    paragraphs: [
      'Every order is confirmed by a call or message from us. If we cannot reach you, your order may be delayed, so please double-check the phone number you enter at checkout.'
    ]
  }
];

function Delivery() {
  return (
    <InfoPage
      metaTitle="Delivery & Payment"
      metaDescription="Delivery, pickup and payment options at Fazal Paint Hardware and Trolley House, Dera Ismail Khan: Cash on Delivery, Bank Transfer and Pay at Store."
      eyebrow="Delivery & payment"
      title="How delivery and payment work"
      intro="Everything you need to know before you place an order."
      sections={sections}
    >
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/track-order" className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-lift">
          Track my order
        </Link>
        <a href={SHOP.whatsappLink} target="_blank" rel="noreferrer" className="rounded-2xl border border-[#F3E4D4] bg-white px-5 py-3 text-sm font-semibold text-[#4A3527] transition-all hover:-translate-y-0.5 hover:shadow-soft">
          Ask about delivery on WhatsApp
        </a>
      </div>
    </InfoPage>
  );
}

export default Delivery;
