import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View, Pressable, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Welcome() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Top Section */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>🧬</Text>
          </View>
          <Text style={styles.logoText}>Basis</Text>
          <Text style={styles.tagline}>Supplement & wellness optimization</Text>
        </View>

        {/* Hero Section */}
        <View style={styles.hero}>
          <Text style={styles.headline}>Your personal{"\n"}supplement cabinet.</Text>
          <Text style={styles.subtitle}>
            Manage your supplements, track adherence, monitor wellness and optimise your daily plan.
          </Text>
        </View>

        {/* Visual Mockup Section */}
        <View style={styles.visualContainer}>
          <View style={styles.glassCardTop}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Sleep Score</Text>
              <Text style={styles.cardValue}>88</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '88%' }]} />
            </View>
          </View>
          
          <View style={styles.glassCardMiddle}>
            <View style={styles.row}>
              <View style={styles.checkCircle}>
                <Text style={styles.checkIcon}>✓</Text>
              </View>
              <Text style={styles.cardText}>Magnesium Glycinate</Text>
            </View>
            <Text style={styles.cardTime}>Morning</Text>
          </View>

          <View style={styles.glassCardBottom}>
            <Text style={styles.cardTitle}>Daily Energy</Text>
            <View style={styles.dotsRow}>
               {[1,2,3,4,5].map(i => (
                 <View key={i} style={[styles.dot, i <= 4 && styles.dotActive]} />
               ))}
            </View>
          </View>
        </View>

        {/* Benefits Section */}
        <View style={styles.benefitsContainer}>
          <BenefitCard icon="🧴" title="Health Cabinet" desc="Organise all your supplements, vitamins and wellness products in one place." />
          <BenefitCard icon="💊" title="Daily Stack" desc="Build and track your personalised supplement plan." />
          <BenefitCard icon="📊" title="Wellness Tracking" desc="Log energy, sleep, mood and supplement adherence daily." />
          <BenefitCard icon="🔔" title="Smart Reminders" desc="Never miss a dose with intelligent refill and intake alerts." />
        </View>

        {/* CTA Section */}
        <View style={styles.ctaContainer}>
          <Pressable 
            style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.9 }]}
            onPress={() => router.push("/auth/signup")}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </Pressable>
          
          <Pressable 
            style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.6 }]}
            onPress={() => router.push("/auth/login")}
          >
            <Text style={styles.secondaryButtonText}>I already have an account</Text>
          </Pressable>
        </View>

        {/* Bottom Area */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Private by design. Your health data belongs to you.</Text>
        </View>
        
      </ScrollView>
    </SafeAreaView>
  );
}

function BenefitCard({ icon, title, desc }: { icon: string, title: string, desc: string }) {
  return (
    <View style={styles.benefitCard}>
      <View style={styles.benefitIconContainer}>
        <Text style={styles.benefitIcon}>{icon}</Text>
      </View>
      <View style={styles.benefitTextContainer}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF9F6', // Off-white, warm scandinavian tone
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#EBEAE4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoIcon: {
    fontSize: 24,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  hero: {
    marginBottom: 48,
  },
  headline: {
    fontSize: 42,
    fontWeight: '800',
    color: '#1C1C1E',
    lineHeight: 48,
    letterSpacing: -1,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 17,
    color: '#636366',
    lineHeight: 26,
  },
  visualContainer: {
    height: 320,
    backgroundColor: '#F0EFEA', // Subtle background for the mockup
    borderRadius: 32,
    padding: 24,
    marginBottom: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  glassCardTop: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.03,
        shadowRadius: 20,
      },
      android: {
        elevation: 2,
      }
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#34C759', // Apple health green
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 3,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 3,
  },
  glassCardMiddle: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.03,
        shadowRadius: 16,
      },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkIcon: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  cardText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  cardTime: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  glassCardBottom: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  dotActive: {
    backgroundColor: '#111111',
  },
  benefitsContainer: {
    gap: 24,
    marginBottom: 56,
  },
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  benefitIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EBEAE4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  benefitIcon: {
    fontSize: 20,
  },
  benefitTextContainer: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  benefitDesc: {
    fontSize: 15,
    color: '#636366',
    lineHeight: 22,
  },
  ctaContainer: {
    marginBottom: 32,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#1C1C1E',
    borderRadius: 100, // Pill shape
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#1C1C1E',
    fontSize: 17,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
    fontWeight: '500',
  },
});
