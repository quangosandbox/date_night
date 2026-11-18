// Fictional "details" content for mock venues and films: reviews, menu highlights, links.
// In production this comes from Google Places (reviews, photos, website), Resy/OpenTable
// (menus) and Letterboxd (reviews). Reviewers and quotes here are invented.
import type { Highlight, Link, Review } from '../../shared/types.ts';
import { rng } from '../util.ts';

const DISHES: Record<string, [string, string][]> = {
  Italian: [['Cacio e pepe', 'Pecorino, black pepper, tonnarelli'], ['Burrata', 'Charred peaches, basil oil'], ['Vodka rigatoni', 'Calabrian chili, cream'], ['Tiramisù', 'Made to order, extra cocoa'], ['Lamb ragù', 'Pappardelle, mint gremolata']],
  Japanese: [['Toro hand roll', 'Scallion, fresh-grated wasabi'], ['Uni & ikura bowl', 'Seasoned rice, shiso'], ['Tonkotsu ramen', '18-hour pork broth'], ['Miso black cod', 'Marinated three days'], ['Matcha soft serve', 'Black sesame crumble']],
  Mexican: [['Al pastor tacos', 'Pineapple, salsa verde'], ['Mole negro', '30 ingredients, slow-braised chicken'], ['Elote', 'Cotija, chili-lime mayo'], ['Mezcal flight', 'Three small-batch pours'], ['Churros', 'Cajeta & chocolate dip']],
  French: [['Steak frites', 'Béarnaise, shoestring fries'], ['Duck confit', 'Lentils, cherry jus'], ['French onion soup', 'Gruyère lid'], ['Crème brûlée', 'Tahitian vanilla'], ['Moules marinières', 'White wine, grilled bread']],
  Thai: [['Khao soi', 'Curry noodle soup, crispy noodles'], ['Crispy rice salad', 'Sour pork, herbs, peanuts'], ['Gai yang', 'Grilled chicken, tamarind dip'], ['Pad see ew', 'Wok-charred wide noodles'], ['Mango sticky rice', 'Coconut cream']],
  Korean: [['Galbi', 'Marinated short rib for the grill'], ['Kimchi pancake', 'Crispy edges, soy dip'], ['Soju slushie', 'Yakult or peach'], ['Bibimbap', 'Sizzling stone bowl'], ['Spicy rice cakes', 'Gochujang, cheese pull']],
  Indian: [['Butter chicken', 'Smoky tomato gravy'], ['Goan fish curry', 'Coconut, kokum'], ['Garlic naan', 'Straight from the tandoor'], ['Lamb biryani', 'Sealed pot, saffron'], ['Gulab jamun', 'Cardamom syrup']],
  Mediterranean: [['Grilled octopus', 'Fava purée, capers'], ['Mezze for two', 'Hummus, baba, muhammara'], ['Whole branzino', 'Lemon, oregano'], ['Lamb kofta', 'Sumac onions'], ['Baklava', 'Pistachio, honey']],
  American: [['Half chicken', 'Wood-fired, salsa verde'], ['Smash burger', 'Double patty, house pickles'], ['Fried chicken', 'Hot honey, biscuit'], ['Dry-aged ribeye', '45 days, bone-in'], ['Skillet cookie', 'Brown butter, sea salt']],
  Chinese: [['Hand-pulled noodles', 'Cumin lamb, chili oil'], ['Soup dumplings', 'Pork & crab'], ['Peking duck', 'Carved tableside'], ['Mapo tofu', 'Numbing, very good'], ['Egg tarts', 'Flaky, still warm']],
};

