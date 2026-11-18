// Fictional seed data for the mock providers. Every venue, film and theater here is made up,
// so nothing in the demo misrepresents a real business's ratings or availability.
import type { Area } from '../../shared/types.ts';

export const AREAS: Area[] = [
  { id: 'west-village', name: 'West Village', lat: 40.7358, lng: -74.0036 },
  { id: 'lower-east-side', name: 'Lower East Side', lat: 40.7150, lng: -73.9843 },
  { id: 'williamsburg', name: 'Williamsburg', lat: 40.7081, lng: -73.9571 },
  { id: 'park-slope', name: 'Park Slope', lat: 40.6710, lng: -73.9814 },
  { id: 'midtown', name: 'Midtown', lat: 40.7549, lng: -73.9840 },
  { id: 'harlem', name: 'Harlem', lat: 40.8116, lng: -73.9465 },
];

export const CUISINES = ['Italian', 'Japanese', 'Mexican', 'French', 'Thai', 'Korean', 'Indian', 'Mediterranean', 'American', 'Chinese'];
export const GENRES = ['Drama', 'Comedy', 'Thriller', 'Romance', 'Sci-Fi', 'Horror', 'Animation', 'Documentary'];
export const FORMATS = ['Standard', 'IMAX', 'Dolby', '35mm'];

export interface SeedVenue {
  id: string;
  name: string;
  cuisine: string;
  price: 1 | 2 | 3 | 4;
  rating: number;
  reviews: number;
  area: string;
  street: string;
  blurb: string;
  tags: string[];
  providers: ('resy' | 'opentable')[];
}

