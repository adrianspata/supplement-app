import { useRouter } from "expo-router";
import { useState, useMemo } from "react";
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { normalizeGoal } from "../lib/matching";
import type { PrimaryGoal, DietType, Sex, ReminderTime, HealthKnowledgeLevel, HealthSelfAssessment } from "../lib/types";
import * as StoreReview from 'expo-store-review';
import { Image } from 'expo-image';

// ─── Constants ────────────────────────────────────────────────────────────────

const GOALS: { value: PrimaryGoal; label: string; emoji: string }[] = [
  { value: 'energy',            label: 'Better Energy',          emoji: '⚡️' },
  { value: 'sleep',             label: 'Better Sleep',           emoji: '🌙' },
  { value: 'stress',            label: 'Stress Management',      emoji: '🧘' },
  { value: 'focus',             label: 'Focus & Productivity',   emoji: '🧠' },
  { value: 'immune',            label: 'Immune Support',         emoji: '🛡️' },
  { value: 'longevity',         label: 'Longevity',              emoji: '🌿' },
  { value: 'hormonal',          label: 'Hormonal Balance',       emoji: '⚖️' },
  { value: 'athletic',          label: 'Athletic Performance',   emoji: '💪' },
  { value: 'general_wellness',  label: 'General Wellness',       emoji: '✨' },
  { value: 'weight_management', label: 'Weight Management',      emoji: '📊' },
];

const HEALTH_SCORES: { value: HealthSelfAssessment; label: string; emoji: string }[] = [
  { value: 4, label: 'Excellent', emoji: '🌟' },
  { value: 3, label: 'Good', emoji: '😊' },
  { value: 2, label: 'Average', emoji: '😐' },
  { value: 1, label: 'Poor', emoji: '😫' },
];

const DIET_TYPES: { value: DietType; label: string; desc: string }[] = [
  { value: 'omnivore',    label: 'Omnivore', desc: 'Eats both plant and animal foods' },
  { value: 'vegetarian',  label: 'Vegetarian', desc: 'Avoids meat but may consume dairy and eggs' },
  { value: 'vegan',       label: 'Vegan', desc: 'Avoids all animal-derived products' },
  { value: 'pescatarian', label: 'Pescatarian', desc: 'Eats fish but avoids other meats' },
  { value: 'other',       label: 'Other', desc: 'A custom dietary approach' },
];

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male',   label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other',  label: 'Other' },
];

const EXISTING_SUPPLEMENTS = [
  'Multivitamin', 'Vitamin D', 'Magnesium', 'Omega 3', 'Iron',
  'Zinc', 'Creatine', 'Protein Powder', 'Ashwagandha', 'Probiotics'
];

const HEALTH_CONCERNS = [
  'Fatigue', 'Poor Sleep', 'Stress', 'Brain Fog',
  'Low Recovery', 'Digestive Issues', 'Low Mood', 'Frequent Illness', 'Hormonal imbalance', 'Joint pain', 'Migraines', 'Skin issues', 'Low libido'
];

const REMINDER_OPTIONS: { value: ReminderTime; label: string; emoji: string }[] = [
  { value: 'morning',   label: 'Morning',       emoji: '🌅' },
  { value: 'afternoon', label: 'Afternoon',     emoji: '☀️' },
  { value: 'evening',   label: 'Evening',       emoji: '🌆' },
  { value: 'multiple',  label: 'Multiple Times', emoji: '🔔' },
];

const KNOWLEDGE_LEVELS: { value: HealthKnowledgeLevel; label: string; desc: string }[] = [
  { value: 'beginner',     label: '🌱  Beginner',     desc: 'Just starting my wellness journey' },
  { value: 'intermediate', label: '📚  Intermediate', desc: 'Know the basics, want to go deeper' },
  { value: 'advanced',     label: '🔬  Advanced',     desc: 'Deep knowledge of supplements & health' },
];

type StepType = 'welcome' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 'success' | 'rating';

const TOTAL_NUMBERED_STEPS = 9;