const REVIEW_LINES = [
  'The {dish} alone is worth the trip. We split one and immediately ordered another.',
  'Perfect date spot — dim, buzzy but you can still hear each other. Get the {dish}.',
  'Service was warm and unhurried. They let us linger over dessert.',
  'Came for an anniversary. The {dish} was the highlight of my month, honestly.',
  'Cozy room, great playlist, and the {dish} was ridiculous.',
  'A little loud at peak hours, but the food more than makes up for it.',
  'Bartender made us something off-menu and it was perfect.',
  'We sat at the counter and watched the kitchen — dinner and a show.',
  'Pricey but special. Saving this one for celebrations.',
  'Ordered way too much and regret nothing. The {dish} is a must.',
];

const FILM_REVIEW_LINES = [
  'Held my partner’s hand so hard during the last act.',
  'The kind of movie you talk about all the way home.',
  'Gorgeous to look at. See it on the biggest screen you can.',
  'Funnier than it had any right to be.',
  'I’m still thinking about that final shot.',
  'A perfect date movie — just enough tension, just enough heart.',
  'The score is doing a lot of heavy lifting and I’m here for it.',
  'Slow start, then it absolutely grabs you.',
];

const NAMES = ['Priya', 'Marcus', 'Elena', 'Jordan', 'Wen', 'Tasha', 'Diego', 'Noor', 'Callum', 'Ines', 'Kenji', 'Ruth', 'Omar', 'Bea'];
const AGO = ['2 days ago', 'last week', '3 weeks ago', 'a month ago', '2 months ago'];

const pick = <T,>(arr: T[], r: () => number) => arr[Math.floor(r() * arr.length)];

function pickDistinct<T>(arr: T[], n: number, r: () => number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}

export function venueContent(v: { id: string; cuisine: string; price: number; rating: number; name: string; address: string }) {
  const r = rng(`content|${v.id}`);
  const dishes = pickDistinct(DISHES[v.cuisine] ?? DISHES.American, 3, r);
  const base = [14, 22, 32, 46][v.price - 1];
  const highlights: Highlight[] = dishes.map(([name, desc], i) => ({
    name,
    desc,
    price: `$${base + Math.floor(r() * 8) - (i === 2 ? 6 : 0)}`,
    tag: i === 0 ? 'Most ordered' : undefined,
  }));
  const authors = pickDistinct(NAMES, 2, r);
  const reviews: Review[] = pickDistinct(REVIEW_LINES, 2, r).map((line, i) => ({
    author: authors[i],
    stars: Math.min(5, Math.max(4, Math.round(v.rating + (r() - 0.5)))),
    text: line.replace('{dish}', pick(dishes, r)[0].toLowerCase()),
    when: pick(AGO, r),
    source: 'Google',
  }));
  const links: Link[] = [
    { label: 'Directions', url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.name} ${v.address} New York`)}` },
    { label: 'Full menu', url: `https://www.google.com/search?q=${encodeURIComponent(`${v.name} menu`)}` },
  ];
  return { highlights, reviews, links };
}

export function filmContent(f: { id: string; title: string; year: number; director: string; rating: number; genres: string[] }) {
  const r = rng(`content|${f.id}`);
  const authors = pickDistinct(NAMES, 2, r);
  const reviews: Review[] = pickDistinct(FILM_REVIEW_LINES, 2, r).map((text, i) => ({
    author: authors[i].toLowerCase() + pick(['_watches', 'films', '.reel', '_cinema'], r),
    stars: Math.min(5, Math.max(3, Math.round((f.rating + (r() - 0.3)) * 2) / 2)),
    text,
    when: pick(AGO, r),
    source: 'Letterboxd',
  }));
  const highlights: Highlight[] = [
    { name: 'Directed by', desc: f.director },
    { name: 'Vibe', desc: f.genres.join(' + ') + (f.rating >= 4.2 ? ' · critics’ darling' : ' · crowd-pleaser') },
  ];
  const links: Link[] = [
    { label: 'Trailer', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${f.title} ${f.year} trailer`)}` },
    { label: 'Letterboxd', url: `https://letterboxd.com/search/${encodeURIComponent(f.title)}/` },
  ];
  return { highlights, reviews, links };
}
