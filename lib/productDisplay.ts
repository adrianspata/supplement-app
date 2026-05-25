import { ProductIngredient } from './types';

// Format Product Name
export function formatProductName(name?: string | null): string | null {
  if (!name) return null;
  let clean = name.replace(/I\.U\.?/gi, 'IU').trim();
  
  // If ALL CAPS, apply Title Case
  if (clean.length > 2 && clean === clean.toUpperCase()) {
    clean = clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  
  return clean;
}

// Format Brand Name
export function formatBrandName(brand?: string | null): string | null {
  if (!brand) return null;
  let clean = brand.trim();
  
  // If ALL CAPS, apply Title Case
  if (clean.length > 2 && clean === clean.toUpperCase()) {
    clean = clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  
  return clean;
}

// Format Category
export function formatCategory(category?: string | null): string | null {
  if (!category) return null;

  // Split by comma in case of multiple categories
  const parts = category.split(',').map(p => p.trim());

  // Clean each part
  const cleaned = parts.map(p => {
    // Remove language prefix like "en:" or "fr:"
    let s = p.replace(/^[a-z]{2,3}:/, '');
    // Replace hyphens and underscores with spaces
    s = s.replace(/[-_]/g, ' ');

    // Title Case
    return s
      .split(' ')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  });

  // Filter out extremely generic categories
  const generic = [
    'Dietary Supplements', 'Supplements', 'Food Supplements',
    'Plant Based Foods', 'Plant Based Foods And Beverages',
    'Beverages', 'Foods', 'Products', 'Groceries'
  ];

  const specific = cleaned.filter(c => !generic.includes(c));

  // Pick the most specific one (usually the last valid one)
  const chosen = specific.length > 0 ? specific[specific.length - 1] : cleaned[cleaned.length - 1];

  if (!chosen || chosen.length < 2) return null;
  return chosen;
}

// Format Goal Label
export function formatGoalLabel(goal?: string | null): string | null {
  if (!goal) return null;
  const mapped: Record<string, string> = {
    'sleep': 'Sleep',
    'stress': 'Stress',
    'recovery': 'Recovery',
    'immunity': 'Immunity',
    'bone_health': 'Bone Health',
    'heart_health': 'Heart Health',
    'brain_health': 'Brain Health',
    'gut_health': 'Gut Health',
    'hair': 'Hair',
    'skin': 'Skin',
    'focus': 'Focus',
    'energy': 'Energy',
    'hormones': 'Hormone Support',
    'joints': 'Joint Health',
  };
  
  const key = goal.toLowerCase().trim();
  if (mapped[key]) return mapped[key];
  
  // Fallback: replace underscores and Title Case
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Format Quality Attribute
export function formatQualityAttribute(attribute?: string | null): string | null {
  if (!attribute) return null;
  const mapped: Record<string, string> = {
    'third_party_tested': 'Third-party Tested',
    'gluten_free': 'Gluten Free',
    'non_gmo': 'Non-GMO',
    'dairy_free': 'Dairy Free',
    'vegan': 'Vegan',
    'organic': 'Organic',
  };
  
  const key = attribute.toLowerCase().trim();
  if (mapped[key]) return mapped[key];
  
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Format Ingredient Name
export function formatIngredientName(name?: string | null): string | null {
  if (!name) return null;
  let clean = name.trim();
  if (clean === clean.toUpperCase() && clean.length > 2) {
    clean = clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  return clean;
}

// Format Ingredient List
export function formatIngredientList(ingredients?: ProductIngredient[] | null): string | null {
  if (!ingredients || ingredients.length === 0) return null;
  
  const names = ingredients
    .map(i => formatIngredientName(i.ingredient?.name))
    .filter(Boolean);
  
  if (names.length === 0) return null;
  return names.join(', ');
}

// Check if a field should be displayed
export function shouldDisplayField(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

// Fallback for Product Image
export function getProductImageFallback(imageUrl?: string | null): string | null {
  return imageUrl && imageUrl.trim() !== '' ? imageUrl : null;
}
