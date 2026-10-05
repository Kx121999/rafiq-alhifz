// What the star shop sells. Nothing here is religious text: friends (cartoon characters), pastel page colours and name frames.
// Prices are in game stars. The ids are what is saved on a child (field shop), so never rename one.
export const SHOP = [
  { id: 'qamar', type: 'friend', name: 'قمر', price: 50, char: 'qamar' },
  { id: 'fanous', type: 'friend', name: 'فانوس', price: 80, char: 'fanous' },
  { id: 'warda', type: 'friend', name: 'وردة', price: 120, char: 'warda' },
  { id: 'lilac', type: 'theme', name: 'بنفسجي هادئ', price: 40, swatch: ['#e6dcff', '#fdf4ff'] },
  { id: 'mint', type: 'theme', name: 'نعناع', price: 40, swatch: ['#d4f5e6', '#f4fff0'] },
  { id: 'peach', type: 'theme', name: 'خوخ', price: 40, swatch: ['#ffe3d6', '#fff6e5'] },
  { id: 'rose', type: 'theme', name: 'وردي', price: 40, swatch: ['#ffd9ea', '#fff0f6'] },
  { id: 'gold', type: 'frame', name: 'إطار ذهبي', price: 60 },
  { id: 'rainbow', type: 'frame', name: 'إطار قوس قزح', price: 100 },
];
export const itemOf = id => SHOP.find(i => i.id === id) || null;
export const EXTRA_FRIENDS = SHOP.filter(i => i.type === 'friend').map(i => ({ id: i.id, name: i.name, char: i.char }));
