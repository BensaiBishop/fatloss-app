import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, Platform, ViewStyle, Pressable, Image, View } from 'react-native';
import { router } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import CustomButton from '@/components/ui/CustomButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

interface ProfileData {
  name: string;
  initialCalories: number;
  photo?: string;
  age: number | null;
  gender: 'male' | 'female' | '';
  heightFeet: string;
  heightInches: string;
  weight: number | null;
  activityLevel: number;
}

// Separate component for animated text
const AnimatedText = ({ text, delay = 0, onComplete }: { 
  text: string; 
  delay?: number;
  onComplete?: () => void;
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex <= text.length) {
          setDisplayedText(text.slice(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(interval);
          setIsComplete(true);
          onComplete?.();
        }
      }, 30); // Changed from 50ms to 30ms for faster text appearance

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timeout);
  }, [text, delay]);

  return (
    <ThemedText 
      style={[
        styles.welcomeText,
        isComplete && styles.welcomeTextComplete
      ]}
    >
      {displayedText}
    </ThemedText>
  );
};

const calculateBasalMetabolicRate = (
  age: number,
  heightFeet: number,
  heightInches: number,
  weightLbs: number,
  gender: 'male' | 'female'
): number => {
  // Convert height to cm and weight to kg
  const heightCm = ((heightFeet * 12) + heightInches) * 2.54;
  const weightKg = weightLbs * 0.453592;

  // Mifflin-St Jeor Equation
  if (gender === 'male') {
    return (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
  } else {
    return (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
  }
};

const calculateTDEE = (bmr: number, activityLevel: string): number => {
  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9
  };
  return Math.round(bmr * activityMultipliers[activityLevel as keyof typeof activityMultipliers]);
};

const getActivityDescription = (level: number): string => {
  switch (Math.round(level)) {
    case 1:
      return 'Little or no exercise';
    case 2:
      return 'Light exercise 1-3 times/week';
    case 3:
      return 'Moderate exercise 3-5 times/week';
    case 4:
      return 'Heavy exercise 6-7 times/week';
    case 5:
      return 'Very heavy exercise, physical job';
    default:
      return 'Select your activity level';
  }
};

const getActivityLevel = (level: number): string => {
  switch (Math.round(level)) {
    case 1:
      return 'sedentary';
    case 2:
      return 'light';
    case 3:
      return 'moderate';
    case 4:
      return 'active';
    case 5:
      return 'very_active';
    default:
      return 'sedentary';
  }
};

const introText = `Welcome to your fitness journey! All your data stays on your device.`;

export default function OnboardingScreen() {
  const [profileData, setProfileData] = useState<ProfileData>({
    name: '',
    initialCalories: 0,
    photo: undefined,
    age: null,
    gender: '',
    heightFeet: '',
    heightInches: '',
    weight: null,
    activityLevel: 0,
  });
  const [introStep, setIntroStep] = useState(0);
  const [showGetStarted, setShowGetStarted] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [showInput, setShowInput] = useState<'name' | 'age' | 'gender' | 'height' | 'weight' | 'activity' | 'stats' | 'photo' | null>(null);
  const [confirmedInputs, setConfirmedInputs] = useState<Set<string>>(new Set());
  const [sliderMoving, setSliderMoving] = useState(false);
  const [showPhotoButton, setShowPhotoButton] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const handleConfirm = (inputType: string) => {
    setConfirmedInputs(prev => new Set([...prev, inputType]));
  };

  const validateAndSetHeight = (text: string, type: 'feet' | 'inches') => {
    if (type === 'inches') {
      const num = parseInt(text);
      if (num > 11) {
        text = '11';
      }
    }
    setProfileData({ ...profileData, [type === 'feet' ? 'heightFeet' : 'heightInches']: text });
  };

  useEffect(() => {
    if (!sliderMoving) {
      // Snap to nearest integer when slider stops moving
      const roundedValue = Math.round(profileData.activityLevel);
      if (roundedValue !== profileData.activityLevel) {
        setProfileData(prev => ({ ...prev, activityLevel: roundedValue }));
      }
    }
  }, [sliderMoving, profileData.activityLevel]);

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera permissions to take progress photos!');
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
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
        setPhotoUri(photo.uri);
        
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

        setProfileData(prev => ({
          ...prev,
          photo: destination
        }));
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      alert('Failed to take photo. Please try again.');
    }
  };

  const renderIntroduction = () => {
    return (
      <ThemedView style={styles.introContainer}>
        <AnimatedText 
          text={introText}
          onComplete={() => setIntroStep(1)}
        />
        
        {introStep >= 1 && (
          <AnimatedText 
            text="I'm Eidu. Think of me as your fitness companion, minus the overenthusiastic high fives."
            delay={500}
            onComplete={() => setIntroStep(2)}
          />
        )}

        {introStep >= 2 && (
          <AnimatedText 
            text="I need some info to calculate your calories. Don't worry - I'm not collecting data. I can barely remember my own calculations."
            delay={500}
            onComplete={() => setShowGetStarted(true)}
          />
        )}

        {showGetStarted && (
          <Animated.View 
            style={styles.buttonContainer}
            entering={FadeIn.delay(500)}
          >
            <CustomButton
              title="Alright, let's do this"
              onPress={() => setIntroComplete(true)}
              style={styles.getStartedButton}
            />
          </Animated.View>
        )}
      </ThemedView>
    );
  };

  return (
    <>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        {!introComplete ? (
          renderIntroduction()
        ) : (
          <ThemedView style={styles.stepContainer}>
            {!confirmedInputs.has('name') && (
              <Animated.View 
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
              >
                <AnimatedText 
                  text="First up, what should I call you? Besides 'hey you'."
                  delay={200}
                  onComplete={() => setShowInput('name')}
                />
                
                {showInput === 'name' && (
                  <Animated.View entering={FadeIn.duration(150)}>
                    <TextInput
                      style={styles.input}
                      placeholder="Your Name"
                      value={profileData.name}
                      onChangeText={(text) => setProfileData({ ...profileData, name: text })}
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    />
                    {profileData.name && (
                      <CustomButton
                        title="Confirm"
                        onPress={() => handleConfirm('name')}
                        style={styles.confirmButton}
                      />
                    )}
                  </Animated.View>
                )}
              </Animated.View>
            )}

            {confirmedInputs.has('name') && !confirmedInputs.has('age') && (
              <Animated.View 
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
              >
                <AnimatedText 
                  text={`Nice to meet you, ${profileData.name}. How old are you?`}
                  delay={300}
                  onComplete={() => setShowInput('age')}
                />
                
                {showInput === 'age' && (
                  <Animated.View entering={FadeIn.duration(150)}>
                    <TextInput
                      style={styles.input}
                      placeholder="Age"
                      value={profileData.age?.toString() || ''}
                      onChangeText={(text) => {
                        const age = parseInt(text);
                        if (!isNaN(age) && age > 0 && age < 120) {
                          setProfileData({ ...profileData, age });
                        } else if (text === '') {
                          setProfileData({ ...profileData, age: null });
                        }
                      }}
                      keyboardType="numeric"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      maxLength={3}
                    />
                    {profileData.age && (
                      <CustomButton
                        title="Confirm"
                        onPress={() => handleConfirm('age')}
                        style={styles.confirmButton}
                      />
                    )}
                  </Animated.View>
                )}
              </Animated.View>
            )}

            {confirmedInputs.has('age') && !confirmedInputs.has('gender') && (
              <Animated.View 
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
              >
                <AnimatedText 
                  text="Biological sex? I need this for the metabolism math. Bodies are complicated like that."
                  delay={300}
                  onComplete={() => setShowInput('gender')}
                />
                
                {showInput === 'gender' && (
                  <Animated.View entering={FadeIn.duration(150)} style={styles.genderContainer}>
                    <ThemedView style={styles.genderButtonsContainer}>
                      <Pressable
                        onPress={() => {
                          setProfileData(prev => ({ ...prev, gender: 'male' }));
                          handleConfirm('gender');
                        }}
                        style={({ pressed, hovered }) => [
                          styles.genderButton,
                          (pressed || hovered) && styles.buttonHovered,
                          profileData.gender === 'male' && styles.genderButtonSelected
                        ]}>
                        <ThemedText style={styles.buttonText}>Male</ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setProfileData(prev => ({ ...prev, gender: 'female' }));
                          handleConfirm('gender');
                        }}
                        style={({ pressed, hovered }) => [
                          styles.genderButton,
                          (pressed || hovered) && styles.buttonHovered,
                          profileData.gender === 'female' && styles.genderButtonSelected
                        ]}>
                        <ThemedText style={styles.buttonText}>Female</ThemedText>
                      </Pressable>
                    </ThemedView>
                  </Animated.View>
                )}
              </Animated.View>
            )}

            {confirmedInputs.has('gender') && !confirmedInputs.has('height') && (
              <Animated.View 
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
              >
                <AnimatedText 
                  text="Height? And no, 'above average' isn't a measurement I can work with."
                  delay={300}
                  onComplete={() => setShowInput('height')}
                />
                
                {showInput === 'height' && (
                  <Animated.View entering={FadeIn.duration(150)}>
                    <ThemedView style={styles.heightContainer}>
                      <ThemedView style={styles.heightInput}>
                        <TextInput
                          style={styles.input}
                          placeholder="Feet"
                          value={profileData.heightFeet}
                          onChangeText={(text) => validateAndSetHeight(text, 'feet')}
                          keyboardType="numeric"
                          placeholderTextColor="rgba(255, 255, 255, 0.5)"
                          maxLength={1}
                        />
                      </ThemedView>
                      <ThemedView style={styles.heightInput}>
                        <TextInput
                          style={styles.input}
                          placeholder="Inches"
                          value={profileData.heightInches}
                          onChangeText={(text) => validateAndSetHeight(text, 'inches')}
                          keyboardType="numeric"
                          placeholderTextColor="rgba(255, 255, 255, 0.5)"
                          maxLength={2}
                        />
                      </ThemedView>
                    </ThemedView>
                    {profileData.heightFeet && profileData.heightInches && (
                      <CustomButton
                        title="Confirm"
                        onPress={() => handleConfirm('height')}
                        style={styles.confirmButton}
                      />
                    )}
                  </Animated.View>
                )}
              </Animated.View>
            )}

            {confirmedInputs.has('height') && !confirmedInputs.has('weight') && (
              <Animated.View 
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
              >
                <AnimatedText 
                  text="Current weight in pounds? Don't worry, I won't tell anyone. I'm physically incapable of gossip."
                  delay={300}
                  onComplete={() => setShowInput('weight')}
                />
                
                {showInput === 'weight' && (
                  <Animated.View entering={FadeIn.duration(150)}>
                    <TextInput
                      style={styles.input}
                      placeholder="Weight (lbs)"
                      value={profileData.weight?.toString() || ''}
                      onChangeText={(text) => {
                        const weight = parseInt(text);
                        if (!isNaN(weight) && weight > 0) {
                          setProfileData({ ...profileData, weight });
                        } else if (text === '') {
                          setProfileData({ ...profileData, weight: null });
                        }
                      }}
                      keyboardType="numeric"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    />
                    {profileData.weight && (
                      <CustomButton
                        title="Confirm"
                        onPress={() => handleConfirm('weight')}
                        style={styles.confirmButton}
                      />
                    )}
                  </Animated.View>
                )}
              </Animated.View>
            )}

            {confirmedInputs.has('weight') && !confirmedInputs.has('activity') && (
              <Animated.View 
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
              >
                <AnimatedText 
                  text="Activity level? Be honest. Netflix marathons don't count as cardio."
                  delay={300}
                  onComplete={() => setShowInput('activity')}
                />
                
                {showInput === 'activity' && (
                  <Animated.View entering={FadeIn.duration(150)} style={styles.activityContainer}>
                    <ThemedText style={styles.activityLabel}>
                      {getActivityDescription(profileData.activityLevel || 1)}
                    </ThemedText>
                    <View style={styles.activityButtonsContainer}>
                      {[1, 2, 3, 4, 5].map((level) => (
                        <Pressable
                          key={level}
                          onPress={() => {
                            setProfileData(prev => ({ ...prev, activityLevel: level }));
                          }}
                          style={({ pressed, hovered }) => [
                            styles.activityButton,
                            (pressed || hovered) && styles.buttonHovered,
                            profileData.activityLevel === level && styles.activityButtonSelected
                          ]}>
                          <ThemedText style={styles.activityButtonText}>{level}</ThemedText>
                        </Pressable>
                      ))}
                    </View>
                    <ThemedView style={styles.activityLabelsContainer}>
                      <ThemedText style={styles.activityLabelSmall}>Sedentary</ThemedText>
                      <ThemedText style={styles.activityLabelSmall}>Very Active</ThemedText>
                    </ThemedView>
                    <CustomButton
                      title="Confirm"
                      onPress={() => {
                        if (!profileData.gender || !profileData.age || !profileData.weight) return;
                        const bmr = calculateBasalMetabolicRate(
                          profileData.age,
                          parseInt(profileData.heightFeet),
                          parseInt(profileData.heightInches),
                          profileData.weight,
                          profileData.gender
                        );
                        const tdee = calculateTDEE(bmr, getActivityLevel(profileData.activityLevel));
                        setProfileData(prev => ({
                          ...prev,
                          initialCalories: tdee
                        }));
                        handleConfirm('activity');
                      }}
                      style={styles.confirmButton}
                    />
                  </Animated.View>
                )}
              </Animated.View>
            )}

            {confirmedInputs.has('activity') && !confirmedInputs.has('stats') && (
              <Animated.View 
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
              >
                <AnimatedText 
                  text="After some intense calculating (and a brief existential crisis), here's what I've figured out:"
                  delay={300}
                  onComplete={() => setShowInput('stats')}
                />
                
                {showInput === 'stats' && (
                  <Animated.View entering={FadeIn.duration(150)} style={styles.statsContainer}>
                    <ThemedText style={styles.statsText}>
                      Your estimated daily calorie maintenance is{' '}
                      <ThemedText style={[styles.statsText, { color: '#64D2FF' }]}>
                        {profileData.initialCalories}
                      </ThemedText>
                      {' '}calories
                    </ThemedText>
                    <ThemedText style={[styles.statsText, { opacity: 0.7 }]}>
                      That's how many calories you need to maintain your weight.
                    </ThemedText>
                    <CustomButton
                      title="Continue"
                      onPress={() => {
                        handleConfirm('stats');
                        setShowInput('photo');
                      }}
                      style={styles.confirmButton}
                    />
                  </Animated.View>
                )}
              </Animated.View>
            )}

            {confirmedInputs.has('stats') && !confirmedInputs.has('photo') && (
              <Animated.View 
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
                style={styles.photoUploadContainer}
              >
                <AnimatedText 
                  text="Now, let's take a progress photo. The scale can be misleading - water weight, muscle gain, and other factors can mask fat loss. We'll use photos to track your actual progress."
                  delay={300}
                  onComplete={() => setShowPhotoButton(true)}
                />
                
                {showPhotoButton && (
                  <Animated.View 
                    entering={FadeIn.duration(300)}
                    style={styles.photoButtonContainer}
                  >
                    <ThemedText style={[styles.statsText, { marginTop: 24, marginBottom: 24 }]}>
                      Take a photo in good lighting, wearing minimal clothing. This will be your starting point.
                    </ThemedText>
                    {photoUri ? (
                      <View style={styles.photoPreviewContainer}>
                        <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                        <CustomButton
                          title="Retake Photo"
                          onPress={takePhoto}
                          style={styles.retakeButton}
                        />
                      </View>
                    ) : (
                      <CustomButton
                        title="Take Progress Photo"
                        onPress={takePhoto}
                        style={styles.confirmButton}
                      />
                    )}
                  </Animated.View>
                )}

                {photoUri && (
                  <Animated.View 
                    entering={FadeIn.duration(300)}
                    style={styles.continueButtonContainer}
                  >
                    <CustomButton
                      title="Continue"
                      onPress={async () => {
                        await Promise.all([
                          AsyncStorage.setItem('userTDEE', profileData.initialCalories.toString()),
                          AsyncStorage.setItem('onboardingComplete', 'true'),
                          AsyncStorage.setItem('userGender', profileData.gender),
                          AsyncStorage.setItem('initialProgressPhoto', profileData.photo || ''),
                          AsyncStorage.setItem('userName', profileData.name)
                        ]);
                        router.replace('/(tabs)/profile');
                      }}
                      style={styles.confirmButton}
                    />
                  </Animated.View>
                )}
              </Animated.View>
            )}
          </ThemedView>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    
  },
  introContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  welcomeText: {
    fontSize: 24,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 32,
    color: '#FFFFFF',
  },
  welcomeTextComplete: {
    opacity: 1,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 32,
  },
  getStartedButton: {
    backgroundColor: '#2C2C2E',
    paddingVertical: 16,
  },
  stepContainer: {
    padding: 20,
    gap: 16,
    backgroundColor: '#121212',
  },
  input: {
    height: 50,
    fontSize: 16,
    paddingHorizontal: 16,
    textAlign: 'center',
    alignSelf: 'center',
    width: '80%',
    marginTop: 24,
    color: '#FFFFFF',
    backgroundColor: '#121212',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  picker: {
    height: 50,
    marginBottom: Platform.OS === 'ios' ? 0 : 16,
    width: '80%',
    alignSelf: 'center',
    marginTop: 24,
    color: '#FFFFFF',
    backgroundColor: '#121212',
  },
  pickerItem: {
    color: '#FFFFFF',
    backgroundColor: '#121212',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2C2C2E',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    marginTop: 8,
    marginBottom: 16,
  } as const,
  heightContainer: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    width: '80%',
    alignSelf: 'center',
    marginTop: 24,
  },
  heightInput: {
    flex: 1,
    backgroundColor: '#121212',
  },
  statsContainer: {
    padding: 16,
    backgroundColor: '#121212',
    borderRadius: 8,
    marginTop: 24,
    width: '80%',
    alignSelf: 'center',
  },
  statsText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  activityContainer: {
    width: '80%',
    alignSelf: 'center',
    marginTop: 24,
  },
  activityLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  activityButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  activityButton: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityButtonSelected: {
    backgroundColor: '#2C2C2E',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  activityButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  activityLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 16,
  },
  activityLabelSmall: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.7,
  },
  genderContainer: {
    width: '80%',
    alignSelf: 'center',
    marginTop: 24,
  },
  genderButtonsContainer: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  genderButton: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  genderButtonSelected: {
    backgroundColor: '#2C2C2E',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  tickContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    marginBottom: -10,
  },
  tickMark: {
    width: 2,
    height: 10,
    backgroundColor: '#2C2C2E',
    borderRadius: 1,
  },
  tickMarkActive: {
    backgroundColor: '#121212',
  },
  buttonHovered: {
    backgroundColor: '#3C3C3E',
  },
  photoUploadContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  photoButtonContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
  },
  photoPreviewContainer: {
    width: '100%',
    alignItems: 'center',
  },
  photoPreview: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  retakeButton: {
    backgroundColor: '#2C2C2E',
    marginTop: 8,
  },
  continueButtonContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 24,
  },
});