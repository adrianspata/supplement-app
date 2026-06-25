import React, { useState, useEffect, useMemo } from "react";
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { normalizeGoal } from "../../lib/matching";
import { PageContainer } from "../../src/components/ui/PageContainer";
import { SoftCard } from "../../src/components/ui/SoftCard";
import { Colors, Spacing, BorderRadii, getContentContainerStyle } from "../../src/constants/theme";
import { useColorScheme } from "../../src/hooks/use-color-scheme";

// ─── Constants ────────────────────────────────────────────────────────────────

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
  { value: 'omnivore', label: 'Omnivore' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' }
];

const KNOWLEDGE_OPTIONS = ['Beginner', 'Intermediate', 'Advanced'];

const PURCHASE_DRIVERS = [
  'Quality', 'Scientific Evidence', 'Price',
  'Natural Ingredients', 'Trusted Brands', 'Simplicity'
];

const PURCHASE_FREQUENCY_OPTIONS = ['Never', 'A few times per year', 'Every few months', 'Monthly'];

const AGE_RANGES = ['Under 18', '18–29', '30–39', '40–49', '50–59', '60+'];

const SEX_OPTIONS = ['Male', 'Female', 'Other'];

export default function EditHealthProfile() {
  const router = useRouter();
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  const { userPreferences, onboardingCompleted, refreshUserData } = useAuth();

  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Form States
  const [goals, setGoals] = useState<string[]>([]);
  const [healthConcerns, setHealthConcerns] = useState<string[]>([]);
  const [exerciseFrequency, setExerciseFrequency] = useState('');
  const [sleepDuration, setSleepDuration] = useState('');
  const [stressLevel, setStressLevel] = useState<number | null>(null);
  const [dietType, setDietType] = useState<string | null>(null);
  const [currentSupplements, setCurrentSupplements] = useState<string[]>([]);
  const [supplementKnowledgeLevel, setSupplementKnowledgeLevel] = useState<string | null>(null);
  const [purchaseDrivers, setPurchaseDrivers] = useState<string[]>([]);
  const [purchaseFrequency, setPurchaseFrequency] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [sex, setSex] = useState<string | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  // UI Expansion States
  const [showGoalSelector, setShowGoalSelector] = useState(false);
  const [showConcernSelector, setShowConcernSelector] = useState(false);
  const [showDriverSelector, setShowDriverSelector] = useState(false);
  const [newSupplementInput, setNewSupplementInput] = useState("");

  // Redirect incomplete users to onboarding
  useEffect(() => {
    if (onboardingCompleted === false) {
      router.replace("/onboarding");
    }
  }, [onboardingCompleted]);

  // Load initial preferences
  useEffect(() => {
    if (userPreferences && !dataLoaded) {
      setGoals(userPreferences.primary_goals || []);
      setHealthConcerns(userPreferences.health_concerns || []);
      setExerciseFrequency(userPreferences.exercise_frequency || "");
      setSleepDuration(userPreferences.sleep_duration || "");
      setStressLevel(userPreferences.stress_level);
      setDietType(userPreferences.diet_type || null);
      setCurrentSupplements(userPreferences.current_supplements || []);
      setSupplementKnowledgeLevel(userPreferences.supplement_knowledge_level || null);
      setPurchaseDrivers(userPreferences.purchase_drivers || []);
      setPurchaseFrequency(userPreferences.purchase_frequency || "");
      setAgeRange(userPreferences.age_range || "");
      setSex(userPreferences.sex || null);
      setHeight(userPreferences.height_cm ? String(userPreferences.height_cm) : "");
      setWeight(userPreferences.weight_kg ? String(userPreferences.weight_kg) : "");
      setDataLoaded(true);
    }
  }, [userPreferences, dataLoaded]);

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    if (!userPreferences) return false;
    
    const goalsChanged = JSON.stringify(goals) !== JSON.stringify(userPreferences.primary_goals || []);
    const concernsChanged = JSON.stringify(healthConcerns) !== JSON.stringify(userPreferences.health_concerns || []);
    const exerciseChanged = exerciseFrequency !== (userPreferences.exercise_frequency || "");
    const sleepChanged = sleepDuration !== (userPreferences.sleep_duration || "");
    const stressChanged = stressLevel !== userPreferences.stress_level;
    const dietChanged = dietType !== (userPreferences.diet_type || null);
    const knowledgeChanged = supplementKnowledgeLevel !== (userPreferences.supplement_knowledge_level || null);
    const frequencyChanged = purchaseFrequency !== (userPreferences.purchase_frequency || "");
    const ageChanged = ageRange !== (userPreferences.age_range || "");
    const sexChanged = sex !== (userPreferences.sex || null);
    
    const originalHeight = userPreferences.height_cm ? String(userPreferences.height_cm) : "";
    const heightChanged = height !== originalHeight;

    const originalWeight = userPreferences.weight_kg ? String(userPreferences.weight_kg) : "";
    const weightChanged = weight !== originalWeight;

    const supplementsChanged = JSON.stringify(currentSupplements) !== JSON.stringify(userPreferences.current_supplements || []);
    const driversChanged = JSON.stringify(purchaseDrivers) !== JSON.stringify(userPreferences.purchase_drivers || []);

    return (
      goalsChanged ||
      concernsChanged ||
      exerciseChanged ||
      sleepChanged ||
      stressChanged ||
      dietChanged ||
      knowledgeChanged ||
      frequencyChanged ||
      ageChanged ||
      sexChanged ||
      heightChanged ||
      weightChanged ||
      supplementsChanged ||
      driversChanged
    );
  }, [
    goals,
    healthConcerns,
    exerciseFrequency,
    sleepDuration,
    stressLevel,
    dietType,
    currentSupplements,
    supplementKnowledgeLevel,
    purchaseDrivers,
    purchaseFrequency,
    ageRange,
    sex,
    height,
    weight,
    userPreferences
  ]);

  const handleBack = () => {
    if (hasChanges) {
      Alert.alert(
        "Discard changes?",
        "You have unsaved changes. Are you sure you want to discard them?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => router.back() }
        ]
      );
    } else {
      router.back();
    }
  };

  const handleSave = async () => {
    if (goals.length < 3 || goals.length > 5) {
      Alert.alert("Goal Limit", "You must prioritize between 3 and 5 goals.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("No logged-in user found");

      // Save user preferences
      const { error: prefError } = await supabase.from('user_preferences').upsert(
        {
          user_id: user.id,
          primary_goals: goals.length > 0 ? goals.map(normalizeGoal) as any[] : null,
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

      // Sync onboarding_completed flag to profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      if (profileError) {
        console.warn("[EditProfile] Could not update profile onboarding status:", profileError);
      }

      await refreshUserData();
      Alert.alert("Success", "Your health profile was updated successfully.", [
        { text: "OK", onPress: () => router.replace("/tabs/profile") }
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not save changes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddGoal = (val: string) => {
    if (goals.includes(val)) return;
    if (goals.length >= 5) {
      Alert.alert("Goal Limit", "You can select a maximum of 5 goals.");
      return;
    }
    setGoals([...goals, val]);
  };

  const handleRemoveGoal = (val: string) => {
    setGoals(goals.filter(g => g !== val));
  };

  const handleAddConcern = (val: string) => {
    if (healthConcerns.includes(val)) return;
    setHealthConcerns([...healthConcerns, val]);
  };

  const handleRemoveConcern = (val: string) => {
    setHealthConcerns(healthConcerns.filter(c => c !== val));
  };

  const handleAddDriver = (val: string) => {
    if (purchaseDrivers.includes(val)) return;
    setPurchaseDrivers([...purchaseDrivers, val]);
  };

  const handleRemoveDriver = (val: string) => {
    setPurchaseDrivers(purchaseDrivers.filter(d => d !== val));
  };

  const handleAddSupplement = () => {
    const cleanInput = newSupplementInput.trim();
    if (!cleanInput) return;
    if (currentSupplements.includes(cleanInput)) {
      setNewSupplementInput("");
      return;
    }
    setCurrentSupplements([...currentSupplements, cleanInput]);
    setNewSupplementInput("");
  };

  const handleRemoveSupplement = (val: string) => {
    setCurrentSupplements(currentSupplements.filter(s => s !== val));
  };

  if (!userPreferences) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="small" color={themeColors.text} />
      </View>
    );
  }

  return (
    <PageContainer scrollable contentContainerStyle={[getContentContainerStyle(false), styles.container]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={[styles.backBtn, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={themeColors.text} />
        </Pressable>
        <Text style={[styles.title, { color: themeColors.text }]}>Edit health profile</Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
          Update the answers Basis uses for your recommendations.
        </Text>
      </View>

      {/* 1. Goals Card */}
      <SoftCard style={[styles.card, { borderColor: themeColors.border }]} variant="elevated">
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: themeColors.text }]}>Goals (Select 3-5)</Text>
          <Pressable onPress={() => setShowGoalSelector(!showGoalSelector)}>
            <Text style={[styles.cardActionText, { color: themeColors.primary }]}>
              {showGoalSelector ? "Close" : "+ Add Goal"}
            </Text>
          </Pressable>
        </View>

        {showGoalSelector && (
          <View style={[styles.expandableList, { backgroundColor: themeColors.backgroundSecondary }]}>
            {GOAL_OPTIONS.map(opt => {
              const isSelected = goals.includes(opt.value);
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.selectorItem, isSelected && { opacity: 0.5 }]}
                  onPress={() => isSelected ? handleRemoveGoal(opt.value) : handleAddGoal(opt.value)}
                >
                  <Text style={[styles.selectorItemText, { color: themeColors.text }]}>{opt.label}</Text>
                  {isSelected && <Ionicons name="checkmark" size={16} color={themeColors.primary} />}
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.pillsContainer}>
          {goals.length === 0 ? (
            <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>No goals specified yet</Text>
          ) : (
            goals.map(g => {
              const matched = GOAL_OPTIONS.find(o => o.value === g);
              return (
                <View key={g} style={[styles.pill, { backgroundColor: themeColors.backgroundSecondary }]}>
                  <Text style={[styles.pillText, { color: themeColors.text }]}>{matched ? matched.label : g}</Text>
                  <Pressable onPress={() => handleRemoveGoal(g)} style={styles.pillClose}>
                    <Ionicons name="close-circle" size={16} color={themeColors.textSecondary} />
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      </SoftCard>

      {/* 2. Health Concerns */}
      <SoftCard style={[styles.card, { borderColor: themeColors.border }]} variant="elevated">
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: themeColors.text }]}>Health Concerns</Text>
          <Pressable onPress={() => setShowConcernSelector(!showConcernSelector)}>
            <Text style={[styles.cardActionText, { color: themeColors.primary }]}>
              {showConcernSelector ? "Close" : "+ Add Concern"}
            </Text>
          </Pressable>
        </View>

        {showConcernSelector && (
          <View style={[styles.expandableList, { backgroundColor: themeColors.backgroundSecondary }]}>
            {CHALLENGES.map(opt => {
              const isSelected = healthConcerns.includes(opt);
              return (
                <Pressable
                  key={opt}
                  style={[styles.selectorItem, isSelected && { opacity: 0.5 }]}
                  onPress={() => isSelected ? handleRemoveConcern(opt) : handleAddConcern(opt)}
                >
                  <Text style={[styles.selectorItemText, { color: themeColors.text }]}>{opt}</Text>
                  {isSelected && <Ionicons name="checkmark" size={16} color={themeColors.primary} />}
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.pillsContainer}>
          {healthConcerns.length === 0 ? (
            <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>No concerns specified yet</Text>
          ) : (
            healthConcerns.map(c => (
              <View key={c} style={[styles.pill, { backgroundColor: themeColors.backgroundSecondary }]}>
                <Text style={[styles.pillText, { color: themeColors.text }]}>{c}</Text>
                <Pressable onPress={() => handleRemoveConcern(c)} style={styles.pillClose}>
                  <Ionicons name="close-circle" size={16} color={themeColors.textSecondary} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </SoftCard>

      {/* 3. Lifestyle Cards */}
      <SoftCard style={[styles.card, { borderColor: themeColors.border }]} variant="elevated">
        <Text style={[styles.cardTitle, { color: themeColors.text, marginBottom: 16 }]}>Lifestyle & Vitality</Text>
        
        {/* Stress Level */}
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Stress Level (1-10)</Text>
          <View style={styles.stressScale}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
              <Pressable
                key={num}
                style={[
                  styles.stressBtn,
                  { borderColor: themeColors.border },
                  stressLevel === num && { backgroundColor: themeColors.text }
                ]}
                onPress={() => setStressLevel(num)}
              >
                <Text style={[
                  styles.stressText,
                  { color: themeColors.text },
                  stressLevel === num && { color: themeColors.background }
                ]}>
                  {num}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Exercise Frequency */}
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Exercise Frequency</Text>
          <View style={styles.chipsRow}>
            {EXERCISE_OPTIONS.map(opt => (
              <Pressable
                key={opt}
                style={[
                  styles.chipBtn,
                  { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border },
                  exerciseFrequency === opt && { backgroundColor: themeColors.text }
                ]}
                onPress={() => setExerciseFrequency(opt)}
              >
                <Text style={[
                  styles.chipBtnText,
                  { color: themeColors.text },
                  exerciseFrequency === opt && { color: themeColors.background }
                ]}>
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Sleep Duration */}
        <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Sleep Duration</Text>
          <View style={styles.chipsRow}>
            {SLEEP_DURATION_OPTIONS.map(opt => (
              <Pressable
                key={opt}
                style={[
                  styles.chipBtn,
                  { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border },
                  sleepDuration === opt && { backgroundColor: themeColors.text }
                ]}
                onPress={() => setSleepDuration(opt)}
              >
                <Text style={[
                  styles.chipBtnText,
                  { color: themeColors.text },
                  sleepDuration === opt && { color: themeColors.background }
                ]}>
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SoftCard>

      {/* 4. Biometrics Card */}
      <SoftCard style={[styles.card, { borderColor: themeColors.border }]} variant="elevated">
        <Text style={[styles.cardTitle, { color: themeColors.text, marginBottom: 16 }]}>Biometrics</Text>
        
        {/* Age Range */}
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Age Range</Text>
          <View style={styles.chipsRow}>
            {AGE_RANGES.map(opt => (
              <Pressable
                key={opt}
                style={[
                  styles.chipBtn,
                  { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border },
                  ageRange === opt && { backgroundColor: themeColors.text }
                ]}
                onPress={() => setAgeRange(opt)}
              >
                <Text style={[
                  styles.chipBtnText,
                  { color: themeColors.text },
                  ageRange === opt && { color: themeColors.background }
                ]}>
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Sex */}
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Sex</Text>
          <View style={styles.chipsRow}>
            {SEX_OPTIONS.map(opt => (
              <Pressable
                key={opt}
                style={[
                  styles.chipBtn,
                  { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border },
                  sex === opt && { backgroundColor: themeColors.text }
                ]}
                onPress={() => setSex(opt)}
              >
                <Text style={[
                  styles.chipBtnText,
                  { color: themeColors.text },
                  sex === opt && { color: themeColors.background }
                ]}>
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Height and Weight */}
        <View style={[styles.fieldRow, styles.flexRow, { borderBottomWidth: 0 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Height (cm)</Text>
            <TextInput
              style={[styles.textInput, { borderColor: themeColors.border, color: themeColors.text }]}
              value={height}
              onChangeText={setHeight}
              keyboardType="decimal-pad"
              placeholder="e.g. 175"
              placeholderTextColor={themeColors.textMuted}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Weight (kg)</Text>
            <TextInput
              style={[styles.textInput, { borderColor: themeColors.border, color: themeColors.text }]}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="e.g. 70"
              placeholderTextColor={themeColors.textMuted}
            />
          </View>
        </View>
      </SoftCard>

      {/* 5. Diet & Knowledge */}
      <SoftCard style={[styles.card, { borderColor: themeColors.border }]} variant="elevated">
        <Text style={[styles.cardTitle, { color: themeColors.text, marginBottom: 16 }]}>Diet & Supplement Knowledge</Text>

        {/* Diet Type */}
        <View style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Diet Style</Text>
          <View style={styles.chipsRow}>
            {DIET_OPTIONS.map(opt => (
              <Pressable
                key={opt.value}
                style={[
                  styles.chipBtn,
                  { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border },
                  dietType === opt.value && { backgroundColor: themeColors.text }
                ]}
                onPress={() => setDietType(opt.value)}
              >
                <Text style={[
                  styles.chipBtnText,
                  { color: themeColors.text },
                  dietType === opt.value && { color: themeColors.background }
                ]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Supplement Knowledge */}
        <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Knowledge Level</Text>
          <View style={styles.chipsRow}>
            {KNOWLEDGE_OPTIONS.map(opt => (
              <Pressable
                key={opt}
                style={[
                  styles.chipBtn,
                  { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border },
                  supplementKnowledgeLevel === opt && { backgroundColor: themeColors.text }
                ]}
                onPress={() => setSupplementKnowledgeLevel(opt)}
              >
                <Text style={[
                  styles.chipBtnText,
                  { color: themeColors.text },
                  supplementKnowledgeLevel === opt && { color: themeColors.background }
                ]}>
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SoftCard>

      {/* 6. Purchase Preferences */}
      <SoftCard style={[styles.card, { borderColor: themeColors.border }]} variant="elevated">
        <Text style={[styles.cardTitle, { color: themeColors.text, marginBottom: 16 }]}>Purchase Preferences</Text>

        {/* Purchase Drivers */}
        <View style={styles.fieldRow}>
          <View style={styles.cardHeader}>
            <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginBottom: 0 }]}>Key Buying Drivers</Text>
            <Pressable onPress={() => setShowDriverSelector(!showDriverSelector)}>
              <Text style={[styles.cardActionText, { color: themeColors.primary }]}>
                {showDriverSelector ? "Close" : "+ Add Driver"}
              </Text>
            </Pressable>
          </View>

          {showDriverSelector && (
            <View style={[styles.expandableList, { backgroundColor: themeColors.backgroundSecondary, marginTop: 8 }]}>
              {PURCHASE_DRIVERS.map(opt => {
                const isSelected = purchaseDrivers.includes(opt);
                return (
                  <Pressable
                    key={opt}
                    style={[styles.selectorItem, isSelected && { opacity: 0.5 }]}
                    onPress={() => isSelected ? handleRemoveDriver(opt) : handleAddDriver(opt)}
                  >
                    <Text style={[styles.selectorItemText, { color: themeColors.text }]}>{opt}</Text>
                    {isSelected && <Ionicons name="checkmark" size={16} color={themeColors.primary} />}
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={[styles.pillsContainer, { marginTop: 12 }]}>
            {purchaseDrivers.length === 0 ? (
              <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>No drivers specified yet</Text>
            ) : (
              purchaseDrivers.map(d => (
                <View key={d} style={[styles.pill, { backgroundColor: themeColors.backgroundSecondary }]}>
                  <Text style={[styles.pillText, { color: themeColors.text }]}>{d}</Text>
                  <Pressable onPress={() => handleRemoveDriver(d)} style={styles.pillClose}>
                    <Ionicons name="close-circle" size={16} color={themeColors.textSecondary} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Purchase Frequency */}
        <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Purchase Frequency</Text>
          <View style={styles.chipsRow}>
            {PURCHASE_FREQUENCY_OPTIONS.map(opt => (
              <Pressable
                key={opt}
                style={[
                  styles.chipBtn,
                  { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border },
                  purchaseFrequency === opt && { backgroundColor: themeColors.text }
                ]}
                onPress={() => setPurchaseFrequency(opt)}
              >
                <Text style={[
                  styles.chipBtnText,
                  { color: themeColors.text },
                  purchaseFrequency === opt && { color: themeColors.background }
                ]}>
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SoftCard>

      {/* 7. Current Supplements */}
      <SoftCard style={[styles.card, { borderColor: themeColors.border }]} variant="elevated">
        <Text style={[styles.cardTitle, { color: themeColors.text }]}>Current Supplements</Text>
        <Text style={[styles.subtitleText, { color: themeColors.textSecondary, marginBottom: 16 }]}>
          Add or remove items you are currently taking.
        </Text>

        <View style={styles.addSupplementRow}>
          <TextInput
            style={[styles.textInput, { flex: 1, borderColor: themeColors.border, color: themeColors.text }]}
            value={newSupplementInput}
            onChangeText={setNewSupplementInput}
            placeholder="Add a supplement (e.g. Zinc)"
            placeholderTextColor={themeColors.textMuted}
            onSubmitEditing={handleAddSupplement}
          />
          <Pressable
            style={[styles.addBtn, { backgroundColor: themeColors.text }]}
            onPress={handleAddSupplement}
          >
            <Text style={[styles.addBtnText, { color: themeColors.background }]}>Add</Text>
          </Pressable>
        </View>

        <View style={[styles.pillsContainer, { marginTop: 12 }]}>
          {currentSupplements.length === 0 ? (
            <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>Not taking any supplements yet</Text>
          ) : (
            currentSupplements.map(s => (
              <View key={s} style={[styles.pill, { backgroundColor: themeColors.backgroundSecondary }]}>
                <Text style={[styles.pillText, { color: themeColors.text }]}>{s}</Text>
                <Pressable onPress={() => handleRemoveSupplement(s)} style={styles.pillClose}>
                  <Ionicons name="close-circle" size={16} color={themeColors.textSecondary} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </SoftCard>

      {/* Save Button */}
      <View style={styles.saveContainer}>
        <Pressable
          style={[
            styles.saveBtn,
            { backgroundColor: themeColors.text },
            !hasChanges && { opacity: 0.5 }
          ]}
          onPress={handleSave}
          disabled={loading || !hasChanges}
        >
          {loading ? (
            <ActivityIndicator color={themeColors.background} />
          ) : (
            <Text style={[styles.saveBtnText, { color: themeColors.background }]}>Save changes</Text>
          )}
        </Pressable>
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    paddingBottom: 40,
    backgroundColor: '#FAF9F6',
  },
  header: {
    marginTop: 20,
    marginBottom: 24,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  card: {
    padding: 20,
    borderRadius: BorderRadii.xl,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  cardActionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  subtitleText: {
    fontSize: 12,
    marginTop: -12,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: "italic",
    paddingVertical: 4,
  },
  pillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  pillClose: {
    marginLeft: 6,
  },
  expandableList: {
    borderRadius: 12,
    padding: 8,
    marginBottom: 16,
    gap: 2,
  },
  selectorItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  selectorItemText: {
    fontSize: 14,
    fontWeight: "500",
  },
  fieldRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.03)",
  },
  flexRow: {
    flexDirection: "row",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  stressScale: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  stressBtn: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stressText: {
    fontSize: 12,
    fontWeight: "700",
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    backgroundColor: "#FFF",
  },
  addSupplementRow: {
    flexDirection: "row",
    gap: 8,
  },
  addBtn: {
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  saveContainer: {
    marginTop: 12,
    marginBottom: 32,
  },
  saveBtn: {
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
