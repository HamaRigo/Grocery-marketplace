import {
  Store,
  ShoppingBasket,
  Milk,
  Beef,
  Croissant,
  Pill,
  Coffee,
  Apple,
  Fish,
  type LucideIcon,
} from 'lucide-react'

export type StoreCategory =
  | 'supermarket'
  | 'convenience'
  | 'bakery'
  | 'dairy'
  | 'butcher'
  | 'pharmacy'
  | 'cafe'
  | 'produce'
  | 'seafood'

export const STORE_CATEGORIES: { id: StoreCategory; label: string; Icon: LucideIcon }[] = [
  { id: 'supermarket', label: 'Supermarket', Icon: Store },
  { id: 'convenience', label: 'Convenience', Icon: ShoppingBasket },
  { id: 'bakery', label: 'Bakery', Icon: Croissant },
  { id: 'dairy', label: 'Dairy', Icon: Milk },
  { id: 'butcher', label: 'Butcher', Icon: Beef },
  { id: 'pharmacy', label: 'Pharmacy', Icon: Pill },
  { id: 'cafe', label: 'Café', Icon: Coffee },
  { id: 'produce', label: 'Produce', Icon: Apple },
  { id: 'seafood', label: 'Seafood', Icon: Fish },
]

const KEYWORDS: Record<StoreCategory, string[]> = {
  supermarket: ['super', 'market', 'grocery', 'mart', 'hyper'],
  convenience: ['convenience', 'mini', 'corner', 'express', '24'],
  bakery: ['bakery', 'bake', 'bread', 'patisserie', 'croissant'],
  dairy: ['dairy', 'milk', 'cheese', 'yogurt'],
  butcher: ['butcher', 'meat', 'beef', 'lamb'],
  pharmacy: ['pharma', 'drug', 'chemist', 'health'],
  cafe: ['cafe', 'café', 'coffee'],
  produce: ['produce', 'fruit', 'veg', 'farm', 'fresh'],
  seafood: ['seafood', 'fish', 'ocean'],
}

export function inferStoreCategory(name: string): StoreCategory {
  const lower = name.toLowerCase()
  for (const [cat, words] of Object.entries(KEYWORDS) as [StoreCategory, string[]][]) {
    if (words.some(w => lower.includes(w))) return cat
  }
  return 'supermarket'
}

export function getCategoryMeta(category: StoreCategory) {
  return STORE_CATEGORIES.find(c => c.id === category) ?? STORE_CATEGORIES[0]
}
