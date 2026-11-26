// Generated answers: colour x room and finish x room. Short, practical, no invented product facts.
import { E } from './assistantFaqCore.js';

const COLOURS = [
  { id: 'white', keys: 'safed|white|off white|offwhite', name: 'Safed/off-white', mood: 'kamre ko roshan aur khula dikhata hai', pair: 'kisi bhi accent rang ke sath', care: 'dagh jaldi nazar aate hain, dhoyi ja sakne wali emulsion lein' },
  { id: 'cream', keys: 'cream|beige|ivory|khaki', name: 'Cream/beige', mood: 'naram, garm aur gharelu mahol deta hai', pair: 'brown, maroon aur lakri ke furniture ke sath', care: 'dagh safed se kam nazar aate hain' },
  { id: 'grey', keys: 'grey|gray|slate|charcoal', name: 'Grey', mood: 'jadeed aur saaf-suthra tasur deta hai', pair: 'safed trim aur peele/mustard accent ke sath', care: 'zyada gehra grey kamre ko thanda/andhera kar sakta hai' },
  { id: 'blue', keys: 'neela|blue|aasmani|asmani|sky blue|firoza|firozi|turquoise', name: 'Neela/aasmani', mood: 'sukoon aur thandak ka ehsas deta hai', pair: 'safed aur cream ke sath', care: 'bohat gehra neela roshni kam kar deta hai' },
  { id: 'green', keys: 'hara|green|pista|pistachio|mint|olive|sabz', name: 'Hara/pista/mint', mood: 'taazgi aur qudrati sukoon deta hai', pair: 'cream, safed aur lakri ke sath', care: 'halke shade zyada khulte hain' },
  { id: 'yellow', keys: 'peela|yellow|lemon|mustard|sunehri|golden', name: 'Halka peela/lemon', mood: 'dhoop jaisi garmi aur khushi laata hai', pair: 'safed aur grey ke sath', care: 'bohat tez peela aankhon ko thaka sakta hai' },
  { id: 'pink', keys: 'gulabi|pink|peach|rose|salmon', name: 'Gulabi/peach', mood: 'naram aur dil-lubhaana mahol deta hai', pair: 'safed, cream aur halke grey ke sath', care: 'tez gulabi ke bajaye halka shade zyada khoobsurat lagta hai' },
  { id: 'purple', keys: 'jamni|purple|lavender|violet|lilac', name: 'Lavender/halka jamni', mood: 'nafasat aur sukoon deta hai', pair: 'safed aur halke grey ke sath', care: 'gehra jamni sirf accent ke liye mutanasib hai' },
  { id: 'brown', keys: 'brown|bhura|coffee|mocha|chocolate|terracotta', name: 'Brown/coffee/mocha', mood: 'garm aur shaandar mahol deta hai', pair: 'cream aur safed ke sath', care: 'zyada brown kamre ko andhera kar sakta hai' },
  { id: 'red', keys: 'laal|red|maroon|orange|safron', name: 'Laal/maroon/orange', mood: 'josh aur garmi ka ehsas deta hai', pair: 'cream aur safed ke sath', care: 'poori deewar ke bajaye accent ke liye behtar' },
  { id: 'black', keys: 'kala|black|dark|gehra|navy', name: 'Gehra/dark rang', mood: 'shaandar aur nafees nazar aata hai', pair: 'safed ya halke rang ke sath', care: 'roshni kam ho to kamra chhota dikhta hai; ek deewar tak rakhein' },
];
const ROOMS = [
  { id: 'bedroom', keys: 'bedroom|bed room|sone ka kamra|master bedroom', name: 'bedroom', note: 'aaram aur neend ke liye sukoon wale halke shade behtar hain' },
  { id: 'drawing', keys: 'drawing room|baithak|mehman khana|living room|lounge|guest room', name: 'drawing room', note: 'mehmanon ke liye khula aur shaandar tasur chahiye' },
  { id: 'kids', keys: 'bachon ka kamra|kids room|nursery|bachon ke kamre|children room', name: 'bachon ka kamra', note: 'dhoyi ja sakne wali emulsion aur halke khushnuma shade achhe rehte hain' },
  { id: 'kitchen', keys: 'kitchen|rasoi', name: 'kitchen', note: 'tel/dhuan ki wajah se dhoyi ja sakne wala finish chunna behtar hai' },
  { id: 'bathroom', keys: 'bathroom|washroom|toilet', name: 'bathroom', note: 'nami ki wajah se anti-fungal/moisture-resistant paint aur hawa ka guzar zaroori hai' },
  { id: 'dining', keys: 'dining|dining room|khane ka kamra', name: 'dining room', note: 'garm rang bhook aur mahol ko khushnuma rakhte hain' },
  { id: 'hall', keys: 'hall|lobby|corridor|zeena|seedhiyan|entrance', name: 'hall/corridor', note: 'zyada aamad-o-raft ki wajah se dhoyi ja sakne wali paint behtar hai' },
  { id: 'office', keys: 'office|daftar|study|study room|shop|dukan|dukaan|showroom', name: 'office/shop', note: 'saaf-suthra aur tawajjo barqarar rakhne wala mahol chahiye' },
  { id: 'exterior', keys: 'bahar ki deewar|exterior|ghar ka bahar|boundary|elevation|bahir', name: 'bahar ki deewar', note: 'weather-proof exterior paint lein; halke/darmiyani shade garmi kam dikhate hain' },
  { id: 'ceiling', keys: 'chhat|ceiling|chat', name: 'chhat', note: 'aam tor par safed ya deewar se halka rang kamre ko ooonchha dikhata hai' },
];
export const COLOUR_ROOM = [];
for (const c of COLOURS) for (const r of ROOMS) {
  COLOUR_ROOM.push(E(`cr-${c.id}-${r.id}`, c.keys,
    `${c.name} rang ${r.name} ke liye: ${c.mood}, aur ${c.pair} achha mel khata hai. ${r.note}. Dhyan rahe: ${c.care}.\n\nShade card dukan par dekh kar final karein. 🎨`, '', ['Kitna paint lagega?', 'Rang kaise match karwayen?'], { and: r.keys }));
}

const FIN = [
  { id: 'matt', keys: 'matt|matte|flat', name: 'Matt finish', tip: 'nahmwari chhupata hai, chamak nahi deta, saaf karna thora mushkil' },
  { id: 'silk', keys: 'silk|satin|eggshell|semi gloss|sheen', name: 'Silk/satin finish', tip: 'halki chamak, dhone mein aasan, nahmwari thori zyada nazar aati hai' },
  { id: 'gloss', keys: 'gloss|glossy|chamakdar|high gloss', name: 'Gloss finish', tip: 'sab se chamakdar aur mazboot, magar nahmwari ubhar deta hai' },
];
export const FINISH_ROOM = [];
for (const f of FIN) for (const r of ROOMS) {
  FINISH_ROOM.push(E(`fr-${f.id}-${r.id}`, f.keys,
    `${r.name} ke liye ${f.name}: ${f.tip}. ${r.note}. Sath ki tayari (putty/sanding) achhi ho to finish behtar nazar aata hai. 🖌️`, '', ['Kitna paint lagega?', 'Primer kya hota hai?'], { and: r.keys }));
}
export const MATRIX2 = [...COLOUR_ROOM, ...FINISH_ROOM];
