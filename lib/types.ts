// ─── Database Types ────────────────────────────────────────────────────────

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  onboarding_completed?: boolean | null;
  created_at: string;
  updated_at: string;
};

export type PrimaryGoal =
  | 'energy'
  | 'sleep'
  | 'stress'
  | 'focus'
  | 'immune'
  | 'longevity'
  | 'hormonal'
  | 'athletic'
  | 'general_wellness'
  | 'weight_management';

export type DietType =
  | 'omnivore'
  | 'vegetarian'
  | 'vegan'
  | 'pescatarian'
  | 'other';

export type Sex = 'male' | 'female' | 'other';

export type ReminderTime = 'morning' | 'afternoon' | 'evening' | 'multiple';

export type HealthKnowledgeLevel = 'beginner' | 'intermediate' | 'advanced';

export type HealthSelfAssessment = number;

export type UserPreferences = {
  id: string;
  user_id: string;
  // Goals (multi-select array)
  primary_goals: PrimaryGoal[] | null;
  /** @deprecated use primary_goals instead */
  primary_goal: PrimaryGoal | null;
  health_score_self_assessment: HealthSelfAssessment | null;
  // Biological info
  age: number | null;
  age_range: string | null;
  sex: Sex | null;
  height_cm: number | null;
  weight_kg: number | null;
  // Diet
  diet_type: DietType | null;
  // Supplements & health
  current_supplements: string[] | null;
  /** @deprecated use current_supplements instead */
  existing_supplements: string[] | null;
  health_concerns: string[] | null;
  allergies: string[] | null;
  // Preferences
  reminder_time: ReminderTime | null;
  health_knowledge_level: HealthKnowledgeLevel | null;
  
  // New onboarding survey fields
  exercise_frequency: string | null;
  sleep_duration: string | null;
  stress_level: number | null;
  supplement_knowledge_level: string | null;
  purchase_drivers: string[] | null;
  purchase_frequency: string | null;

  // Meta
  completed_onboarding: boolean;
  created_at: string;
  updated_at: string;
};

export type CabinetItem = {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  expiry_date: string | null; // ISO date string YYYY-MM-DD
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// Used when inserting / updating cabinet items (omit server-generated fields)
export type CabinetItemInput = Omit<CabinetItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

// Legacy alias for backward compat with pantry_items table name
export type PantryItem = CabinetItem;
export type PantryItemInput = CabinetItemInput;

export type Brand = {
  id: string;
  name: string;
  created_at: string;
};

export type Ingredient = {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
};

export type ProductIngredient = {
  id: string;
  product_id: string;
  ingredient_id: string;
  amount: number | null;
  unit: string | null;
  form?: string | null;
  created_at: string;
  // joined
  ingredient?: Ingredient;
};

export type ProductGoal = {
  id: string;
  product_id: string;
  goal: string;
  created_at: string;
};

export type ProductQualityAttribute = {
  id: string;
  product_id: string;
  attribute: string;
  created_at: string;
};

export type Product = {
  id: string;
  external_id: string | null;
  barcode: string | null;
  name: string | null;
  brand: string | null;
  brand_id?: string | null;
  image_url: string | null;
  category: string | null;
  source: string | null;
  raw_data: any | null;
  created_at: string;
  
  // new fields from ingestion schema
  product_url?: string | null;
  serving_size?: string | null;
  servings_per_container?: number | null;
  ingredients_text?: string | null;
  vegan?: boolean | null;
  gluten_free?: boolean | null;
  dairy_free?: boolean | null;
  claims?: string[] | null;
  data_quality_score?: number | null;
  verified_status?: string | null;
  supplement_facts?: any | null;

  // joined fields
  brands?: Brand | null;
  product_ingredients?: ProductIngredient[];
  product_goals?: ProductGoal[];
  product_quality_attributes?: ProductQualityAttribute[];
  inferred_goals?: string[];
};

export type UserSavedProduct = {
  id: string;
  user_id: string;
  product_id: string;
  status: string | null;
  created_at: string;
  // joined fields when querying
  product?: Product;
};

export type RecentlyViewedProduct = {
  id: string;
  user_id: string;
  product_id: string;
  viewed_at: string;
  // joined fields when querying
  product?: Product;
};

export type StackTiming = 'morning' | 'afternoon' | 'evening' | 'as_needed';

export type UserStackItem = {
  id: string;
  user_id: string;
  product_id: string;
  timing: StackTiming;
  dosage: string | null;
  frequency: string | null;
  notes: string | null;
  created_at: string;
  // joined fields when querying
  product?: Product;
};

export type DailyProtocolLog = {
  id: string;
  user_id: string;
  stack_item_id: string;
  product_id: string;
  taken_at: string | null;
  scheduled_for: string;
  status: 'pending' | 'taken' | 'skipped' | 'missed';
  notes: string | null;
  created_at: string;
};

export type TodayProtocolItem = UserStackItem & {
  status: 'pending' | 'taken' | 'skipped' | 'missed';
  taken_at: string | null;
  log_id?: string;
};

export type ExternalProduct = {
  id: string;
  code?: string;
  product_name?: string;
  brands?: string;
  image_url?: string;
  categories?: string;
  categories_tags?: string[];
  nutriments?: any;
  ingredients_text?: string;
};

export type DailyStackLog = {
  id: string;
  user_id: string;
  stack_item_id: string;
  product_id: string;
  log_date: string;
  taken: boolean;
  taken_at: string | null;
  created_at: string;
};

export type RecommendedProduct = {
  product: Product;
  score: number;
  reason?: string;
};

export type DailyCheckIn = {
  id: string;
  user_id: string;
  checkin_date: string;
  sleep_score: number | null;
  energy_score: number | null;
  stress_score: number | null;
  created_at: string;
  updated_at: string;
};
