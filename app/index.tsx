import { useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  useEffect(() => {
    // Temporary: Clear AsyncStorage to force fresh start
    AsyncStorage.clear().then(() => {
      // After clearing, go to onboarding
      router.replace('/onboarding');
    });
    
    // Original code (commented out for now)
    /*
    AsyncStorage.getItem('onboardingComplete')
      .then((value) => {
        if (value === 'true') {
          // If onboarding is complete, go to the main app
          router.replace('/(tabs)');
        } else {
          // If onboarding is not complete, go to onboarding
          router.replace('/onboarding');
        }
      });
    */
  }, []);

  return null;
} 