// ─── Component ────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const router = useRouter();
  const { setOnboardingCompleted, refreshUserData } = useAuth();

  const [step, setStep] = useState<StepType>('welcome');
  const [loading, setLoading] = useState(false);

  // Step 1 — Goals (multi)
  const [goals, setGoals] = useState<PrimaryGoal[]>([]);

  // Step 2 - Health Self Assessment
  const [healthScore, setHealthScore] = useState<HealthSelfAssessment | null>(null);

  // Step 3 — Bio
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  // Step 4 — Diet
  const [dietType, setDietType] = useState<DietType | null>(null);

  // Step 5 — Existing supplements (multi-select + custom)
  const [existingSupplements, setExistingSupplements] = useState<string[]>([]);
  const [supplementSearch, setSupplementSearch] = useState('');
  const [customSupplementInput, setCustomSupplementInput] = useState('');
  const [customSupplements, setCustomSupplements] = useState<string[]>([]);

  // Step 6 — Health concerns (multi-select + custom)
  const [healthConcerns, setHealthConcerns] = useState<string[]>([]);
  const [customConcernInput, setCustomConcernInput] = useState('');
  const [customConcerns, setCustomConcerns] = useState<string[]>([]);

  // Step 7 — Allergies
  const [allergyInput, setAllergyInput] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);

  // Step 8 — Reminder time
  const [reminderTime, setReminderTime] = useState<ReminderTime | null>(null);

  // Step 9 — Knowledge level
  const [knowledgeLevel, setKnowledgeLevel] = useState<HealthKnowledgeLevel | null>(null);

  // ── Helpers ──
  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    if (item === 'None') {
      setList(list.includes('None') ? [] : ['None']);
      return;
    }
    const withoutNone = list.filter(i => i !== 'None');
    setList(withoutNone.includes(item)
      ? withoutNone.filter(i => i !== item)
      : [...withoutNone, item]);
  };

  const addCustomSupplement = () => {
    const trimmed = customSupplementInput.trim();
    if (trimmed && !customSupplements.includes(trimmed) && !EXISTING_SUPPLEMENTS.includes(trimmed)) {
      setCustomSupplements([...customSupplements, trimmed]);
      setExistingSupplements([...existingSupplements, trimmed]);
    }
    setCustomSupplementInput('');
  };

  const addCustomConcern = () => {
    const trimmed = customConcernInput.trim();
    if (trimmed && !customConcerns.includes(trimmed) && !HEALTH_CONCERNS.includes(trimmed)) {
      setCustomConcerns([...customConcerns, trimmed]);
      setHealthConcerns([...healthConcerns, trimmed]);
    }
    setCustomConcernInput('');
  };

  const addAllergy = () => {
    const trimmed = allergyInput.trim();
    if (trimmed && !allergies.includes(trimmed)) setAllergies([...allergies, trimmed]);
    setAllergyInput('');
  };
  const removeAllergy = (tag: string) => setAllergies(allergies.filter(a => a !== tag));

  // ── Validation ──
  const isStepValid = () => {
    if (step === 'welcome') return true;
    if (step === 1) return goals.length > 0;
    if (step === 2) return healthScore !== null;
    if (step === 3) return age !== '' && sex !== null;
    if (step === 4) return dietType !== null;
    if (step === 5) return true;
    if (step === 6) return true;
    if (step === 7) return true;
    if (step === 8) return reminderTime !== null;
    if (step === 9) return knowledgeLevel !== null;
    if (step === 'success') return true;
    if (step === 'rating') return true;
    return true;
  };

  const handleNext = () => {
    if (!isStepValid()) return;
    if (step === 'welcome') setStep(1);
    else if (typeof step === 'number' && step < 9) setStep((step + 1) as StepType);
    else if (step === 9) setStep('success');
    else if (step === 'success') setStep('rating');
  };

  const handleBack = () => {
    if (step === 1) setStep('welcome');
    else if (typeof step === 'number' && step > 1) setStep((step - 1) as StepType);
    else if (step === 'success') setStep(9);
    else if (step === 'rating') setStep('success');
  };

  const finishOnboarding = async () => {
    router.replace("/tabs/pantry");
  };

  // ── Submit ──
  const handleSaveData = async () => {
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("No logged-in user found");

      const { error } = await supabase.from('user_preferences').upsert(
        {
          user_id: user.id,
          primary_goals: goals.length > 0 ? goals.map(normalizeGoal) : null,
          health_score_self_assessment: healthScore,
          age: parseInt(age) || null,
          sex,
          height_cm: parseFloat(height) || null,
          weight_kg: parseFloat(weight) || null,
          diet_type: dietType,
          existing_supplements: existingSupplements.length > 0 ? existingSupplements : [],
          health_concerns: healthConcerns.length > 0 ? healthConcerns : [],
          allergies: allergies.length > 0 ? allergies : [],
          reminder_time: reminderTime,
          health_knowledge_level: knowledgeLevel,
          completed_onboarding: true,
        },
        { onConflict: 'user_id' }
      );

      if (error) throw error;
      
      const normalizedGoals = goals.length > 0 ? goals.map(normalizeGoal) : [];
      console.log("saved primary_goals", normalizedGoals);
      
      await refreshUserData();
      setOnboardingCompleted(true);
      handleNext(); // go to success screen
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not save preferences. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async () => {
    if (await StoreReview.hasAction()) {
      await StoreReview.requestReview();
    }
    finishOnboarding();
  };

  // ── Progress bar ──
  const renderProgressBar = () => {
    if (step === 'welcome' || step === 'success' || step === 'rating') return null;
    const currentStep = typeof step === 'number' ? step : 0;
    return (
      <View style={styles.headerRow}>
        <Pressable onPress={handleBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </Pressable>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${(currentStep / TOTAL_NUMBERED_STEPS) * 100}%` as any }]} />
        </View>
        <Text style={styles.stepCounter}>{currentStep}/{TOTAL_NUMBERED_STEPS}</Text>
      </View>
    );
  };

  const renderLogo = () => (
    <View style={styles.logoAnchor}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoIcon}>🧬</Text>
      </View>
    </View>
  );

  // ─── Steps ───────────────────────────────────────────────────────────────

  const renderWelcome = () => (
    <View style={[styles.stepContainer, styles.centeredStep]}>
      <Text style={styles.title}>Welcome to Elexir</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>Your personal supplement & wellness companion</Text>
      <Text style={styles.descText}>
        Discover and learn more about how to optimize your health, build better habits and create a personalized wellness routine.
      </Text>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>GOALS</Text>
      <Text style={styles.title}>What are your primary{'\n'}health goals?</Text>
      <Text style={styles.subtitle}>We’ll personalize your supplement guidance based on your goals. Select all that apply.</Text>
      <View style={styles.optionsList}>
        {GOALS.map(({ value, label, emoji }) => {
          const isActive = goals.includes(value);
          return (
            <Pressable
              key={value}
              style={[styles.listBtn, isActive && styles.listBtnActive]}
              onPress={() => toggleItem(goals as unknown as string[], setGoals as unknown as (v: string[]) => void, value as unknown as string)}
            >
              <Text style={[styles.listBtnEmoji]}>{emoji}</Text>
              <Text style={[styles.listBtnText, isActive && styles.listBtnTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>HEALTH CHECK</Text>
      <Text style={styles.title}>How would you describe{'\n'}your health today?</Text>
      <Text style={styles.subtitle}>This helps us understand your baseline and track improvements.</Text>
      <View style={styles.optionsList}>
        {HEALTH_SCORES.map(({ value, label, emoji }) => (
          <Pressable
            key={value}
            style={[styles.listBtn, healthScore === value && styles.listBtnActive]}
            onPress={() => setHealthScore(value)}
          >
            <Text style={[styles.listBtnEmoji]}>{emoji}</Text>
            <Text style={[styles.listBtnText, healthScore === value && styles.listBtnTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>BIOLOGICAL INFO</Text>
      <Text style={styles.title}>Tell us about{'\n'}yourself</Text>
      <Text style={styles.subtitle}>This helps us understand your baseline and tailor future insights.</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Age *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 28"
          placeholderTextColor="#8E8E93"
          value={age}
          onChangeText={setAge}
          keyboardType="number-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Sex *</Text>
        <View style={styles.chipContainer}>
          {SEX_OPTIONS.map(({ value, label }) => (
            <Pressable
              key={value}
              style={[styles.chip, sex === value && styles.chipActive]}
              onPress={() => setSex(value)}
            >
              <Text style={[styles.chipText, sex === value && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.formRow}>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>Height (cm) <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 175"
            placeholderTextColor="#8E8E93"
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>Weight (kg) <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 70"
            placeholderTextColor="#8E8E93"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>DIET</Text>
      <Text style={styles.title}>What's your diet{'\n'}type?</Text>
      <Text style={styles.subtitle}>Diet can influence common nutrient gaps and supplement needs.</Text>
      <View style={styles.optionsList}>
        {DIET_TYPES.map(({ value, label, desc }) => (
          <Pressable
            key={value}
            style={[styles.listBtn, dietType === value && styles.listBtnActive]}
            onPress={() => setDietType(value)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.listBtnText, dietType === value && styles.listBtnTextActive]}>{label}</Text>
              <Text style={[styles.listBtnDesc, dietType === value && styles.listBtnDescActive]}>{desc}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const filteredSupplements = useMemo(() => {
    return EXISTING_SUPPLEMENTS.filter(s => s.toLowerCase().includes(supplementSearch.toLowerCase()));
  }, [supplementSearch]);

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>CURRENT SUPPLEMENTS</Text>
      <Text style={styles.title}>What do you currently{'\n'}take?</Text>
      <Text style={styles.subtitle}>This helps us avoid duplicate recommendations.</Text>
      
      <TextInput
        style={[styles.input, { marginBottom: 16 }]}
        placeholder="Search supplements..."
        placeholderTextColor="#8E8E93"
        value={supplementSearch}
        onChangeText={setSupplementSearch}
      />

      <View style={styles.chipContainer}>
        {filteredSupplements.map((item) => (
          <Pressable
            key={item}
            style={[styles.chip, existingSupplements.includes(item) && styles.chipActive]}
            onPress={() => toggleItem(existingSupplements, setExistingSupplements, item)}
          >
            <Text style={[styles.chipText, existingSupplements.includes(item) && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
        {customSupplements.map((item) => (
          <Pressable
            key={item}
            style={[styles.chip, existingSupplements.includes(item) && styles.chipActive]}
            onPress={() => toggleItem(existingSupplements, setExistingSupplements, item)}
          >
            <Text style={[styles.chipText, existingSupplements.includes(item) && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { marginTop: 24 }]}>Add your own supplement</Text>
      <View style={styles.tagInputRow}>
        <TextInput
          style={styles.tagInput}
          placeholder="e.g. Rhodiola Rosea"
          placeholderTextColor="#8E8E93"
          value={customSupplementInput}
          onChangeText={setCustomSupplementInput}
          onSubmitEditing={addCustomSupplement}
          returnKeyType="done"
        />
        <Pressable style={styles.tagAddBtn} onPress={addCustomSupplement}>
          <Text style={styles.tagAddBtnText}>Add</Text>
        </Pressable>
      </View>

      <Text style={styles.optionalHint}>Optional — skip if you don't take anything yet</Text>
    </View>
  );

  const renderStep6 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>HEALTH CONCERNS</Text>
      <Text style={styles.title}>Any health concerns{'\n'}you want to address?</Text>
      <Text style={styles.subtitle}>We’ll use this to tailor future insights, reminders and recommendations.</Text>
      <View style={styles.chipContainer}>
        {HEALTH_CONCERNS.map((item) => (
          <Pressable
            key={item}
            style={[styles.chip, healthConcerns.includes(item) && styles.chipActive]}
            onPress={() => toggleItem(healthConcerns, setHealthConcerns, item)}
          >
            <Text style={[styles.chipText, healthConcerns.includes(item) && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
        {customConcerns.map((item) => (
          <Pressable
            key={item}
            style={[styles.chip, healthConcerns.includes(item) && styles.chipActive]}
            onPress={() => toggleItem(healthConcerns, setHealthConcerns, item)}
          >
            <Text style={[styles.chipText, healthConcerns.includes(item) && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { marginTop: 24 }]}>Add your own concern</Text>
      <View style={styles.tagInputRow}>
        <TextInput
          style={styles.tagInput}
          placeholder="e.g. Iron deficiency"
          placeholderTextColor="#8E8E93"
          value={customConcernInput}
          onChangeText={setCustomConcernInput}
          onSubmitEditing={addCustomConcern}
          returnKeyType="done"
        />
        <Pressable style={styles.tagAddBtn} onPress={addCustomConcern}>
          <Text style={styles.tagAddBtnText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderStep7 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>ALLERGIES & RESTRICTIONS</Text>
      <Text style={styles.title}>Any allergies or{'\n'}restrictions?</Text>
      <Text style={styles.subtitle}>We'll flag any supplements that may conflict with these.</Text>
      <View style={styles.tagInputRow}>
        <TextInput
          style={styles.tagInput}
          placeholder="e.g. shellfish, soy, gluten"
          placeholderTextColor="#8E8E93"
          value={allergyInput}
          onChangeText={setAllergyInput}
          onSubmitEditing={addAllergy}
          returnKeyType="done"
        />
        <Pressable style={styles.tagAddBtn} onPress={addAllergy}>
          <Text style={styles.tagAddBtnText}>Add</Text>
        </Pressable>
      </View>
      {allergies.length > 0 && (
        <View style={styles.tagList}>
          {allergies.map(tag => (
            <Pressable key={tag} style={styles.tag} onPress={() => removeAllergy(tag)}>
              <Text style={styles.tagText}>{tag} ✕</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Text style={styles.optionalHint}>Optional — leave blank if none</Text>
    </View>
  );

  const renderStep8 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>REMINDERS</Text>
      <Text style={styles.title}>When do you prefer{'\n'}to take supplements?</Text>
      <Text style={styles.subtitle}>We'll schedule your daily reminders around this.</Text>
      <View style={styles.optionsList}>
        {REMINDER_OPTIONS.map(({ value, label, emoji }) => (
          <Pressable
            key={value}
            style={[styles.listBtn, reminderTime === value && styles.listBtnActive]}
            onPress={() => setReminderTime(value)}
          >
            <Text style={styles.listBtnEmoji}>{emoji}</Text>
            <Text style={[styles.listBtnText, reminderTime === value && styles.listBtnTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderStep9 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>KNOWLEDGE LEVEL</Text>
      <Text style={styles.title}>How much do you know{'\n'}about supplements?</Text>
      <Text style={styles.subtitle}>This helps us calibrate how we explain recommendations to you.</Text>
      <View style={styles.optionsList}>
        {KNOWLEDGE_LEVELS.map(({ value, label, desc }) => (
          <Pressable
            key={value}
            style={[styles.listBtn, knowledgeLevel === value && styles.listBtnActive]}
            onPress={() => setKnowledgeLevel(value)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.listBtnText, knowledgeLevel === value && styles.listBtnTextActive]}>{label}</Text>
              <Text style={[styles.listBtnDesc, knowledgeLevel === value && styles.listBtnDescActive]}>{desc}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderSuccess = () => {
    const goalsList = goals.map(g => GOALS.find(x => x.value === g)?.label).filter(Boolean);
    return (
      <View style={[styles.stepContainer, styles.centeredStep]}>
        <View style={styles.successIcon}>
          <Text style={styles.successEmoji}>🧴</Text>
        </View>
        <Text style={[styles.title, { textAlign: 'center' }]}>Your wellness profile is ready.</Text>
        
        <View style={styles.summaryCard}>
          {goalsList.length > 0 && (
            <View style={styles.summarySection}>
              <Text style={styles.summaryLabel}>Goals:</Text>
              {goalsList.map(g => <Text key={g} style={styles.summaryText}>✓ {g}</Text>)}
            </View>
          )}
          {existingSupplements.length > 0 && (
            <View style={styles.summarySection}>
              <Text style={styles.summaryLabel}>Current Supplements:</Text>
              {existingSupplements.map(g => <Text key={g} style={styles.summaryText}>✓ {g}</Text>)}
            </View>
          )}
          {healthConcerns.length > 0 && (
            <View style={styles.summarySection}>
              <Text style={styles.summaryLabel}>Focus Areas:</Text>
              {healthConcerns.map(g => <Text key={g} style={styles.summaryText}>✓ {g}</Text>)}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderRating = () => (
    <View style={[styles.stepContainer, styles.centeredStep]}>
      <Text style={[styles.title, { textAlign: 'center' }]}>Enjoying Elexir?</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>
        Help us reach more people and continue improving the app by leaving a quick rating.
      </Text>
      
      <View style={{ width: '100%', gap: 16, marginTop: 32 }}>
        <Pressable style={styles.primaryBtn} onPress={handleRate}>
          <Text style={styles.primaryBtnText}>Rate Elexir</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={finishOnboarding}>
          <Text style={styles.secondaryBtnText}>Maybe Later</Text>
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={finishOnboarding}>
          <Text style={styles.ghostBtnText}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {renderLogo()}
        {renderProgressBar()}

        {/* Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'welcome' && renderWelcome()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
          {step === 6 && renderStep6()}
          {step === 7 && renderStep7()}
          {step === 8 && renderStep8()}
          {step === 9 && renderStep9()}
          {step === 'success' && renderSuccess()}
          {step === 'rating' && renderRating()}
        </ScrollView>

        {/* Footer CTA */}
        {step !== 'rating' && (
          <View style={styles.footer}>
            {step === 'welcome' ? (
              <Pressable style={styles.primaryBtn} onPress={handleNext}>
                <Text style={styles.primaryBtnText}>Get Started</Text>
              </Pressable>
            ) : typeof step === 'number' && step < 9 ? (
              <Pressable
                style={[styles.primaryBtn, !isStepValid() && styles.primaryBtnDisabled]}
                onPress={handleNext}
                disabled={!isStepValid()}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
              </Pressable>
            ) : step === 9 ? (
              <Pressable
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={handleSaveData}
                disabled={loading || !isStepValid()}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Complete Profile</Text>
                )}
              </Pressable>
            ) : step === 'success' ? (
              <Pressable style={styles.primaryBtn} onPress={handleNext}>
                <Text style={styles.primaryBtnText}>Enter Elexir</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF9F6' },
  logoAnchor: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EBEAE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: { fontSize: 20 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EBEAE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 18, color: '#1C1C1E' },
  progressContainer: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(0,0,0,0.07)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1C1C1E',
    borderRadius: 3,
  },
  stepCounter: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    minWidth: 28,
    textAlign: 'right',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  stepContainer: { flex: 1 },
  centeredStep: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
  },
  stepTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.8,
    marginBottom: 8,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    color: '#636366',
    lineHeight: 22,
    marginBottom: 28,
  },
  descText: {
    fontSize: 17,
    color: '#1C1C1E',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 20,
  },
  optionalHint: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  inputGroup: { marginBottom: 20 },
  formRow: { flexDirection: 'row', gap: 14 },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 10,
  },
  optional: { fontWeight: '400', color: '#8E8E93' },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    padding: 16,
    borderRadius: 14,
    fontSize: 17,
    color: '#1C1C1E',
  },
  // List buttons (single & multi select)
  optionsList: { gap: 10 },
  listBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    gap: 12,
  },
  listBtnActive: { backgroundColor: '#1C1C1E', borderColor: '#1C1C1E' },
  listBtnEmoji: { fontSize: 20 },
  listBtnText: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', flex: 1 },
  listBtnTextActive: { color: '#FFF' },
  listBtnDesc: { fontSize: 13, color: '#636366', marginTop: 2 },
  listBtnDescActive: { color: 'rgba(255,255,255,0.7)' },
  // Chip / multi-select
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  chipActive: { backgroundColor: '#1C1C1E', borderColor: '#1C1C1E' },
  chipText: { fontSize: 14, fontWeight: '500', color: '#1C1C1E' },
  chipTextActive: { color: '#FFF' },
  // Allergy & Custom tag input
  tagInputRow: { flexDirection: 'row', gap: 10 },
  tagInput: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    padding: 14,
    borderRadius: 14,
    fontSize: 15,
    color: '#1C1C1E',
  },
  tagAddBtn: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagAddBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: {
    backgroundColor: '#EBEAE4',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagText: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  // Success
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EBEAE4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  successEmoji: { fontSize: 44 },
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  summarySection: {
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 15,
    color: '#636366',
    marginBottom: 4,
    lineHeight: 22,
  },
  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 12,
  },
  primaryBtn: {
    backgroundColor: '#1C1C1E',
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: '#EBEAE4',
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: '#1C1C1E', fontSize: 17, fontWeight: '600' },
  ghostBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: { color: '#8E8E93', fontSize: 15, fontWeight: '600' },
});