// Offsets (in degrees) are applied per venue so distances vary within a neighborhood.
export const VENUES: SeedVenue[] = [
  { id: 'v-osteria-lume', name: 'Osteria Lume', cuisine: 'Italian', price: 3, rating: 4.7, reviews: 1840, area: 'west-village', street: '41 Perry St', blurb: 'Hand-cut pasta, candlelight, a wine list that rewards curiosity.', tags: ['Cozy', 'Wine bar'], providers: ['resy'] },
  { id: 'v-kumo-counter', name: 'Kumo Counter', cuisine: 'Japanese', price: 4, rating: 4.8, reviews: 920, area: 'west-village', street: '12 Bank St', blurb: 'Ten-seat omakase. Sit side by side and let the chef drive.', tags: ['Omakase', 'Counter'], providers: ['resy'] },
  { id: 'v-petit-fennel', name: 'Petit Fennel', cuisine: 'French', price: 3, rating: 4.5, reviews: 1320, area: 'west-village', street: '88 Hudson St', blurb: 'Steak frites, zinc bar, a very good crème brûlée.', tags: ['Bistro'], providers: ['opentable', 'resy'] },
  { id: 'v-casa-verde', name: 'Casa Verde', cuisine: 'Mexican', price: 2, rating: 4.4, reviews: 2210, area: 'west-village', street: '230 W 4th St', blurb: 'Mezcal flights and blue-corn tacos on a leafy back patio.', tags: ['Patio', 'Cocktails'], providers: ['opentable'] },
  { id: 'v-saffron-row', name: 'Saffron Row', cuisine: 'Indian', price: 2, rating: 4.6, reviews: 1580, area: 'west-village', street: '19 Greenwich Ave', blurb: 'Coastal curries and a tandoor that runs hot all night.', tags: ['Spicy'], providers: ['resy'] },
  { id: 'v-little-olive', name: 'Little Olive', cuisine: 'Mediterranean', price: 2, rating: 4.3, reviews: 980, area: 'west-village', street: '71 Christopher St', blurb: 'Mezze for two, grilled octopus, and a warm room.', tags: ['Shareable'], providers: ['opentable'] },

  { id: 'v-nonna-grit', name: 'Nonna Grit', cuisine: 'Italian', price: 2, rating: 4.5, reviews: 2640, area: 'lower-east-side', street: '101 Rivington St', blurb: 'Red-sauce joint with a DJ. Order the vodka rigatoni.', tags: ['Lively'], providers: ['resy'] },
  { id: 'v-baan-noi', name: 'Baan Noi', cuisine: 'Thai', price: 2, rating: 4.6, reviews: 1730, area: 'lower-east-side', street: '45 Clinton St', blurb: 'Northern Thai grill, sticky rice, and very cold beer.', tags: ['Spicy', 'Casual'], providers: ['resy', 'opentable'] },
  { id: 'v-seoul-smoke', name: 'Seoul Smoke', cuisine: 'Korean', price: 3, rating: 4.7, reviews: 1410, area: 'lower-east-side', street: '7 Orchard St', blurb: 'Tabletop grilling, banchan refills, soju slushies.', tags: ['Interactive'], providers: ['resy'] },
  { id: 'v-jade-lantern', name: 'Jade Lantern', cuisine: 'Chinese', price: 2, rating: 4.4, reviews: 1990, area: 'lower-east-side', street: '60 Division St', blurb: 'Hand-pulled noodles and a hidden cocktail den downstairs.', tags: ['Speakeasy'], providers: ['opentable'] },
  { id: 'v-le-comptoir', name: 'Le Comptoir Bleu', cuisine: 'French', price: 4, rating: 4.8, reviews: 640, area: 'lower-east-side', street: '150 Stanton St', blurb: 'Tasting menu in a former print shop. Dress up a little.', tags: ['Tasting menu', 'Special occasion'], providers: ['resy'] },
  { id: 'v-taqueria-sol', name: 'Taquería Sol', cuisine: 'Mexican', price: 1, rating: 4.5, reviews: 3120, area: 'lower-east-side', street: '22 Essex St', blurb: 'Al pastor off the trompo. Counter seats, quick turns.', tags: ['Casual'], providers: ['opentable'] },

  { id: 'v-ember-oak', name: 'Ember & Oak', cuisine: 'American', price: 3, rating: 4.6, reviews: 2050, area: 'williamsburg', street: '310 Wythe Ave', blurb: 'Wood-fired everything. Get the half chicken to share.', tags: ['Wood-fired'], providers: ['resy', 'opentable'] },
  { id: 'v-ramen-tide', name: 'Ramen Tide', cuisine: 'Japanese', price: 2, rating: 4.5, reviews: 2870, area: 'williamsburg', street: '88 N 6th St', blurb: 'Rich tonkotsu and a highball machine.', tags: ['Casual', 'Late night'], providers: ['resy'] },
  { id: 'v-figlia', name: 'Figlia', cuisine: 'Italian', price: 3, rating: 4.7, reviews: 1690, area: 'williamsburg', street: '201 Grand St', blurb: 'Naturally leavened pizza and an orange-wine list.', tags: ['Pizza', 'Natural wine'], providers: ['resy'] },
  { id: 'v-mesa-roja', name: 'Mesa Roja', cuisine: 'Mexican', price: 2, rating: 4.3, reviews: 1160, area: 'williamsburg', street: '45 Bedford Ave', blurb: 'Moles from Oaxaca and a rooftop with a skyline view.', tags: ['Rooftop'], providers: ['opentable'] },
  { id: 'v-tamarind-house', name: 'Tamarind House', cuisine: 'Thai', price: 2, rating: 4.4, reviews: 990, area: 'williamsburg', street: '510 Metropolitan Ave', blurb: 'Crispy rice salad and khao soi worth the trip.', tags: ['Spicy'], providers: ['resy'] },
  { id: 'v-hanok', name: 'Hanok', cuisine: 'Korean', price: 4, rating: 4.9, reviews: 420, area: 'williamsburg', street: '18 Berry St', blurb: 'Modern Korean tasting menu. Twelve courses, worth every one.', tags: ['Tasting menu', 'Special occasion'], providers: ['resy'] },

  { id: 'v-garden-table', name: 'Garden Table', cuisine: 'American', price: 2, rating: 4.4, reviews: 1460, area: 'park-slope', street: '240 5th Ave', blurb: 'Seasonal plates and a heated garden, all year.', tags: ['Garden'], providers: ['opentable'] },
  { id: 'v-trattoria-bea', name: 'Trattoria Bea', cuisine: 'Italian', price: 2, rating: 4.5, reviews: 1810, area: 'park-slope', street: '77 7th Ave', blurb: 'Neighborhood favorite. Cacio e pepe done right.', tags: ['Cozy'], providers: ['opentable', 'resy'] },
  { id: 'v-masala-club', name: 'Masala Club', cuisine: 'Indian', price: 3, rating: 4.6, reviews: 870, area: 'park-slope', street: '153 5th Ave', blurb: 'Modern Indian small plates and a gin cocktail list.', tags: ['Cocktails'], providers: ['resy'] },
  { id: 'v-aegean', name: 'Aegean', cuisine: 'Mediterranean', price: 3, rating: 4.5, reviews: 1120, area: 'park-slope', street: '400 7th Ave', blurb: 'Whole grilled fish, lemon potatoes, Greek wines.', tags: ['Seafood'], providers: ['opentable'] },

  { id: 'v-the-banquette', name: 'The Banquette', cuisine: 'French', price: 4, rating: 4.6, reviews: 2380, area: 'midtown', street: '58 W 52nd St', blurb: 'Grand brasserie, red leather, seafood towers.', tags: ['Classic', 'Special occasion'], providers: ['opentable', 'resy'] },
  { id: 'v-sushi-hoshi', name: 'Sushi Hoshi', cuisine: 'Japanese', price: 3, rating: 4.5, reviews: 1290, area: 'midtown', street: '233 E 48th St', blurb: 'Quiet sushi bar hidden above a bookstore.', tags: ['Hidden gem'], providers: ['resy'] },
  { id: 'v-golden-wok', name: 'Golden Wok', cuisine: 'Chinese', price: 2, rating: 4.3, reviews: 3410, area: 'midtown', street: '12 W 32nd St', blurb: 'Peking duck carved tableside. Big portions.', tags: ['Shareable'], providers: ['opentable'] },
  { id: 'v-steak-and-rye', name: 'Steak & Rye', cuisine: 'American', price: 4, rating: 4.4, reviews: 2760, area: 'midtown', street: '115 W 44th St', blurb: 'Dry-aged steaks and a whiskey cart. Pre-theater friendly.', tags: ['Steakhouse'], providers: ['opentable'] },

  { id: 'v-corner-supper', name: 'Corner Supper Club', cuisine: 'American', price: 2, rating: 4.6, reviews: 2140, area: 'harlem', street: '328 Lenox Ave', blurb: 'Fried chicken, live jazz on weekends, warm service.', tags: ['Live music'], providers: ['resy', 'opentable'] },
  { id: 'v-addis', name: 'Addis Garden', cuisine: 'Mediterranean', price: 2, rating: 4.5, reviews: 760, area: 'harlem', street: '2150 Frederick Douglass Blvd', blurb: 'Shared platters made for eating with your hands.', tags: ['Shareable'], providers: ['resy'] },
  { id: 'v-bangkok-lane', name: 'Bangkok Lane', cuisine: 'Thai', price: 1, rating: 4.4, reviews: 1050, area: 'harlem', street: '2310 Adam Clayton Powell Jr Blvd', blurb: 'Street-food menu, tiny room, huge flavors.', tags: ['Casual'], providers: ['opentable'] },
];

