import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Image, ScrollView, TextInput, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import CustomButton from '@/components/ui/CustomButton';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import Carousel from 'react-native-reanimated-carousel';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_SPACING = SCREEN_WIDTH * 0.04; // 4% of screen width
const BASE_FONT_SIZE = SCREEN_WIDTH * 0.035; // 3.5% of screen width

interface ProfileData {
  name: string;
  initialCalories: number;
  photo: string;
  gender: string;
  dailyTarget: number;
  progressPhotos: string[];
  lastProgressPhotoDate?: string;
}

interface DailyTask {
  id: string;
  title: string;
  isCompleted: boolean;
  icon: string;
}

interface CarouselItem {
  item: string;
  index: number;
}

export default function ProfileScreen() {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<ProfileData | null>(null);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([
    { id: '1', title: 'Track Calories', isCompleted: false, icon: 'restaurant-outline' },
    { id: '2', title: 'Complete Workout', isCompleted: false, icon: 'barbell-outline' },
    { id: '3', title: 'Drink Water', isCompleted: false, icon: 'water-outline' },
  ]);

  useEffect(() => {
    loadProfileData();
    loadDailyTasks();
  }, []);

  const loadProfileData = async () => {
    try {
      const [name, tdee, photo, gender, dailyTarget, progressPhotos, lastProgressPhotoDate] = await Promise.all([
        AsyncStorage.getItem('userName'),
        AsyncStorage.getItem('userTDEE'),
        AsyncStorage.getItem('initialProgressPhoto'),
        AsyncStorage.getItem('userGender'),
        AsyncStorage.getItem('dailyCalorieTarget'),
        AsyncStorage.getItem('progressPhotos'),
        AsyncStorage.getItem('lastProgressPhotoDate')
      ]);

      const parsedProgressPhotos = progressPhotos ? JSON.parse(progressPhotos) : [];
      const data = {
        name: name || '',
        initialCalories: parseInt(tdee || '0'),
        photo: photo || '',
        gender: gender || '',
        dailyTarget: parseInt(dailyTarget || tdee || '0'),
        progressPhotos: photo ? [photo, ...parsedProgressPhotos] : parsedProgressPhotos,
        lastProgressPhotoDate: lastProgressPhotoDate || ''
      };

      setProfileData(data);
      setEditedData(data);
    } catch (error) {
      console.error('Error loading profile data:', error);
    }
  };

  const loadDailyTasks = async () => {
    try {
      const today = new Date().toDateString();
      const savedDate = await AsyncStorage.getItem('lastTaskCheckDate');
      
      if (savedDate !== today) {
        // Reset tasks for new day
        await AsyncStorage.setItem('lastTaskCheckDate', today);
        await AsyncStorage.setItem('dailyTasks', JSON.stringify(dailyTasks));
      } else {
        const savedTasks = await AsyncStorage.getItem('dailyTasks');
        if (savedTasks) {
          setDailyTasks(JSON.parse(savedTasks));
        }
      }
    } catch (error) {
      console.error('Error loading daily tasks:', error);
    }
  };

  const toggleTask = async (taskId: string) => {
    const updatedTasks = dailyTasks.map(task =>
      task.id === taskId ? { ...task, isCompleted: !task.isCompleted } : task
    );
    setDailyTasks(updatedTasks);
    try {
      await AsyncStorage.setItem('dailyTasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.error('Error saving daily task state:', error);
    }
  };

  const handleSave = async () => {
    if (!editedData) return;

    try {
      await Promise.all([
        AsyncStorage.setItem('userName', editedData.name),
        AsyncStorage.setItem('userTDEE', editedData.initialCalories.toString()),
        AsyncStorage.setItem('userGender', editedData.gender),
        AsyncStorage.setItem('dailyCalorieTarget', editedData.dailyTarget.toString())
      ]);

      setProfileData(editedData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile data:', error);
      alert('Failed to save changes. Please try again.');
    }
  };

  const handleCancel = () => {
    setEditedData(profileData);
    setIsEditing(false);
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera permissions to take progress photos!');
      return false;
    }
    return true;
  };

  const takeProgressPhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled) {
        const photo = result.assets[0];
        
        // Create a directory for progress photos if it doesn't exist
        const progressPhotosDir = `${FileSystem.documentDirectory}progress_photos`;
        const dirInfo = await FileSystem.getInfoAsync(progressPhotosDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(progressPhotosDir);
        }

        // Save the photo with a timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `progress_${timestamp}.jpg`;
        const destination = `${progressPhotosDir}/${fileName}`;
        
        await FileSystem.copyAsync({
          from: photo.uri,
          to: destination
        });

        const today = new Date().toISOString();
        const updatedPhotos = [...(profileData?.progressPhotos || []), destination];
        
        await Promise.all([
          AsyncStorage.setItem('progressPhotos', JSON.stringify(updatedPhotos)),
          AsyncStorage.setItem('lastProgressPhotoDate', today)
        ]);

        setProfileData(prev => prev ? {
          ...prev,
          progressPhotos: updatedPhotos,
          lastProgressPhotoDate: today
        } : null);
      }
    } catch (error) {
      console.error('Error taking progress photo:', error);
      alert('Failed to take photo. Please try again.');
    }
  };

  const canTakeProgressPhoto = () => {
    if (!profileData?.lastProgressPhotoDate) return true;
    const lastPhotoDate = new Date(profileData.lastProgressPhotoDate);
    const today = new Date();
    const daysSinceLastPhoto = Math.floor((today.getTime() - lastPhotoDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceLastPhoto >= 7;
  };

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.content}>
        <View style={styles.header}>
          {isEditing ? (
            <TextInput
              style={styles.nameInput}
              value={editedData?.name || ''}
              onChangeText={(text) => setEditedData(prev => prev ? { ...prev, name: text } : null)}
              placeholder="Your Name"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
            />
          ) : (
            <ThemedText style={styles.name}>{profileData?.name}</ThemedText>
          )}
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <ThemedText style={styles.statLabel}>Original Caloric Intake</ThemedText>
            {isEditing ? (
              <TextInput
                style={styles.statInput}
                value={editedData?.initialCalories.toString() || ''}
                onChangeText={(text) => {
                  const calories = parseInt(text);
                  if (!isNaN(calories)) {
                    setEditedData(prev => prev ? { ...prev, initialCalories: calories } : null);
                  }
                }}
                keyboardType="numeric"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
              />
            ) : (
              <ThemedText style={styles.statValue}>{profileData?.initialCalories} calories</ThemedText>
            )}
          </View>
          
          <View style={styles.statCard}>
            <ThemedText style={styles.statLabel}>Gender</ThemedText>
            {isEditing ? (
              <View style={styles.genderButtons}>
                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    editedData?.gender === 'male' && styles.genderButtonSelected
                  ]}
                  onPress={() => setEditedData(prev => prev ? { ...prev, gender: 'male' } : null)}
                >
                  <ThemedText style={styles.buttonText}>Male</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    editedData?.gender === 'female' && styles.genderButtonSelected
                  ]}
                  onPress={() => setEditedData(prev => prev ? { ...prev, gender: 'female' } : null)}
                >
                  <ThemedText style={styles.buttonText}>Female</ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <ThemedText style={styles.statValue}>
                {profileData?.gender === 'male' ? 'Male' : 'Female'}
              </ThemedText>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Daily Goals</ThemedText>
          <View style={styles.taskList}>
            {dailyTasks.map(task => (
              <TouchableOpacity
                key={task.id}
                style={styles.taskItem}
                onPress={() => toggleTask(task.id)}
              >
                <View style={styles.taskLeft}>
                  <Ionicons
                    name={task.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={task.isCompleted ? '#4CAF50' : '#FFFFFF'}
                  />
                  <ThemedText style={[
                    styles.taskText,
                    task.isCompleted && styles.taskTextCompleted
                  ]}>
                    {task.title}
                  </ThemedText>
                </View>
                <Ionicons name={task.icon as any} size={20} color="#FFFFFF" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Progress Tracking</ThemedText>
          <ThemedText style={styles.sectionDescription}>
            Your progress photos and measurements will appear here as you track your journey.
          </ThemedText>
          
          {profileData?.progressPhotos && profileData.progressPhotos.length > 0 && (
            <View style={styles.carouselContainer}>
              <Carousel
                loop={false}
                width={SCREEN_WIDTH - 32}
                height={300}
                data={profileData.progressPhotos}
                mode="parallax"
                modeConfig={{
                  parallaxScrollingScale: 0.9,
                  parallaxScrollingOffset: 50,
                }}
                snapEnabled={true}
                pagingEnabled={true}
                autoPlay={false}
                style={{
                  width: '100%',
                }}
                renderItem={({ item, index }: CarouselItem) => (
                  <View style={styles.carouselItem}>
                    <Image 
                      source={{ uri: item }} 
                      style={styles.carouselImage}
                      resizeMode="cover"
                    />
                    <ThemedText style={styles.carouselDate}>
                      {(() => {
                        try {
                          // For the first photo (index 0), use lastProgressPhotoDate
                          if (index === 0 && profileData?.lastProgressPhotoDate) {
                            const date = new Date(profileData.lastProgressPhotoDate);
                            return date.toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            });
                          }
                          // For other photos, try to get date from filename
                          const filename = item.split('/').pop() || '';
                          const dateMatch = filename.match(/\d{4}-\d{2}-\d{2}/);
                          if (dateMatch) {
                            const date = new Date(dateMatch[0]);
                            return date.toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            });
                          }
                          return 'No date';
                        } catch (error) {
                          console.error('Error parsing date:', error);
                          return 'No date';
                        }
                      })()}
                    </ThemedText>
                  </View>
                )}
              />
            </View>
          )}

          {canTakeProgressPhoto() ? (
            <CustomButton
              title="Take Progress Photo"
              onPress={takeProgressPhoto}
              style={{ ...styles.editButton, marginTop: BASE_SPACING }}
            />
          ) : (
            <ThemedText style={[styles.sectionDescription, { marginTop: BASE_SPACING }]}>
              Next progress photo available in {7 - Math.floor((new Date().getTime() - new Date(profileData?.lastProgressPhotoDate || '').getTime()) / (1000 * 60 * 60 * 24))} days
            </ThemedText>
          )}
        </View>

        <View style={styles.buttonContainer}>
          {isEditing ? (
            <>
              <CustomButton
                title="Save Changes"
                onPress={handleSave}
                style={styles.saveButton}
              />
              <CustomButton
                title="Cancel"
                onPress={handleCancel}
                style={styles.cancelButton}
              />
            </>
          ) : (
            <View style={styles.editButtonContainer}>
              <CustomButton
                title="Edit Profile"
                onPress={() => setIsEditing(true)}
                style={styles.editButton}
              />
            </View>
          )}
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: 50, // Add padding to account for the notch
  },
  content: {
    padding: BASE_SPACING,
    paddingBottom: BASE_SPACING * 3, // Add extra padding at the bottom
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  nameInput: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: '#121212',
    padding: 6,
    borderRadius: 8,
    width: '100%',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    width: '100%',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    maxWidth: 180,
  },
  statLabel: {
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.7,
    marginBottom: 6,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  statInput: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: '#2C2C2E',
    padding: 6,
    borderRadius: 8,
    width: '100%',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.7,
    lineHeight: 18,
    textAlign: 'center',
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
  },
  genderButton: {
    backgroundColor: '#121212',
    padding: 8,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  genderButtonSelected: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: BASE_SPACING * 2,
    marginBottom: BASE_SPACING * 2,
    gap: 10,
    width: '100%',
    maxWidth: 280,
    alignSelf: 'center',
  },
  editButtonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#2C2C2E',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  cancelButton: {
    backgroundColor: '#2C2C2E',
  },
  taskList: {
    width: '100%',
    marginTop: BASE_SPACING,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: BASE_SPACING,
    paddingHorizontal: BASE_SPACING * 1.5,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  taskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BASE_SPACING,
  },
  taskText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  taskTextCompleted: {
    opacity: 0.5,
    textDecorationLine: 'line-through',
  },
  carouselContainer: {
    width: '100%',
    marginVertical: BASE_SPACING,
  },
  carouselItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  carouselDate: {
    position: 'absolute',
    bottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    fontSize: 14,
    color: '#FFFFFF',
  },
}); 