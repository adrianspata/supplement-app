import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { useState, useMemo, useEffect } from "react";
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
import type { PrimaryGoal, DietType, Sex } from "../lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const GOALS: { value: PrimaryGoal; label: string; icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap }[] = [
  { value: 'sleep',             label: 'Better Sleep',           icon: 'moon-outline' },
  { value: 'energy',            label: 'More Energy',            icon: 'flash-outline' },
  { value: 'focus',             label: 'Better Focus',           icon: 'bulb-outline' },
  { value: 'stress',            label: 'Less Stress',            icon: 'leaf-outline' },
  { value: 'athletic',          label: 'Recovery',               icon: 'bicycle-outline' },
  { value: 'general_wellness',  label: 'Long-Term Health',       icon: 'sparkles-outline' },
  { value: 'weight_management', label: 'Weight Loss',            icon: 'scale-outline' },
  { value: 'immune',            label: 'Immunity',               icon: 'shield-checkmark-outline' },
  { value: 'hormonal',          label: 'Hormonal Health',       icon: 'options-outline' },
  { value: 'longevity',         label: 'Longevity',              icon: 'hourglass-outline' },
];

// Expanded goal labels mapping for all user request goals
const GOAL_OPTIONS = [
  { value: 'sleep', label: 'Better Sleep', icon: 'moon-outline' },
  { value: 'energy', label: 'More Energy', icon: 'flash-outline' },
  { value: 'focus', label: 'Better Focus', icon: 'bulb-outline' },
  { value: 'stress', label: 'Less Stress', icon: 'leaf-outline' },
  { value: 'recovery', label: 'Recovery', icon: 'heart-outline' },
  { value: 'strength', label: 'Strength', icon: 'barbell-outline' },
  { value: 'muscle_growth', label: 'Muscle Growth', icon: 'fitness-outline' },
  { value: 'weight_loss', label: 'Weight Loss', icon: 'scale-outline' },
  { value: 'digestion', label: 'Digestion', icon: 'help-buoy-outline' },
  { value: 'immunity', label: 'Immunity', icon: 'shield-checkmark-outline' },
  { value: 'skin_health', label: 'Skin Health', icon: 'sparkles-outline' },
  { value: 'hair_health', label: 'Hair Health', icon: 'woman-outline' },
  { value: 'hormonal_health', label: 'Hormonal Health', icon: 'git-branch-outline' },
  { value: 'longevity', label: 'Long-Term Health', icon: 'hourglass-outline' }
];

const CHALLENGES = [
  'Low Energy', 'Brain Fog', 'Trouble Falling Asleep', 'Waking During The Night',
  'Stress', 'Anxiety', 'Poor Recovery', 'Digestive Issues', 'Bloating',
  'Headaches', 'Low Motivation', 'Difficulty Concentrating'
];

const EXERCISE_OPTIONS = ['Rarely', '1–2 times/week', '3–4 times/week', '5+ times/week'];

const SLEEP_DURATION_OPTIONS = ['Under 5 hours', '5–6 hours', '6–7 hours', '7–8 hours', '8+ hours'];

const DIET_OPTIONS = [
  { value: 'omnivore', label: 'Omnivore', desc: 'Eats both plant and animal foods' },
  { value: 'vegetarian', label: 'Vegetarian', desc: 'Avoids meat but may consume dairy and eggs' },
  { value: 'vegan', label: 'Vegan', desc: 'Avoids all animal-derived products' },
  { value: 'pescatarian', label: 'Pescatarian', desc: 'Eats fish but avoids other meats' }
];

const COMMON_SUPPLEMENTS = [
  'Magnesium', 'Vitamin D', 'Omega-3', 'Creatine',
  'Multivitamin', 'Probiotics', 'Protein', 'Electrolytes', 'Other'
];

const KNOWLEDGE_OPTIONS = ['Beginner', 'Intermediate', 'Advanced'];

const PURCHASE_DRIVERS = [
  'Quality', 'Scientific Evidence', 'Price',
  'Natural Ingredients', 'Trusted Brands', 'Simplicity'
];

const PURCHASE_FREQUENCY_OPTIONS = ['Never', 'A few times per year', 'Every few months', 'Monthly'];

const AGE_RANGES = ['Under 18', '18–29', '30–39', '40–49', '50–59', '60+'];

const SEX_OPTIONS = ['Male', 'Female', 'Other'];

type StepType = 'welcome' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 'snapshot';

const TOTAL_NUMBERED_STEPS = 12;