export interface SeedFilm {
  id: string;
  title: string;
  year: number;
  director: string;
  runtime: number;
  genres: string[];
  rating: number; // Letterboxd-style 0–5
  logline: string;
}

export const FILMS: SeedFilm[] = [
  { id: 'f-paper-lanterns', title: 'Paper Lanterns', year: 2026, director: 'Mina Sato', runtime: 118, genres: ['Romance', 'Drama'], rating: 4.1, logline: 'Two translators fall for each other one subtitle at a time.' },
  { id: 'f-the-long-quiet', title: 'The Long Quiet', year: 2026, director: 'Idris Vale', runtime: 134, genres: ['Sci-Fi', 'Drama'], rating: 4.3, logline: 'A lighthouse keeper on Europa hears something answer back.' },
  { id: 'f-small-hours', title: 'Small Hours', year: 2026, director: 'Rosa Lindqvist', runtime: 97, genres: ['Thriller'], rating: 3.8, logline: 'A night-shift pharmacist fills one prescription too many.' },
  { id: 'f-best-man-down', title: 'Best Man Down', year: 2026, director: 'Theo Park', runtime: 104, genres: ['Comedy', 'Romance'], rating: 3.6, logline: 'The best man loses the groom forty hours before the wedding.' },
  { id: 'f-hollow-pines', title: 'Hollow Pines', year: 2026, director: 'June Okafor', runtime: 101, genres: ['Horror'], rating: 3.7, logline: 'A cabin weekend, a missing trail, and a radio that will not stop.' },
  { id: 'f-mothbeam', title: 'Mothbeam', year: 2026, director: 'Studio Kite', runtime: 92, genres: ['Animation', 'Comedy'], rating: 4.0, logline: 'A moth who is afraid of the light starts a band.' },
  { id: 'f-salt-and-iron', title: 'Salt and Iron', year: 2026, director: 'Mateo Ruiz', runtime: 146, genres: ['Drama'], rating: 4.4, logline: 'Three generations of a fishing family and one last season.' },
  { id: 'f-overclock', title: 'Overclock', year: 2026, director: 'Ava Brenner', runtime: 126, genres: ['Sci-Fi', 'Thriller'], rating: 3.9, logline: 'A heist inside a stock exchange that runs at the speed of light.' },
  { id: 'f-borrowed-summer', title: 'Borrowed Summer', year: 2025, director: 'Clémence Aubry', runtime: 109, genres: ['Romance', 'Comedy'], rating: 3.9, logline: 'House-sitters in Marseille pretend to be the owners. It goes great, until it does not.' },
  { id: 'f-the-cartographers', title: 'The Cartographers', year: 2026, director: 'Nell Haddad', runtime: 88, genres: ['Documentary'], rating: 4.2, logline: 'The last people drawing maps by hand, and why they will not stop.' },
  { id: 'f-red-line', title: 'Red Line', year: 2026, director: 'Kofi Mensah', runtime: 115, genres: ['Thriller', 'Drama'], rating: 4.0, logline: 'A subway conductor gets a call from the train behind her.' },
  { id: 'f-glasshouse', title: 'Glasshouse', year: 2026, director: 'Leila Moradi', runtime: 122, genres: ['Drama', 'Romance'], rating: 4.5, logline: 'An architect and her ex rebuild the house they designed together.' },
  { id: 'f-very-good-dog', title: 'A Very Good Dog', year: 2026, director: 'Sam Hollis', runtime: 95, genres: ['Comedy', 'Animation'], rating: 3.5, logline: 'A dog runs for mayor. Polls are encouraging.' },
  { id: 'f-night-swimmers', title: 'Night Swimmers', year: 2026, director: 'Priya Raman', runtime: 112, genres: ['Horror', 'Thriller'], rating: 3.8, logline: 'The lake only lets you leave if you bring someone back.' },
];

