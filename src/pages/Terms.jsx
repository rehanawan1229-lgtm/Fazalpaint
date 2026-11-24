import { Link } from 'react-router-dom';
import InfoPage from '../components/InfoPage';
import { SHOP } from '../data/shopInfo';

const sections = [
  {
    heading: 'Using this website',
    paragraphs: [
      `By using this website you agree to these terms. The website is operated by ${SHOP.name}, Dera Ismail Khan, Pakistan.`
    ]
  },
  {
    heading: 'Your account',
    items: [
      'Please give correct information when you sign up or order, and keep your password private.',
      'You are responsible for activity on your account. Tell us if you think someone else has used it.'
    ]
  },
  {
    heading: 'Products, prices and availability',
    items: [
      'We try to keep product details, photos, prices and stock accurate, but mistakes can happen. Colours may look different on your screen.',
      'Prices and availability can change. If an item in your order is not available or a price was listed wrongly, we will contact you before going ahead.'
    ]
  },
  {
    heading: 'Orders and payment',
    items: [
      'Placing an order is a request to buy. An order is confirmed when our team contacts you and agrees the details.',
      'We accept Cash on Delivery, Bank Transfer and Pay at Store. See the Delivery & Payment page for details.',
      'We may decline or cancel an order, for example if we cannot reach you or an item is unavailable.'
    ]
  },
  {
    heading: 'Delivery, returns and support',
    paragraphs: [
      'Delivery is arranged as described on our Delivery & Payment page. All sales are final, with support for defective or damaged items as described on our Returns page.'
    ]
  },
  {
    heading: 'Acceptable use',
    paragraphs: [
      'Please do not misuse the website, attempt to break into it, or use it to send spam or false orders.'
    ]
  },
  {
    heading: 'Liability',
    paragraphs: [
      'We do our best to keep the website available and accurate, but we cannot promise it will always be error-free or uninterrupted. To the extent allowed by law, we are not responsible for losses that result from using the website beyond the value of the order concerned.'
    ]
  },
  {
    heading: 'Governing law and changes',
    paragraphs: [
      'These terms are governed by the laws of Pakistan. We may update them from time to time, and the date at the top shows the latest version.'
    ]
  }
];

function Terms() {
  return (
    <InfoPage
      metaTitle="Terms & Conditions"
      metaDescription="Terms and conditions for using the Fazal Paint Hardware and Trolley House website and placing orders."
      eyebrow="Terms"
      title="Terms & Conditions"
      intro="The simple rules for using our website and placing orders."
      updated="November 2026"
      sections={sections}
    >
      <p className="mt-8 text-sm text-[#8A7A6D]">
        See also our <Link to="/privacy" className="text-accent hover:text-accent-hover">Privacy Policy</Link>,{' '}
        <Link to="/delivery" className="text-accent hover:text-accent-hover">Delivery & Payment</Link> and{' '}
        <Link to="/returns" className="text-accent hover:text-accent-hover">Returns</Link>.
      </p>
    </InfoPage>
  );
}

export default Terms;
