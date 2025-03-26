import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, SafeAreaView, TextInput, Alert, TouchableOpacity, Animated, Dimensions, Modal } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DraggableFlatList, { 
  RenderItemParams,
  ScaleDecorator,
  DragEndParams 
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

interface AlarmStep {
  id: string;
  duration: number; // in milliseconds
  name: string;
}

interface AlarmSeries {
  id: string;
  name: string;
  steps: AlarmStep[];
}

const STORAGE_KEY = 'alarm_series_storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_SPACING = SCREEN_WIDTH * 0.04; // 4% of screen width
const BASE_FONT_SIZE = SCREEN_WIDTH * 0.035; // 3.5% of screen width

export default function SeriesScreen() {
  const [series, setSeries] = useState<AlarmSeries[]>([]);
  const [currentSeries, setCurrentSeries] = useState<AlarmSeries | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState<AlarmStep | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const progressAnim = React.useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadSeries();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const loadSeries = async () => {
    try {
      console.log('Loading series from storage...');
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      console.log('Raw stored data:', stored);
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('Parsed series:', parsed);
        setSeries(parsed);
      }
    } catch (error) {
      console.error('Error loading series:', error);
      Alert.alert('Error', 'Failed to load series. Please restart the app.');
    }
  };

  const saveSeries = async (newSeries: AlarmSeries[]) => {
    try {
      console.log('Saving series:', newSeries);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSeries));
      setSeries(newSeries);
    } catch (error) {
      console.error('Error saving series:', error);
      Alert.alert('Error', 'Failed to save series. Please try again.');
    }
  };

  const handleCreateNewSeries = async () => {
    try {
      const newSeries: AlarmSeries = {
        id: Date.now().toString(),
        name: 'New Series',
        steps: [],
      };
      const updatedSeries = [...series, newSeries];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSeries));
      setSeries(updatedSeries);
      setCurrentSeries(newSeries);
      setIsEditing(true);
    } catch (error) {
      console.error('Error creating new series:', error);
      Alert.alert('Error', 'Failed to create new series. Please try again.');
    }
  };

  const handleAddStep = () => {
    if (!currentSeries) return;
    
    const newStep: AlarmStep = {
      id: Date.now().toString(),
      duration: 60000, // default 1 minute
      name: `Step ${currentSeries.steps.length + 1}`,
    };

    setCurrentSeries({
      ...currentSeries,
      steps: [...currentSeries.steps, newStep],
    });
  };

  const handleEditSeries = (series: AlarmSeries) => {
    setCurrentSeries(series);
    setModalVisible(true);
  };

  const handleSaveSeries = async () => {
    if (!currentSeries) return;
    
    const updatedSeries = [...series];
    const existingIndex = updatedSeries.findIndex(s => s.id === currentSeries.id);
    
    if (existingIndex >= 0) {
      updatedSeries[existingIndex] = currentSeries;
    } else {
      updatedSeries.push(currentSeries);
    }
    
    await saveSeries(updatedSeries);
    setModalVisible(false);
  };

  const handleDeleteSeries = async (seriesId: string) => {
    console.log('handleDeleteSeries called with ID:', seriesId);
    try {
      console.log('Starting deletion process...');
      console.log('Current series list before deletion:', series);
      
      // First update the state
      const updatedSeries = series.filter((s: AlarmSeries) => s.id !== seriesId);
      console.log('Updated series list after filtering:', updatedSeries);
      
      // Update state immediately
      setSeries(updatedSeries);
      setIsEditing(false);
      setCurrentSeries(null);
      
      // Then save to storage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSeries));
      console.log('Storage updated with new series list');
      
      // Verify the deletion
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      console.log('Verification - Current storage contents:', stored);
      
    } catch (error) {
      console.error('Error deleting series:', error);
      Alert.alert('Error', 'Failed to delete series. Please try again.');
    }
  };

  const handleUpdateStep = (stepId: string, updates: Partial<AlarmStep>) => {
    if (!currentSeries) return;

    setCurrentSeries({
      ...currentSeries,
      steps: currentSeries.steps.map(step =>
        step.id === stepId ? { ...step, ...updates } : step
      ),
    });
  };

  const handleReorderSteps = (steps: AlarmStep[]) => {
    if (!currentSeries) return;
    setCurrentSeries({ ...currentSeries, steps });
  };

  const playAlarm = async () => {
    try {
      // Use haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Add a small delay and repeat haptics for better alerting
      setTimeout(async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 500);
    } catch (error) {
      console.error('Error in playAlarm:', error);
    }
  };

  const stopAlarm = async () => {
    // No need to stop anything since we're only using haptics
  };

  const handlePlaySeries = async (series: AlarmSeries) => {
    if (series.steps.length === 0) {
      Alert.alert('Error', 'Please add steps to the series first');
      return;
    }

    setCurrentSeries(series);
    setCurrentStep(series.steps[0]);
    setRemainingTime(series.steps[0].duration);
    setIsPlaying(true);
    progressAnim.setValue(0);
  };

  const handleStopSeries = async () => {
    setIsPlaying(false);
    setCurrentStep(null);
    setRemainingTime(0);
    progressAnim.setValue(0);
    await stopAlarm();
  };

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying && currentStep) {
      const startTime = Date.now();
      const duration = currentStep.duration;
      
      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const newRemaining = Math.max(0, duration - elapsed);
        
        if (newRemaining <= 0) {
          clearInterval(interval);
          playAlarm();
          const currentIndex = currentSeries?.steps.findIndex(step => step.id === currentStep.id) ?? -1;
          if (currentIndex >= 0 && currentIndex < (currentSeries?.steps.length ?? 0) - 1) {
            const nextStep = currentSeries!.steps[currentIndex + 1];
            setCurrentStep(nextStep);
            setRemainingTime(nextStep.duration);
            progressAnim.setValue(0);
          } else {
            handleStopSeries();
            Alert.alert('Series Complete', 'All steps have been completed!');
          }
        } else {
          setRemainingTime(newRemaining);
          const progress = 1 - (newRemaining / duration);
          progressAnim.setValue(progress);
        }
      }, 16); // Update every frame for smooth animation
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, currentStep, currentSeries]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderStepItem = ({ item, drag, isActive }: RenderItemParams<AlarmStep>) => (
    <ScaleDecorator>
      <View style={[
        styles.editStep,
        isActive && styles.draggingStep
      ]}>
        <View style={styles.stepContent}>
          <Ionicons 
            name="menu" 
            size={24} 
            color="#666" 
            onPressIn={drag}
            style={styles.dragHandle}
          />
          <TextInput
            style={styles.stepNameInput}
            value={item.name}
            onChangeText={(text) => handleUpdateStep(item.id, { name: text })}
            placeholder="Step name"
            placeholderTextColor="#666"
          />
          <View style={styles.durationContainer}>
            <TextInput
              style={styles.durationInput}
              value={Math.floor(item.duration / 60000).toString()}
              onChangeText={(text) => {
                const minutes = parseInt(text) || 0;
                handleUpdateStep(item.id, { duration: minutes * 60000 });
              }}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#666"
            />
            <ThemedText style={styles.durationLabel}>m</ThemedText>
            <TextInput
              style={styles.durationInput}
              value={Math.floor((item.duration % 60000) / 1000).toString()}
              onChangeText={(text) => {
                const seconds = parseInt(text) || 0;
                const minutes = Math.floor(item.duration / 60000);
                handleUpdateStep(item.id, { duration: minutes * 60000 + seconds * 1000 });
              }}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#666"
            />
            <ThemedText style={styles.durationLabel}>s</ThemedText>
          </View>
        </View>
        <TouchableOpacity
          onPress={async () => {
            if (!currentSeries) return;
            const updatedSteps = currentSeries.steps.filter(s => s.id !== item.id);
            const updatedSeries = { ...currentSeries, steps: updatedSteps };
            setCurrentSeries(updatedSeries);
            // Update the series in storage
            const updatedSeriesList = series.map(s => 
              s.id === currentSeries.id ? updatedSeries : s
            );
            await saveSeries(updatedSeriesList);
          }}
          style={styles.deleteStepButton}
        >
          <Ionicons name="trash-outline" size={20} color="#FF4444" />
        </TouchableOpacity>
      </View>
    </ScaleDecorator>
  );

  const clearAllSeries = async () => {
    try {
      console.log('Clearing all series...');
      await AsyncStorage.removeItem(STORAGE_KEY);
      setSeries([]);
      setCurrentSeries(null);
      setIsEditing(false);
      console.log('All series cleared');
    } catch (error) {
      console.error('Error clearing series:', error);
      Alert.alert('Error', 'Failed to clear series. Please try again.');
    }
  };

  return (
    <GestureHandlerRootView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Alarm Series</ThemedText>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              onPress={clearAllSeries}
              style={[styles.newButton, { marginRight: 8 }]}
            >
              <Ionicons name="trash" size={24} color="#FF4444" />
              <ThemedText style={[styles.newButtonText, { color: '#FF4444' }]}>Clear All</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCreateNewSeries}
              style={styles.newButton}
            >
              <Ionicons name="add-circle" size={24} color="#4CAF50" />
              <ThemedText style={styles.newButtonText}>New</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.timerContainer}>
          <View style={styles.timerCircle}>
            <View style={styles.timerContent}>
              <ThemedText style={styles.currentStepName}>
                {currentStep ? currentStep.name : 'No Step Active'}
              </ThemedText>
              <ThemedText style={styles.time}>
                {currentStep ? formatTime(remainingTime) : '00:00'}
              </ThemedText>
              {isPlaying && currentStep && (
                <TouchableOpacity
                  style={[styles.controlButton, styles.stopButton]}
                  onPress={handleStopSeries}
                >
                  <Ionicons name="stop-circle" size={24} color="#fff" />
                  <ThemedText style={styles.controlButtonText}>Stop</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <ScrollView style={styles.content}>
          {series.map(series => (
            <View key={series.id} style={styles.seriesCard}>
              <View style={styles.seriesHeader}>
                <ThemedText style={styles.seriesName}>{series.name}</ThemedText>
                <View style={styles.seriesInfo}>
                  <ThemedText style={styles.seriesSteps}>
                    {series.steps.length} {series.steps.length === 1 ? 'step' : 'steps'}
                  </ThemedText>
                  <ThemedText style={styles.seriesDuration}>
                    {formatTime(series.steps.reduce((total, step) => total + step.duration, 0))}
                  </ThemedText>
                </View>
                <View style={styles.seriesActions}>
                  <TouchableOpacity
                    onPress={() => handlePlaySeries(series)}
                    style={styles.playButton}
                  >
                    <Ionicons name="play-circle" size={24} color="#4CAF50" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleEditSeries(series)}
                    style={styles.editButton}
                  >
                    <Ionicons name="pencil" size={20} color="#2196F3" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteSeries(series.id)}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHandle} />
                <TextInput
                  style={styles.seriesNameInput}
                  value={currentSeries?.name}
                  onChangeText={(text) => currentSeries && setCurrentSeries({ ...currentSeries, name: text })}
                  placeholder="Series name"
                  placeholderTextColor="#666"
                />
                <View style={styles.modalHeaderButtons}>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    style={styles.cancelButton}
                  >
                    <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveSeries}
                    style={styles.saveButton}
                  >
                    <ThemedText style={styles.saveButtonText}>Save</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

              <DraggableFlatList
                data={currentSeries?.steps || []}
                onDragEnd={({ data }) => handleReorderSteps(data)}
                keyExtractor={(item) => item.id}
                renderItem={renderStepItem}
                style={styles.stepsContainer}
              />

              <TouchableOpacity
                onPress={handleAddStep}
                style={styles.addStepButton}
              >
                <Ionicons name="add-circle" size={24} color="#2196F3" />
                <ThemedText style={styles.addStepButtonText}>Add Step</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ThemedView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: SCREEN_HEIGHT * 0.05,
    paddingHorizontal: BASE_SPACING,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: BASE_SPACING * 1.5,
    marginTop: BASE_SPACING,
  },
  title: {
    fontSize: BASE_FONT_SIZE * 1.8,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingHorizontal: BASE_SPACING * 1,
    paddingVertical: BASE_SPACING * 0.6,
    borderRadius: SCREEN_WIDTH * 0.05,
  },
  newButtonText: {
    color: '#4CAF50',
    marginLeft: BASE_SPACING * 0.2,
    fontSize: BASE_FONT_SIZE * 1.1,
  },
  content: {
    flex: 1,
  },
  seriesCard: {
    backgroundColor: '#121212',
    borderRadius: BASE_SPACING * 0.8,
    padding: BASE_SPACING * 1.2,
    marginBottom: BASE_SPACING * 1.5,
  },
  seriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: BASE_SPACING * 1,
  },
  seriesName: {
    fontSize: BASE_FONT_SIZE * 1.2,
    fontWeight: '600',
  },
  seriesNameInput: {
    fontSize: BASE_FONT_SIZE * 1.3,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    marginRight: BASE_SPACING * 1,
  },
  seriesInfo: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flex: 1,
    marginLeft: BASE_SPACING,
  },
  seriesSteps: {
    fontSize: BASE_FONT_SIZE * 0.9,
    opacity: 0.7,
    color: '#FFFFFF',
  },
  seriesDuration: {
    fontSize: BASE_FONT_SIZE * 0.9,
    opacity: 0.7,
    color: '#FFFFFF',
    marginTop: BASE_SPACING * 0.2,
  },
  seriesActions: {
    flexDirection: 'row',
    gap: BASE_SPACING * 0.6,
  },
  playButton: {
    padding: BASE_SPACING * 0.6,
  },
  editButton: {
    padding: BASE_SPACING * 0.6,
  },
  deleteButton: {
    padding: BASE_SPACING * 0.6,
  },
  timerContainer: {
    backgroundColor: '#121212',
    borderRadius: BASE_SPACING * 0.8,
    padding: BASE_SPACING * 0.8,
    marginBottom: BASE_SPACING * 1.5,
    alignItems: 'center',
  },
  timerCircle: {
    width: SCREEN_WIDTH * 0.45,
    height: SCREEN_WIDTH * 0.45,
    borderRadius: SCREEN_WIDTH * 0.225,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BASE_SPACING * 0.2,
    borderColor: '#4CAF50',
    padding: BASE_SPACING * 0.4,
  },
  timerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  currentStepName: {
    fontSize: BASE_FONT_SIZE * 0.9,
    marginBottom: BASE_SPACING * 0.8,
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: BASE_FONT_SIZE * 1.1,
  },
  time: {
    fontSize: BASE_FONT_SIZE * 2.2,
    fontWeight: '200',
    marginBottom: BASE_SPACING * 0.6,
    includeFontPadding: false,
    lineHeight: BASE_FONT_SIZE * 2.6,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingHorizontal: BASE_SPACING * 0.6,
    paddingVertical: BASE_SPACING * 0.3,
    borderRadius: SCREEN_WIDTH * 0.035,
    gap: BASE_SPACING * 0.2,
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: BASE_FONT_SIZE * 0.9,
    fontWeight: '600',
    includeFontPadding: false,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#121212',
    borderTopLeftRadius: BASE_SPACING * 1.2,
    borderTopRightRadius: BASE_SPACING * 1.2,
    paddingTop: BASE_SPACING,
    maxHeight: SCREEN_HEIGHT * 0.8,
  },
  modalHeader: {
    paddingHorizontal: BASE_SPACING * 1.2,
    paddingBottom: BASE_SPACING,
  },
  modalHandle: {
    width: SCREEN_WIDTH * 0.1,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: BASE_SPACING,
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: BASE_SPACING,
  },
  cancelButton: {
    padding: BASE_SPACING,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: BASE_FONT_SIZE * 1.1,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: BASE_SPACING * 1.2,
    paddingVertical: BASE_SPACING * 0.6,
    borderRadius: SCREEN_WIDTH * 0.05,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: BASE_FONT_SIZE * 1.1,
    fontWeight: '600',
  },
  stepsContainer: {
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  editStep: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: BASE_SPACING * 0.8,
    paddingHorizontal: BASE_SPACING * 0.6,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
    backgroundColor: '#121212',
    borderRadius: BASE_SPACING * 0.6,
    marginBottom: BASE_SPACING * 0.6,
  },
  draggingStep: {
    backgroundColor: '#121212',
  },
  stepContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dragHandle: {
    marginRight: BASE_SPACING * 0.8,
  },
  stepNameInput: {
    flex: 1,
    fontSize: BASE_FONT_SIZE * 1.1,
    color: '#fff',
    marginRight: BASE_SPACING * 0.8,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BASE_SPACING * 0.2,
  },
  durationInput: {
    width: SCREEN_WIDTH * 0.1,
    fontSize: BASE_FONT_SIZE * 1.1,
    color: '#fff',
    textAlign: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: BASE_SPACING * 0.2,
    padding: BASE_SPACING * 0.2,
  },
  durationLabel: {
    fontSize: BASE_FONT_SIZE * 1.1,
    opacity: 0.7,
    marginHorizontal: BASE_SPACING * 0.2,
  },
  deleteStepButton: {
    padding: BASE_SPACING * 0.6,
  },
  addStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121212',
    paddingVertical: BASE_SPACING * 0.8,
    borderRadius: BASE_SPACING * 0.6,
    marginTop: BASE_SPACING * 0.8,
  },
  addStepButtonText: {
    color: '#2196F3',
    fontSize: BASE_FONT_SIZE * 1.1,
    fontWeight: '600',
    marginLeft: BASE_SPACING * 0.6,
  },
}); 