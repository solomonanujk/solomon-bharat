/**
 * Indian craft category tree (3 levels), modelled on iTokri's craft-led navigation and
 * Amazon's Handicrafts browse tree. Level-3 names are unique across the whole tree so a
 * product can be matched to its category by name alone.
 */
export const CRAFT_CATEGORY_TREE: Record<string, Record<string, string[]>> = {
  'Home Décor': {
    'Wall Décor': ['Wall Hangings', 'Wall Plates', 'Folk Paintings', 'Mirrors', 'Wall Shelves'],
    'Decorative Accents': ['Vases', 'Figurines & Idols', 'Decorative Boxes', 'Showpieces', 'Bells & Chimes'],
    Lighting: ['Pendant Lights', 'Table Lamps', 'Candle Holders', 'Lanterns', 'Diyas'],
    'Garden & Planters': ['Planters', 'Planter Stands', 'Bird Feeders'],
  },
  'Home Textiles': {
    'Living Room': ['Cushion Covers', 'Throws', 'Rugs & Durries', 'Curtains'],
    Bedroom: ['Bedsheets', 'Quilts & Razais', 'Bed Throws', 'Bedcovers'],
    'Table Linen': ['Table Runners', 'Table Covers', 'Napkins', 'Placemats'],
    Bath: ['Towels', 'Bathrobes'],
  },
  'Kitchen & Dining': {
    Cookware: ['Kadhai', 'Tawa', 'Handi', 'Sauce Pans'],
    Serveware: ['Serving Bowls', 'Platters', 'Trays', 'Condiment Sets'],
    Dinnerware: ['Dinner Plates', 'Bowls', 'Mugs & Cups', 'Tea Sets'],
    Drinkware: ['Glasses & Tumblers', 'Jugs & Carafes'],
  },
  'Pottery & Ceramics': {
    'Blue Pottery': ['Blue Pottery Vases', 'Blue Pottery Plates', 'Blue Pottery Knobs'],
    Terracotta: ['Terracotta Pots', 'Terracotta Figurines'],
    Stoneware: ['Stoneware Dinner Sets', 'Decorative Plates'],
  },
  'Metal Crafts': {
    Brass: ['Brass Idols', 'Brass Utensils', 'Brass Décor'],
    Copper: ['Copper Bottles', 'Copper Utensils'],
    'Bidri & Dhokra': ['Bidri Ware', 'Dhokra Art'],
  },
  'Wood Crafts': {
    'Carved Wood': ['Wooden Boxes', 'Wooden Figurines', 'Wooden Panels'],
    'Wooden Kitchen': ['Chopping Boards', 'Wooden Spoons & Ladles', 'Wooden Bowls'],
    'Traditional Toys': ['Channapatna Toys', 'Kondapalli Toys', 'Wooden Puzzles'],
  },
  Furniture: {
    Seating: ['Chairs', 'Stools', 'Floor Cushions', 'Ottomans'],
    Tables: ['Coffee Tables', 'Side Tables', 'Console Tables'],
    Storage: ['Shelves', 'Cabinets', 'Chests & Trunks'],
  },
  'Baskets & Natural Fibres': {
    Baskets: ['Storage Baskets', 'Laundry Baskets', 'Gift Baskets'],
    'Jute & Sabai Grass': ['Jute Bags', 'Floor Mats', 'Storage Boxes'],
    'Cane & Bamboo': ['Cane Furniture', 'Bamboo Décor'],
  },
  'Fashion & Apparel': {
    Sarees: ['Handloom Sarees', 'Silk Sarees', 'Cotton Sarees'],
    'Stoles & Shawls': ['Stoles', 'Shawls', 'Dupattas'],
    Clothing: ['Kurtas', 'Kaftans', 'Jackets'],
  },
  Jewellery: {
    'Handcrafted Jewellery': ['Necklaces', 'Earrings', 'Bangles', 'Rings', 'Anklets'],
    'Tribal & Oxidised': ['Oxidised Jewellery', 'Tribal Jewellery'],
  },
  'Bags & Accessories': {
    Bags: ['Tote Bags', 'Clutches', 'Potli Bags', 'Sling Bags'],
    Footwear: ['Juttis & Mojaris', 'Kolhapuri Chappals'],
    'Small Accessories': ['Wallets & Pouches', 'Hair Accessories'],
  },
  'Stationery & Paper': {
    'Handmade Paper': ['Notebooks & Journals', 'Gift Wrap', 'Greeting Cards'],
  },
  'Wellness & Spiritual': {
    'Pooja Essentials': ['Pooja Thalis', 'Incense Holders', 'Prayer Accessories'],
    Wellness: ['Yoga Mats', 'Natural Soaps', 'Essential Oils'],
  },
  Gifting: {
    Festive: ['Diwali Sets', 'Christmas Décor', 'Wedding Favours'],
    Corporate: ['Corporate Gifts', 'Gift Hampers'],
  },
};
