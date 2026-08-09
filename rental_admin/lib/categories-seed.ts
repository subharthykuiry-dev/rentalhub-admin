/**
 * CANONICAL RENTAL CATEGORIES — admin-owned.
 *
 * Broad storefront sections, deliberately kept few. These mirror the homepage
 * bento grid in the user app; the user app itself holds no copy of this list —
 * it reads categories from the database via GET /api/categories.
 *
 * Slugs are stable: the storefront links to /products?category=<slug>, so
 * renaming a slug breaks existing links. Change `name` freely, `slug` rarely.
 */

export interface SeedCategory {
  name: string;
  slug: string;
  description: string;
  /** Keyword that steers the storefront's icon matching. */
  icon: string;
  image: string;
}

export const RENTAL_CATEGORIES: SeedCategory[] = [
  {
    name: 'Photography & Cinema',
    slug: 'photography',
    description: 'Pro camera bodies, prime lenses, gimbals & studio lighting',
    icon: 'camera',
    image:
      'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800&auto=format&fit=crop',
  },
  {
    name: 'Outdoor & Trekking',
    slug: 'outdoor',
    description: 'All-weather tents, sleeping bags, backpacks & stoves',
    icon: 'outdoor camping',
    image:
      'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&auto=format&fit=crop',
  },
  {
    name: 'Gaming & Entertainment',
    slug: 'gaming',
    description: 'PS5 consoles, Meta Quest VR kits, 4K projectors & speakers',
    icon: 'gaming',
    image:
      'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&auto=format&fit=crop',
  },
  {
    name: 'Workstation Kits',
    slug: 'workstations',
    description: 'MacBook Pros, 4K color-accurate monitors & remote rigs',
    icon: 'workstation laptop',
    image:
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop',
  },
  {
    name: 'E-Bikes & Travel',
    slug: 'e-bikes-travel',
    description: 'Electric bikes, scooters, luggage & city travel kit',
    icon: 'bike travel',
    image:
      'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=800&auto=format&fit=crop',
  },
];

export default RENTAL_CATEGORIES;
