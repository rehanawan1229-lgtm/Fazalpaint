import InfoPage from '../components/InfoPage';
import { SHOP } from '../data/shopInfo';

const sections = [
  {
    heading: 'Who we are',
    paragraphs: [
      `This website is run by ${SHOP.name}, Bannu Road, Dera Ismail Khan, Khyber Pakhtunkhwa, Pakistan. This policy explains what information we collect when you use the website and how we use it.`
    ]
  },
  {
    heading: 'Information we collect',
    items: [
      'Account details: your name, email address and password (stored in protected form, never as plain text).',
      'Sign-in with Google: if you choose it, we receive your name and email address from Google.',
      'Order details: delivery name, phone number, address, city, items ordered, payment method and order history.',
      'Messages you send us: support tickets, quotation requests and chat questions.',
      'Basic technical data such as your browser type, which is needed for the website to work.'
    ]
  },
  {
    heading: 'How we use it',
    items: [
      'To create and secure your account, including sending one-time verification codes by email.',
      'To process, confirm, deliver and track your orders, and to contact you about them by phone, WhatsApp or email.',
      'To answer your support requests and quotation requests.',
      'To keep the website working properly and prevent misuse.'
    ]
  },
  {
    heading: 'Who we share it with',
    paragraphs: [
      'We do not sell your personal information. We only share what is needed with the services that help us run the website: Google (for Sign-In and maps), our email provider (for verification codes and order emails), our website and server hosting providers, and messaging or calling services used to confirm orders.'
    ]
  },
  {
    heading: 'Cookies and local storage',
    paragraphs: [
      'The website stores a small amount of data in your browser, such as your login session, your cart, and recently loaded product data so pages open faster. Clearing your browser data removes it.'
    ]
  },
  {
    heading: 'Your choices',
    paragraphs: [
      `You can view and update your profile and addresses in your account. To ask us to correct or delete your information, contact us on WhatsApp (${SHOP.whatsappDisplay}) or by email (${SHOP.email}).`
    ]
  },
  {
    heading: 'Changes to this policy',
    paragraphs: ['We may update this policy from time to time. The date at the top shows when it was last changed.']
  }
];

function Privacy() {
  return (
    <InfoPage
      metaTitle="Privacy Policy"
      metaDescription="How Fazal Paint Hardware and Trolley House collects, uses and protects your information on this website."
      eyebrow="Privacy"
      title="Privacy Policy"
      intro="We collect only what we need to take and deliver your orders, and we keep it safe."
      updated="November 2026"
      sections={sections}
    />
  );
}

export default Privacy;
