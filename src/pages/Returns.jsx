import InfoPage from '../components/InfoPage';
import { SHOP } from '../data/shopInfo';

const sections = [
  {
    heading: 'Our policy',
    paragraphs: [
      'All sales are final. We do not accept standard returns or exchanges, so please check the product, brand, pack size and shade before you order.'
    ]
  },
  {
    heading: 'Defective or damaged items',
    paragraphs: [
      'If something you received is defective or arrives damaged, please contact us as soon as you notice, and we will look into it and help you.'
    ],
    items: [
      `WhatsApp: ${SHOP.whatsappDisplay}`,
      `Email: ${SHOP.email}`,
      'Please send your invoice number and clear photos of the item and its packing.'
    ]
  },
  {
    heading: 'Before you buy',
    items: [
      'Ask us if you are not sure which paint, primer or tool is right for your job. We are happy to advise by phone, WhatsApp or in the shop.',
      'Colours can look slightly different on a phone or computer screen. For a big job, we suggest checking the shade in person at our shop first.',
      'Check the quantity and pack size (for example quarter, gallon or drum) in your cart before you confirm the order.'
    ]
  },
  {
    heading: 'Changing or cancelling an order',
    paragraphs: [
      'If you need to change or cancel an order, contact us as early as possible. An order that has not been dispatched yet is the easiest to change.'
    ]
  }
];

function Returns() {
  return (
    <InfoPage
      metaTitle="Returns & Support"
      metaDescription="Return and support policy of Fazal Paint Hardware and Trolley House: all sales are final, with support for defective or damaged items."
      eyebrow="Returns & support"
      title="Returns, damaged items and support"
      intro="A short, clear policy so there are no surprises."
      sections={sections}
    />
  );
}

export default Returns;