// ─── Score Selector Component ────────────────────────────────────────────────

const CustomScoreSelector = ({
  value,
  onChange,
  lowLabel,
  highLabel
}: {
  value: number | null;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
}) => {
  return (
    <View style={styles.sliderContainer}>
      <View style={styles.numberRow}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
          const isSelected = value === num;
          return (
            <Pressable
              key={num}
              style={[styles.numberCircle, isSelected && styles.numberCircleActive]}
              onPress={() => onChange(num)}
            >
              <Text style={[styles.numberCircleText, isSelected && styles.numberCircleTextActive]}>
                {num}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.sliderLabelsRow}>
        <Text style={styles.sliderLabelText}>{lowLabel}</Text>
        <Text style={styles.sliderLabelText}>{highLabel}</Text>
      </View>
    </View>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Onboarding() {
  const router = useRouter();
  const { userPreferences, setOnboardingCompleted, refreshUserData } = useAuth();
  const { mode } = useLocalSearchParams();
  const isEditMode = mode === 'edit';

  const [step, setStep] = useState<StepType>(isEditMode ? 1 : 'welcome');
  const [loading, setLoading] = useState(false);

  // Survey States
  const [goals, setGoals] = useState<string[]>([]); // primary_goals
  const [healthConcerns, setHealthConcerns] = useState<string[]>([]);
  const [exerciseFrequency, setExerciseFrequency] = useState('');
  const [sleepDuration, setSleepDuration] = useState('');
  const [stressLevel, setStressLevel] = useState<number | null>(null);
  const [dietType, setDietType] = useState<string | null>(null);
  
  // Supplements states
  const [takesSupplements, setTakesSupplements] = useState<boolean | null>(null);
  const [currentSupplements, setCurrentSupplements] = useState<string[]>([]);
  
  const [supplementKnowledgeLevel, setSupplementKnowledgeLevel] = useState<string | null>(null);
  const [purchaseDrivers, setPurchaseDrivers] = useState<string[]>([]);
  const [purchaseFrequency, setPurchaseFrequency] = useState('');
  const [healthScore, setHealthScore] = useState<number | null>(null);
  
  // Bio Profile
  const [ageRange, setAgeRange] = useState('');
  const [sex, setSex] = useState<string | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  // Prefill state in Edit Mode only once when userPreferences is ready
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (isEditMode && userPreferences && !prefilled) {
      if (userPreferences.primary_goals) {
        setGoals(userPreferences.primary_goals);
      }
      if (userPreferences.health_concerns) {
        setHealthConcerns(userPreferences.health_concerns);
      }
      if (userPreferences.exercise_frequency) {
        setExerciseFrequency(userPreferences.exercise_frequency);
      }
      if (userPreferences.sleep_duration) {
        setSleepDuration(userPreferences.sleep_duration);
      }
      if (userPreferences.stress_level !== null && userPreferences.stress_level !== undefined) {
        setStressLevel(userPreferences.stress_level);
      }
      if (userPreferences.diet_type) {
        setDietType(userPreferences.diet_type);
      }
      if (userPreferences.current_supplements) {
        setCurrentSupplements(userPreferences.current_supplements);
        setTakesSupplements(userPreferences.current_supplements.length > 0);
      } else {
        setTakesSupplements(false);
      }
      if (userPreferences.supplement_knowledge_level) {
        setSupplementKnowledgeLevel(userPreferences.supplement_knowledge_level);
      }
      if (userPreferences.purchase_drivers) {
        setPurchaseDrivers(userPreferences.purchase_drivers);
      }
      if (userPreferences.purchase_frequency) {
        setPurchaseFrequency(userPreferences.purchase_frequency);
      }
      if (userPreferences.health_score_self_assessment !== null && userPreferences.health_score_self_assessment !== undefined) {
        setHealthScore(userPreferences.health_score_self_assessment);
      }
      if (userPreferences.age_range) {
        setAgeRange(userPreferences.age_range);
      }
      if (userPreferences.sex) {
        setSex(userPreferences.sex);
      }
      if (userPreferences.height_cm) {
        setHeight(String(userPreferences.height_cm));
      }
      if (userPreferences.weight_kg) {
        setWeight(String(userPreferences.weight_kg));
      }
      setPrefilled(true);
    }
  }, [userPreferences, isEditMode, prefilled]);

  // ── Helpers ──
  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const toggleGoal = (goal: string) => {
    if (goals.includes(goal)) {
      setGoals(goals.filter(g => g !== goal));
    } else {
      if (goals.length < 5) {
        setGoals([...goals, goal]);
      } else {
        Alert.alert("Goal Limit", "You can select a maximum of 5 goals to prioritize your routine.");
      }
    }
  };

  // ── Validation ──
  const isStepValid = () => {
    if (step === 'welcome') return true;
    if (step === 1) return goals.length >= 3 && goals.length <= 5;
    if (step === 2) return true; // health_concerns is optional (can choose none)
    if (step === 3) return exerciseFrequency !== '';
    if (step === 4) return sleepDuration !== '';
    if (step === 5) return stressLevel !== null;
    if (step === 6) return dietType !== null;
    if (step === 7) {
      if (takesSupplements === null) return false;
      if (takesSupplements === true && currentSupplements.length === 0) return false;
      return true;
    }
    if (step === 8) return supplementKnowledgeLevel !== null;
    if (step === 9) return purchaseDrivers.length > 0;
    if (step === 10) return purchaseFrequency !== '';
    if (step === 11) return healthScore !== null;
    if (step === 12) return ageRange !== '';
    if (step === 'snapshot') return true;
    return true;
  };

  const handleNext = () => {
    if (!isStepValid()) return;
    if (step === 'welcome') setStep(1);
    else if (typeof step === 'number' && step < TOTAL_NUMBERED_STEPS) setStep((step + 1) as StepType);
    else if (step === TOTAL_NUMBERED_STEPS) setStep('snapshot');
  };

  const handleBack = () => {
    if (step === 1) {
      if (isEditMode) {
        router.back();
      } else {
        setStep('welcome');
      }
    }
    else if (typeof step === 'number' && step > 1) setStep((step - 1) as StepType);
    else if (step === 'snapshot') setStep(TOTAL_NUMBERED_STEPS);
  };

  // ── Save Onboarding Data ──
  const handleSaveData = async () => {
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("No logged-in user found");

      // Save to user_preferences
      const { error: prefError } = await supabase.from('user_preferences').upsert(
        {
          user_id: user.id,
          primary_goals: goals.length > 0 ? goals.map(normalizeGoal) as any[] : null,
          health_score_self_assessment: healthScore,
          age_range: ageRange || null,
          sex,
          height_cm: parseFloat(height) || null,
          weight_kg: parseFloat(weight) || null,
          diet_type: dietType as any,
          current_supplements: currentSupplements.length > 0 ? currentSupplements : [],
          existing_supplements: currentSupplements.length > 0 ? currentSupplements : [], // keep for backwards compatibility
          health_concerns: healthConcerns.length > 0 ? healthConcerns : [],
          exercise_frequency: exerciseFrequency || null,
          sleep_duration: sleepDuration || null,
          stress_level: stressLevel,
          supplement_knowledge_level: supplementKnowledgeLevel,
          purchase_drivers: purchaseDrivers.length > 0 ? purchaseDrivers : [],
          purchase_frequency: purchaseFrequency || null,
          completed_onboarding: true,
        },
        { onConflict: 'user_id' }
      );

      if (prefError) throw prefError;

      // Sync onboarding_completed flag to profiles table as well
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      if (profileError) {
        console.warn("[OnboardingSave] Could not update profile onboarding status:", profileError);
      }
      
      await refreshUserData();
      setOnboardingCompleted(true);

      if (isEditMode) {
        router.replace("/tabs/profile");
      } else {
        router.replace("/tabs/home");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not save preferences. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Progress bar ──
  const renderProgressBar = () => {
    if (step === 'welcome' || step === 'snapshot') return null;
    const currentStep = typeof step === 'number' ? step : 0;
    return (
      <View style={styles.headerRow}>
        <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color="#1C1C1E" />
        </Pressable>
        {isEditMode ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#1C1C1E' }}>Edit health profile</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#8E8E93', textTransform: 'uppercase', marginTop: 1 }}>
              Step {currentStep} of {TOTAL_NUMBERED_STEPS}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${(currentStep / TOTAL_NUMBERED_STEPS) * 100}%` }]} />
            </View>
            <Text style={styles.stepCounter}>{currentStep}/{TOTAL_NUMBERED_STEPS}</Text>
          </>
        )}
      </View>
    );
  };

  const renderLogo = () => (
    <View style={styles.logoAnchor}>
      <View style={styles.logoContainer}>
        <Ionicons name="pulse" size={22} color="#111111" />
      </View>
    </View>
  );

  // ─── Dynamic Snapshot Generation ───────────────────────────────────────────

  const snapshotData = useMemo(() => {
    const selectedGoalLabels = goals.map(g => {
      const found = GOAL_OPTIONS.find(x => x.value === g);
      return found ? found.label : g;
    });

    const focusAreas: { title: string; description: string; icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap }[] = [];
    
    if (sleepDuration === 'Under 5 hours' || sleepDuration === '5–6 hours') {
      focusAreas.push({
        title: 'Sleep Optimization',
        description: `Your typical sleep duration of ${sleepDuration} is below optimal. Prioritizing rest and deep sleep recovery will unlock major energy gains.`,
        icon: 'moon-outline'
      });
    }
    
    if (stressLevel !== null && stressLevel >= 6) {
      focusAreas.push({
        title: 'Cortisol & Stress Control',
        description: `Daily stress at ${stressLevel}/10 keeps your body in fight-or-flight. Introducing adaptogens can help regulate adrenal fatigue.`,
        icon: 'leaf-outline'
      });
    }

    if (exerciseFrequency === '5+ times/week' || exerciseFrequency === '3–4 times/week') {
      focusAreas.push({
        title: 'Exercise & Muscle Recovery',
        description: `With regular training (${exerciseFrequency}), replenishing cellular ATP and easing muscle soreness is key to consistency.`,
        icon: 'barbell-outline'
      });
    }

    if (dietType === 'vegan' || dietType === 'vegetarian') {
      focusAreas.push({
        title: 'Nutrient Gap Buffering',
        description: 'Plant-based eating styles can run lower in bioavailable Vitamin D3, B12, and Omega-3. Targeted ingestion covers these bases.',
        icon: 'restaurant-outline'
      });
    }

    if (focusAreas.length === 0) {
      focusAreas.push({
        title: 'General Health Consistency',
        description: 'Focus on consistent daily nutrients, micro-habits, and basic hydration to reinforce your health baseline.',
        icon: 'pulse-outline'
      });
    }

    // Stack selector rules
    const stack: { name: string; category: string; description: string; why: string }[] = [];

    const hasGoalOrConcern = (goalKeys: string[], concernKeys: string[]) => {
      const matchGoal = goals.some(g => goalKeys.includes(g));
      const matchConcern = healthConcerns.some(c => concernKeys.includes(c));
      return matchGoal || matchConcern;
    };

    if (hasGoalOrConcern(['sleep', 'stress', 'recovery'], ['Trouble Falling Asleep', 'Waking During The Night', 'Stress', 'Anxiety', 'Poor Recovery']) || (stressLevel !== null && stressLevel >= 6)) {
      stack.push({
        name: 'Magnesium Glycinate',
        category: 'Mineral Baseline',
        description: 'Highly bioavailable magnesium bound to glycine for relaxation.',
        why: 'Improves sleep onset, calms the central nervous system, and prevents morning muscle stiffness.'
      });
    }

    if (hasGoalOrConcern(['stress'], ['Stress', 'Anxiety', 'Low Motivation']) || (stressLevel !== null && stressLevel >= 7)) {
      stack.push({
        name: 'Ashwagandha KSM-66',
        category: 'Adaptogen Support',
        description: 'Standardized root extract clinically proven to lower cortisol.',
        why: 'Targets chronic daily stressors, improves focus under pressure, and buffers fatigue.'
      });
    }

    if (hasGoalOrConcern(['energy', 'immunity', 'longevity'], ['Low Energy', 'Low Motivation']) || dietType === 'vegan' || dietType === 'vegetarian') {
      stack.push({
        name: 'Vitamin D3 + K2',
        category: 'Vitamin Booster',
        description: 'Synergistic vitamins supporting bone density and white blood cells.',
        why: 'Supports immune defenses and mitigates typical indoor lifestyle deficiency.'
      });
    }

    if (hasGoalOrConcern(['focus', 'longevity'], ['Brain Fog', 'Difficulty Concentrating'])) {
      stack.push({
        name: 'High-EPA Omega-3 Fish Oil',
        category: 'Essential Fatty Acid',
        description: 'Concentrated clean lipids targeting cellular and cardiac health.',
        why: 'Nourishes brain tissue, combats daily brain fog, and helps resolve systemic inflammation.'
      });
    }

    if (hasGoalOrConcern(['digestion'], ['Digestive Issues', 'Bloating'])) {
      stack.push({
        name: 'Daily Spore Probiotics',
        category: 'Microbiome Support',
        description: 'Hardy bacterial strains that survive stomach acidity.',
        why: 'Directly helps optimize gut flora, reduce bloating, and improve nutrient uptake.'
      });
    }

    if (hasGoalOrConcern(['strength', 'muscle_growth', 'recovery'], ['Poor Recovery']) && (exerciseFrequency === '3–4 times/week' || exerciseFrequency === '5+ times/week')) {
      stack.push({
        name: 'Creatine Monohydrate',
        category: 'Cellular Hydrator',
        description: 'Pure micronized powder reinforcing skeletal muscle ATP.',
        why: 'Improves muscle power output, accelerates workout recovery, and supports cognitive clarity.'
      });
    }

    // Ensure at least 3 items
    if (stack.length < 3 && !stack.some(s => s.name === 'Magnesium Glycinate')) {
      stack.push({
        name: 'Magnesium Glycinate',
        category: 'Mineral Baseline',
        description: 'Highly bioavailable magnesium bound to glycine for relaxation.',
        why: 'Improves sleep onset, calms the central nervous system, and prevents morning muscle stiffness.'
      });
    }
    if (stack.length < 3 && !stack.some(s => s.name === 'Vitamin D3 + K2')) {
      stack.push({
        name: 'Vitamin D3 + K2',
        category: 'Vitamin Booster',
        description: 'Synergistic vitamins supporting bone density and white blood cells.',
        why: 'Supports immune defenses and mitigates typical indoor lifestyle deficiency.'
      });
    }
    if (stack.length < 3 && !stack.some(s => s.name === 'High-EPA Omega-3 Fish Oil')) {
      stack.push({
        name: 'High-EPA Omega-3 Fish Oil',
        category: 'Essential Fatty Acid',
        description: 'Concentrated clean lipids targeting cellular and cardiac health.',
        why: 'Nourishes brain tissue, combats daily brain fog, and helps resolve systemic inflammation.'
      });
    }

    return {
      selectedGoalLabels,
      focusAreas,
      stack: stack.slice(0, 3)
    };
  }, [goals, healthConcerns, exerciseFrequency, sleepDuration, stressLevel, dietType]);

  // ─── Steps ───────────────────────────────────────────────────────────────

  const renderWelcome = () => (
    <View style={[styles.stepContainer, styles.centeredStep]}>
      <Text style={styles.title}>Let's build your{'\n'}health baseline.</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>
        Answer a few questions and get personalized supplement and wellness recommendations.
      </Text>
      
      <View style={styles.timeTag}>
        <Ionicons name="time-outline" size={16} color="#8E8E93" style={{ marginRight: 6 }} />
        <Text style={styles.timeTagText}>About 2 minutes</Text>
      </View>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>STEP 1/12 — GOALS</Text>
      <Text style={styles.title}>What would you like to improve over the next 3 months?</Text>
      <Text style={styles.subtitle}>Select 3–5 goals to target. Tap to toggle.</Text>
      
      <Text style={styles.goalCounterText}>Selected: {goals.length} of 5</Text>
      <View style={styles.chipContainer}>
        {GOAL_OPTIONS.map((item) => {
          const isActive = goals.includes(item.value);
          return (
            <Pressable
              key={item.value}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => toggleGoal(item.value)}
            >
              <Ionicons name={item.icon as any} size={16} color={isActive ? "#FFF" : "#1C1C1E"} style={{ marginRight: 6 }} />
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>STEP 2/12 — CHALLENGES</Text>
      <Text style={styles.title}>Which of these do you experience regularly?</Text>
      <Text style={styles.subtitle}>Select all that apply. (Optional)</Text>
      <View style={styles.chipContainer}>
        {CHALLENGES.map((item) => {
          const isActive = healthConcerns.includes(item);
          return (
            <Pressable
              key={item}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => toggleItem(healthConcerns, setHealthConcerns, item)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>STEP 3/12 — EXERCISE</Text>
      <Text style={styles.title}>How often do you exercise?</Text>
      <Text style={styles.subtitle}>Select the option that best matches your weekly consistency.</Text>
      <View style={styles.optionsList}>
        {EXERCISE_OPTIONS.map((opt) => {
          const isActive = exerciseFrequency === opt;
          return (
            <Pressable
              key={opt}
              style={[styles.listBtn, isActive && styles.listBtnActive]}
              onPress={() => setExerciseFrequency(opt)}
            >
              <Text style={[styles.listBtnText, isActive && styles.listBtnTextActive]}>{opt}</Text>
              {isActive && <Ionicons name="checkmark" size={18} color="#FFF" />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>STEP 4/12 — SLEEP</Text>
      <Text style={styles.title}>How much do you typically sleep?</Text>
      <Text style={styles.subtitle}>Averaged over a typical workweek.</Text>
      <View style={styles.optionsList}>
        {SLEEP_DURATION_OPTIONS.map((opt) => {
          const isActive = sleepDuration === opt;
          return (
            <Pressable
              key={opt}
              style={[styles.listBtn, isActive && styles.listBtnActive]}
              onPress={() => setSleepDuration(opt)}
            >
              <Text style={[styles.listBtnText, isActive && styles.listBtnTextActive]}>{opt}</Text>
              {isActive && <Ionicons name="checkmark" size={18} color="#FFF" />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>STEP 5/12 — STRESS</Text>
      <Text style={styles.title}>How would you rate your daily stress?</Text>
      <Text style={styles.subtitle}>Based on your typical routine and work environmental factors.</Text>
      
      <CustomScoreSelector
        value={stressLevel}
        onChange={setStressLevel}
        lowLabel="1 - Extremely Calm"
        highLabel="10 - High Stress"
      />
    </View>
  );

  const renderStep6 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>STEP 6/12 — DIET</Text>
      <Text style={styles.title}>Which best describes your diet?</Text>
      <Text style={styles.subtitle}>This flags potential nutrient deficiencies or macro alignments.</Text>
      <View style={styles.optionsList}>
        {DIET_OPTIONS.map(({ value, label, desc }) => {
          const isActive = dietType === value;
          return (
            <Pressable
              key={value}
              style={[styles.listBtn, isActive && styles.listBtnActive]}
              onPress={() => setDietType(value)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.listBtnText, isActive && styles.listBtnTextActive]}>{label}</Text>
                <Text style={[styles.listBtnDesc, isActive && styles.listBtnDescActive]}>{desc}</Text>
              </View>
              {isActive && <Ionicons name="checkmark" size={18} color="#FFF" style={{ marginLeft: 8 }} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderStep7 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>STEP 7/12 — EXISTING SUPPLEMENTS</Text>
      <Text style={styles.title}>Do you currently take supplements?</Text>
      <Text style={styles.subtitle}>Helps calibrate dosage and avoid duplicate recommendations.</Text>
      
      <View style={styles.formRow}>
        <Pressable
          style={[styles.listBtn, { flex: 1, justifyContent: 'center' }, takesSupplements === false && styles.listBtnActive]}
          onPress={() => {
            setTakesSupplements(false);
            setCurrentSupplements([]);
          }}
        >
          <Text style={[styles.listBtnText, { textAlign: 'center' }, takesSupplements === false && styles.listBtnTextActive]}>No</Text>
        </Pressable>
        <Pressable
          style={[styles.listBtn, { flex: 1, justifyContent: 'center' }, takesSupplements === true && styles.listBtnActive]}
          onPress={() => setTakesSupplements(true)}
        >
          <Text style={[styles.listBtnText, { textAlign: 'center' }, takesSupplements === true && styles.listBtnTextActive]}>Yes</Text>
        </Pressable>
      </View>

      {takesSupplements === true && (
        <View style={{ marginTop: 24 }}>
          <Text style={[styles.label, { marginBottom: 12 }]}>Which ones do you take? (Select all that apply)</Text>
          <View style={styles.chipContainer}>
            {COMMON_SUPPLEMENTS.map((item) => {
              const isActive = currentSupplements.includes(item);
              return (
                <Pressable
                  key={item}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => toggleItem(currentSupplements, setCurrentSupplements, item)}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );

  const renderStep8 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>STEP 8/12 — SUPPLEMENT KNOWLEDGE</Text>
      <Text style={styles.title}>How familiar are you with supplements?</Text>
      <Text style={styles.subtitle}>Calibrates our recommendations and coaching insights.</Text>
      <View style={styles.optionsList}>
        {KNOWLEDGE_OPTIONS.map((opt) => {
          const isActive = supplementKnowledgeLevel === opt;
          return (
            <Pressable
              key={opt}
              style={[styles.listBtn, isActive && styles.listBtnActive]}
              onPress={() => setSupplementKnowledgeLevel(opt)}
            >
              <Text style={[styles.listBtnText, isActive && styles.listBtnTextActive]}>{opt}</Text>
              {isActive && <Ionicons name="checkmark" size={18} color="#FFF" />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderStep9 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>STEP 9/12 — VALUE DRIVERS</Text>
      <Text style={styles.title}>What matters most when choosing supplements?</Text>
      <Text style={styles.subtitle}>Select the top factors that influence your purchases.</Text>
      <View style={styles.chipContainer}>
        {PURCHASE_DRIVERS.map((item) => {
          const isActive = purchaseDrivers.includes(item);
          return (
            <Pressable
              key={item}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => toggleItem(purchaseDrivers, setPurchaseDrivers, item)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderStep10 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>STEP 10/12 — PURCHASE FREQUENCY</Text>
      <Text style={styles.title}>How often do you buy supplements?</Text>
      <Text style={styles.subtitle}>Helps optimize reminder strategies and pantry levels.</Text>
      <View style={styles.optionsList}>
        {PURCHASE_FREQUENCY_OPTIONS.map((opt) => {
          const isActive = purchaseFrequency === opt;
          return (
            <Pressable
              key={opt}
              style={[styles.listBtn, isActive && styles.listBtnActive]}
              onPress={() => setPurchaseFrequency(opt)}
            >
              <Text style={[styles.listBtnText, isActive && styles.listBtnTextActive]}>{opt}</Text>
              {isActive && <Ionicons name="checkmark" size={18} color="#FFF" />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderStep11 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>STEP 11/12 — BASELINE HEALTH</Text>
      <Text style={styles.title}>How would you rate your overall health today?</Text>
      <Text style={styles.subtitle}>This becomes your baseline health score index to measure progress.</Text>
      
      <CustomScoreSelector
        value={healthScore}
        onChange={setHealthScore}
        lowLabel="1 - Poor Health"
        highLabel="10 - Optimal Vitality"
      />
    </View>
  );

  const renderStep12 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTag}>STEP 12/12 — BIO PROFILE</Text>
      <Text style={styles.title}>Tell us about yourself</Text>
      <Text style={styles.subtitle}>We only use this biological info to calibrate recommended dosages.</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Age Range *</Text>
        <View style={styles.chipContainer}>
          {AGE_RANGES.map((range) => {
            const isActive = ageRange === range;
            return (
              <Pressable
                key={range}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setAgeRange(range)}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{range}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Sex <Text style={styles.optional}>(optional)</Text></Text>
        <View style={styles.chipContainer}>
          {SEX_OPTIONS.map((opt) => {
            const isActive = sex === opt;
            return (
              <Pressable
                key={opt}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setSex(opt)}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt}</Text>
              </Pressable>
            );
          })}
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

  const renderSnapshot = () => {
    const { selectedGoalLabels, focusAreas, stack } = snapshotData;

    return (
      <View style={styles.stepContainer}>
        <View style={styles.successHeader}>
          <View style={styles.successIconCircle}>
            <Ionicons name="sparkles" size={24} color="#10B981" />
          </View>
          <Text style={styles.titleSnapshot}>Your Health Snapshot</Text>
          <Text style={styles.subtitleSnapshot}>
            We've formulated a custom routine based on your biomarkers, lifestyle, and goals.
          </Text>
        </View>

        {/* Goals Card */}
        <View style={styles.snapshotCard}>
          <Text style={styles.snapshotCardHeader}>Your Target Focuses</Text>
          <View style={styles.goalsWrap}>
            {selectedGoalLabels.map(g => (
              <View key={g} style={styles.snapshotGoalRow}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 8 }} />
                <Text style={styles.snapshotGoalText}>{g}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Potential Focus Areas */}
        <Text style={styles.snapshotCardTitle}>Bio-Behavioral Insights</Text>
        {focusAreas.map(fa => (
          <View key={fa.title} style={styles.focusAreaCard}>
            <View style={styles.focusAreaIconContainer}>
              <Ionicons name={fa.icon} size={22} color="#1C1C1E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.focusAreaTitle}>{fa.title}</Text>
              <Text style={styles.focusAreaDesc}>{fa.description}</Text>
            </View>
          </View>
        ))}

        {/* Recommended Stack */}
        <Text style={styles.snapshotCardTitle}>Recommended Starting Stack</Text>
        {stack.map((item, idx) => (
          <View key={item.name} style={styles.stackCard}>
            <View style={styles.stackCardTop}>
              <View style={styles.stackNumberBadge}>
                <Text style={styles.stackNumberBadgeText}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stackCardName}>{item.name}</Text>
                <Text style={styles.stackCardCategory}>{item.category}</Text>
              </View>
            </View>
            <Text style={styles.stackCardDesc}>{item.description}</Text>
            
            <View style={styles.whyBox}>
              <Text style={styles.whyTitle}>Why we recommend this:</Text>
              <Text style={styles.whyText}>{item.why}</Text>
            </View>
          </View>
        ))}

        {/* Closing Explainer */}
        <View style={[styles.focusAreaCard, { backgroundColor: '#F4F4F3', borderWidth: 0, marginTop: 12 }]}>
          <Ionicons name="shield-checkmark" size={20} color="#1C1C1E" style={{ marginRight: 12, marginTop: 2 }} />
          <Text style={[styles.focusAreaDesc, { flex: 1, color: '#1C1C1E' }]}>
            These starting ingredients serve as a baseline. You can adjust stack products and customize dosages anytime inside the app.
          </Text>
        </View>
      </View>
    );
  };

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
          {step === 10 && renderStep10()}
          {step === 11 && renderStep11()}
          {step === 12 && renderStep12()}
          {step === 'snapshot' && renderSnapshot()}
        </ScrollView>

        {/* Footer CTA */}
        <View style={styles.footer}>
          {step === 'welcome' ? (
            <Pressable style={styles.primaryBtn} onPress={handleNext}>
              <Text style={styles.primaryBtnText}>Get Started</Text>
            </Pressable>
          ) : typeof step === 'number' ? (
            <Pressable
              style={[styles.primaryBtn, !isStepValid() && styles.primaryBtnDisabled]}
              onPress={handleNext}
              disabled={!isStepValid()}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
            </Pressable>
          ) : step === 'snapshot' ? (
            <Pressable
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleSaveData}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryBtnText}>{isEditMode ? "Save changes" : "Continue to Basis"}</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF9F6' },
  logoAnchor: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  logoContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EBEAE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  progressContainer: {
    flex: 1,
    height: 4,
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
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    minWidth: 32,
    textAlign: 'right',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  stepContainer: { flex: 1 },
  centeredStep: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    paddingBottom: 40,
  },
  stepTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.6,
    marginBottom: 10,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 15,
    color: '#636366',
    lineHeight: 22,
    marginBottom: 24,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBEAE4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    marginTop: 20,
  },
  timeTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636366',
  },
  goalCounterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  inputGroup: { marginBottom: 22 },
  formRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  optional: { fontWeight: '400', color: '#8E8E93' },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    padding: 16,
    borderRadius: 14,
    fontSize: 16,
    color: '#1C1C1E',
  },
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
  listBtnText: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', flex: 1 },
  listBtnTextActive: { color: '#FFF' },
  listBtnDesc: { fontSize: 13, color: '#636366', marginTop: 3 },
  listBtnDescActive: { color: 'rgba(255,255,255,0.7)' },
  
  // Chip layouts
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  chipActive: { backgroundColor: '#1C1C1E', borderColor: '#1C1C1E' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  chipTextActive: { color: '#FFF' },

  // Sliders
  sliderContainer: {
    width: '100%',
    marginTop: 20,
    marginBottom: 20,
  },
  numberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
    width: '100%',
  },
  numberCircle: {
    flex: 1,
    aspectRatio: 1,
    marginHorizontal: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 40,
  },
  numberCircleActive: {
    backgroundColor: '#1C1C1E',
    borderColor: '#1C1C1E',
  },
  numberCircleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  numberCircleTextActive: {
    color: '#FFF',
  },
  sliderLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sliderLabelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636366',
  },

  // Snapshot Visuals
  successHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 10,
  },
  successIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  titleSnapshot: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1C1C1E',
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  subtitleSnapshot: {
    fontSize: 15,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  snapshotCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1C1E',
    marginTop: 28,
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  snapshotCard: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  snapshotCardHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  goalsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  snapshotGoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
  },
  snapshotGoalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  focusAreaCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    gap: 14,
  },
  focusAreaIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FAF9F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  focusAreaTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  focusAreaDesc: {
    fontSize: 13,
    color: '#636366',
    lineHeight: 18,
  },
  stackCard: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
  },
  stackCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  stackNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackNumberBadgeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  stackCardName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  stackCardCategory: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 1,
  },
  stackCardDesc: {
    fontSize: 14,
    color: '#1C1C1E',
    lineHeight: 20,
    marginBottom: 14,
  },
  whyBox: {
    backgroundColor: '#F8F7F4',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  whyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  whyText: {
    fontSize: 13,
    color: '#48484A',
    lineHeight: 18,
  },

  // Footer & Buttons
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
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
