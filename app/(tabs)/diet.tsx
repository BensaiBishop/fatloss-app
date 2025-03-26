import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TextInput, TouchableOpacity, Dimensions } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

interface DietData {
  tdee: number;
  currentCalories: number;
  gender: 'male' | 'female';
  startDate: string;
}

interface CalorieEntry {
  amount: number;
  timestamp: string;
}

const MIN_CALORIES = {
  male: 1500,
  female: 1200,
};

const STORAGE_KEYS = {
  CALORIE_ENTRIES: 'calorie_entries',
  LAST_RESET_DATE: 'last_reset_date',
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_SPACING = SCREEN_WIDTH * 0.04;
const BASE_FONT_SIZE = SCREEN_WIDTH * 0.035;

export default function DietScreen() {
  const [dietData, setDietData] = useState<DietData | null>(null);
  const [daysElapsed, setDaysElapsed] = useState(0);
  const [calorieEntries, setCalorieEntries] = useState<CalorieEntry[]>([]);
  const [newEntry, setNewEntry] = useState('');
  const [totalCalories, setTotalCalories] = useState(0);

  useEffect(() => {
    loadDietData();
    loadCalorieEntries();
  }, []);

  const loadCalorieEntries = async () => {
    try {
      const now = new Date();
      const lastReset = await AsyncStorage.getItem(STORAGE_KEYS.LAST_RESET_DATE);
      
      // Reset entries if it's past midnight
      if (!lastReset || new Date(lastReset).getDate() !== now.getDate()) {
        // Set the reset time to midnight of the current day
        const midnight = new Date(now);
        midnight.setHours(0, 0, 0, 0);
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_RESET_DATE, midnight.toISOString());
        
        // Add initial 0 calorie entry
        const initialEntry: CalorieEntry = {
          amount: 0,
          timestamp: midnight.toISOString(),
        };
        await AsyncStorage.setItem(STORAGE_KEYS.CALORIE_ENTRIES, JSON.stringify([initialEntry]));
        setCalorieEntries([initialEntry]);
        setTotalCalories(0);
        return;
      }

      const entriesStr = await AsyncStorage.getItem(STORAGE_KEYS.CALORIE_ENTRIES);
      if (entriesStr) {
        const entries = JSON.parse(entriesStr) as CalorieEntry[];
        
        // If no entries exist, add initial 0 calorie entry
        if (entries.length === 0) {
          const initialEntry: CalorieEntry = {
            amount: 0,
            timestamp: new Date().toISOString(),
          };
          entries.push(initialEntry);
          await AsyncStorage.setItem(STORAGE_KEYS.CALORIE_ENTRIES, JSON.stringify(entries));
        }
        
        // Sort entries by timestamp
        entries.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        setCalorieEntries(entries);
        setTotalCalories(entries.reduce((sum, entry) => sum + entry.amount, 0));
      }
    } catch (error) {
      console.error('Error loading calorie entries:', error);
    }
  };

  const handleAddEntry = async () => {
    if (!newEntry || !dietData) return;

    const amount = parseInt(newEntry);
    if (isNaN(amount) || amount <= 0) return;

    const entry: CalorieEntry = {
      amount,
      timestamp: new Date().toISOString(),
    };

    const updatedEntries = [...calorieEntries, entry];
    
    // Sort entries by timestamp
    updatedEntries.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CALORIE_ENTRIES, JSON.stringify(updatedEntries));
      setCalorieEntries(updatedEntries);
      setTotalCalories(updatedEntries.reduce((sum, entry) => sum + entry.amount, 0));
      setNewEntry('');
    } catch (error) {
      console.error('Error saving calorie entry:', error);
    }
  };

  const handleDeleteEntry = async (index: number) => {
    if (!dietData) return;
    
    const updatedEntries = calorieEntries.filter((_, i) => i !== index);

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CALORIE_ENTRIES, JSON.stringify(updatedEntries));
      setCalorieEntries(updatedEntries);
      setTotalCalories(updatedEntries.reduce((sum, entry) => sum + entry.amount, 0));
    } catch (error) {
      console.error('Error deleting calorie entry:', error);
    }
  };

  const loadDietData = async () => {
    try {
      const tdeeStr = await AsyncStorage.getItem('userTDEE');
      const gender = await AsyncStorage.getItem('userGender');
      const startDate = await AsyncStorage.getItem('dietStartDate');
      const lastReset = await AsyncStorage.getItem(STORAGE_KEYS.LAST_RESET_DATE);

      if (!tdeeStr || !gender) {
        return;
      }

      const tdee = parseInt(tdeeStr);
      const start = startDate ? new Date(startDate) : new Date();
      const now = new Date();
      
      // Check if we need to reset for a new day
      if (!lastReset || new Date(lastReset).getDate() !== now.getDate()) {
        // Set the reset time to midnight of the current day
        const midnight = new Date(now);
        midnight.setHours(0, 0, 0, 0);
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_RESET_DATE, midnight.toISOString());
        
        // Reset calorie entries
        const initialEntry: CalorieEntry = {
          amount: 0,
          timestamp: midnight.toISOString(),
        };
        await AsyncStorage.setItem(STORAGE_KEYS.CALORIE_ENTRIES, JSON.stringify([initialEntry]));
        setCalorieEntries([initialEntry]);
        setTotalCalories(0);
      }

      if (!startDate) {
        await AsyncStorage.setItem('dietStartDate', start.toISOString());
      }

      const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      setDaysElapsed(days);

      const calorieReduction = days * 500;
      const currentCalories = Math.max(
        tdee - calorieReduction,
        MIN_CALORIES[gender as 'male' | 'female']
      );

      setDietData({
        tdee,
        currentCalories,
        gender: gender as 'male' | 'female',
        startDate: start.toISOString(),
      });
    } catch (error) {
      console.error('Error loading diet data:', error);
    }
  };

  if (!dietData) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.title}>Diet Tracker</ThemedText>
        <ThemedText style={styles.message}>
          Please complete the onboarding process first to start tracking your diet.
        </ThemedText>
      </ThemedView>
    );
  }

  const progress = Math.min(totalCalories / dietData.currentCalories, 1);
  const progressColor = progress > 1 ? '#FF4444' : '#4CAF50';

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.content}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Diet Tracker</ThemedText>
          <ThemedText style={styles.subtitle}>Track your daily calories</ThemedText>
        </View>

        <View style={styles.calorieCard}>
          <View style={styles.calorieHeader}>
            <Ionicons name="flame" size={20} color="#FF6B6B" />
            <ThemedText style={styles.calorieTitle}>Daily Calories</ThemedText>
          </View>
          <View style={styles.calorieValuesContainer}>
            <View style={styles.calorieValueGroup}>
              <ThemedText style={styles.calorieValue}>{dietData.currentCalories}</ThemedText>
              <ThemedText style={styles.calorieSubtext}>Target</ThemedText>
            </View>
            <View style={styles.calorieDivider} />
            <View style={styles.calorieValueGroup}>
              <ThemedText style={[styles.calorieValue, { color: progressColor }]}>
                {totalCalories}
              </ThemedText>
              <ThemedText style={styles.calorieSubtext}>Current</ThemedText>
            </View>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${progress * 100}%`,
                    backgroundColor: progressColor
                  }
                ]} 
              />
            </View>
            <ThemedText style={styles.progressText}>
              {Math.round(progress * 100)}% of daily target
            </ThemedText>
          </View>
        </View>

        <View style={styles.entryCard}>
          <ThemedText style={styles.entryTitle}>Add Calories</ThemedText>
          <View style={styles.entryInputContainer}>
            <TextInput
              style={styles.entryInput}
              value={newEntry}
              onChangeText={setNewEntry}
              placeholder="Enter calories"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddEntry}
            >
              <Ionicons name="add-circle" size={24} color="#4CAF50" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.entriesCard}>
          <ThemedText style={styles.entriesTitle}>Today's Entries</ThemedText>
          {calorieEntries.map((entry, index) => (
            <View key={index} style={styles.entryItem}>
              <ThemedText style={styles.entryAmount}>{entry.amount} calories</ThemedText>
              <ThemedText style={styles.entryTime}>
                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </ThemedText>
              <TouchableOpacity
                onPress={() => handleDeleteEntry(index)}
                style={styles.deleteButton}
              >
                <Ionicons name="trash-outline" size={20} color="#FF4444" />
              </TouchableOpacity>
            </View>
          ))}
          {calorieEntries.length === 0 && (
            <ThemedText style={styles.noEntries}>No entries yet today</ThemedText>
          )}
        </View>

        <View style={styles.infoCard}>
          <ThemedText style={styles.infoTitle}>Progress</ThemedText>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Starting TDEE:</ThemedText>
            <ThemedText style={styles.infoValue}>{dietData.tdee} calories</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Calories Reduced:</ThemedText>
            <ThemedText style={styles.infoValue}>{daysElapsed * 500} calories</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Minimum Calories:</ThemedText>
            <ThemedText style={styles.infoValue}>{MIN_CALORIES[dietData.gender]} calories</ThemedText>
          </View>
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: SCREEN_HEIGHT * 0.05,
  },
  content: {
    flex: 1,
    backgroundColor: '#121212',
    paddingHorizontal: BASE_SPACING,
    paddingBottom: SCREEN_HEIGHT * 0.1,
  },
  header: {
    marginBottom: BASE_SPACING * 1.5,
  },
  title: {
    fontSize: BASE_FONT_SIZE * 1.5,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: BASE_FONT_SIZE * 1,
    opacity: 0.7,
    marginTop: BASE_SPACING * 0.2,
  },
  message: {
    fontSize: BASE_FONT_SIZE * 1,
    textAlign: 'center',
    marginTop: BASE_SPACING * 1.5,
    opacity: 0.7,
  },
  calorieCard: {
    backgroundColor: '#121212',
    borderRadius: BASE_SPACING * 0.8,
    padding: BASE_SPACING * 1.5,
    marginBottom: BASE_SPACING * 1.5,
    minHeight: SCREEN_HEIGHT * 0.18,
  },
  calorieHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: BASE_SPACING * 1,
    paddingTop: BASE_SPACING * 0.8,
  },
  calorieTitle: {
    fontSize: BASE_FONT_SIZE * 1,
    marginLeft: BASE_SPACING * 0.6,
  },
  calorieValuesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: BASE_SPACING * 0.8,
  },
  calorieValueGroup: {
    alignItems: 'center',
    flex: 1,
  },
  calorieValue: {
    fontSize: BASE_FONT_SIZE * 2.2,
    fontWeight: 'bold',
    includeFontPadding: false,
    lineHeight: BASE_FONT_SIZE * 3,
  },
  calorieSubtext: {
    fontSize: BASE_FONT_SIZE * 0.9,
    opacity: 0.7,
    marginTop: BASE_SPACING * 0.3,
  },
  calorieDivider: {
    width: 1,
    height: SCREEN_HEIGHT * 0.05,
    backgroundColor: '#2C2C2E',
    marginHorizontal: BASE_SPACING * 1.2,
  },
  progressContainer: {
    marginTop: BASE_SPACING * 1,
    paddingTop: BASE_SPACING * 0.8,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#2C2C2E',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: BASE_SPACING * 0.4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: BASE_FONT_SIZE * 0.9,
    textAlign: 'center',
    opacity: 0.7,
  },
  entryCard: {
    backgroundColor: '#121212',
    borderRadius: BASE_SPACING * 0.8,
    padding: BASE_SPACING * 1.2,
    marginBottom: BASE_SPACING * 1.5,
  },
  entryTitle: {
    fontSize: BASE_FONT_SIZE * 1.2,
    marginBottom: BASE_SPACING * 0.8,
  },
  entryInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BASE_SPACING * 0.6,
  },
  entryInput: {
    flex: 1,
    height: SCREEN_HEIGHT * 0.06,
    backgroundColor: '#252525',
    borderRadius: BASE_SPACING * 0.6,
    paddingHorizontal: BASE_SPACING * 0.8,
    color: '#FFFFFF',
    fontSize: BASE_FONT_SIZE * 1.1,
  },
  addButton: {
    padding: BASE_SPACING * 0.4,
  },
  entriesCard: {
    backgroundColor: '#121212',
    borderRadius: BASE_SPACING * 0.8,
    padding: BASE_SPACING * 1.2,
    marginBottom: BASE_SPACING * 1.5,
  },
  entriesTitle: {
    fontSize: BASE_FONT_SIZE * 1.2,
    marginBottom: BASE_SPACING * 0.8,
  },
  entryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: BASE_SPACING * 0.6,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  entryAmount: {
    fontSize: BASE_FONT_SIZE * 1,
    fontWeight: '600',
  },
  entryTime: {
    fontSize: BASE_FONT_SIZE * 0.9,
    opacity: 0.7,
  },
  deleteButton: {
    padding: BASE_SPACING * 0.4,
  },
  noEntries: {
    textAlign: 'center',
    opacity: 0.7,
    marginTop: BASE_SPACING * 0.6,
    fontSize: BASE_FONT_SIZE * 1,
  },
  infoCard: {
    backgroundColor: '#121212',
    borderRadius: BASE_SPACING * 0.8,
    padding: BASE_SPACING * 1.2,
  },
  infoTitle: {
    fontSize: BASE_FONT_SIZE * 1.2,
    marginBottom: BASE_SPACING * 0.8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: BASE_SPACING * 0.6,
  },
  infoLabel: {
    fontSize: BASE_FONT_SIZE * 1,
    opacity: 0.7,
  },
  infoValue: {
    fontSize: BASE_FONT_SIZE * 1,
    fontWeight: '600',
  },
}); 