export interface SeedTheater {
  id: string;
  name: string;
  area: string;
  street: string;
  formats: string[];
  provider: 'atom' | 'fandango';
}

export const THEATERS: SeedTheater[] = [
  { id: 't-roxy-hall', name: 'Roxy Hall Cinema', area: 'west-village', street: '30 Varick St', formats: ['Standard', '35mm'], provider: 'atom' },
  { id: 't-delancey-picture', name: 'Delancey Picture House', area: 'lower-east-side', street: '181 Delancey St', formats: ['Standard', 'Dolby'], provider: 'fandango' },
  { id: 't-northside', name: 'Northside Screens', area: 'williamsburg', street: '136 Metropolitan Ave', formats: ['Standard', 'Dolby'], provider: 'atom' },
  { id: 't-grand-42', name: 'Grand 42 IMAX', area: 'midtown', street: '234 W 42nd St', formats: ['Standard', 'IMAX', 'Dolby'], provider: 'fandango' },
  { id: 't-lenox-picture', name: 'Lenox Picture House', area: 'harlem', street: '2245 Adam Clayton Powell Jr Blvd', formats: ['Standard', 'Dolby'], provider: 'fandango' },
  { id: 't-slope-cinema', name: 'Slope Cinema', area: 'park-slope', street: '445 Fifth Ave', formats: ['Standard'], provider: 'atom' },
];
