import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Dimensions } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import CustomButton from '@/components/ui/CustomButton';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import MapView, { Polyline } from 'react-native-maps';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_SPACING = SCREEN_WIDTH * 0.04;

interface RunStats {
  distance: number;
  duration: number;
  pace: number;
  isTracking: boolean;
  currentSpeed: number;
  coordinates: Location.LocationObject[];
}

export default function RunScreen() {
  const [stats, setStats] = useState<RunStats>({
    distance: 0,
    duration: 0,
    pace: 0,
    isTracking: false,
    currentSpeed: 0,
    coordinates: [],
  });

  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [region, setRegion] = useState({
    latitude: 0,
    longitude: 0,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    })();
  }, []);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let timerInterval: NodeJS.Timeout | null = null;

    const startTracking = async () => {
      if (stats.isTracking && locationPermission) {
        // Start location updates
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (location) => {
            setStats(prev => {
              const newCoordinates = [...prev.coordinates, location];
              const newDistance = calculateDistance(newCoordinates);
              const newDuration = prev.duration + 1;
              const newPace = newDistance > 0 ? (newDuration / (newDistance / 1000)) : 0;

              // Update map region to follow current location
              setRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              });

              return {
                ...prev,
                coordinates: newCoordinates,
                distance: newDistance,
                duration: newDuration,
                pace: newPace,
                currentSpeed: location.coords.speed || 0,
              };
            });
          }
        );

        // Start timer
        timerInterval = setInterval(() => {
          setStats(prev => ({
            ...prev,
            duration: prev.duration + 1,
          }));
        }, 1000);
      }
    };

    startTracking();

    // Cleanup
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [stats.isTracking, locationPermission]);

  const calculateDistance = (coordinates: Location.LocationObject[]): number => {
    if (coordinates.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < coordinates.length; i++) {
      const prev = coordinates[i - 1].coords;
      const curr = coordinates[i].coords;
      totalDistance += calculateDistanceBetweenPoints(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );
    }
    return totalDistance;
  };

  const calculateDistanceBetweenPoints = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number) => {
    return (meters / 1000).toFixed(2);
  };

  const formatPace = (secondsPerKm: number) => {
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.floor(secondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatSpeed = (speed: number) => {
    return (speed * 3.6).toFixed(1); // Convert m/s to km/h
  };

  const toggleTracking = () => {
    if (!locationPermission) {
      alert('Location permission is required to track your run');
      return;
    }

    setStats(prev => ({
      ...prev,
      isTracking: !prev.isTracking,
      ...(prev.isTracking ? {
        distance: 0,
        duration: 0,
        pace: 0,
        coordinates: [],
        currentSpeed: 0,
      } : {}),
    }));
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <ThemedText style={styles.statLabel}>Distance</ThemedText>
          <ThemedText style={styles.statValue}>{formatDistance(stats.distance)} km</ThemedText>
        </View>
        
        <View style={styles.statCard}>
          <ThemedText style={styles.statLabel}>Duration</ThemedText>
          <ThemedText style={styles.statValue}>{formatDuration(stats.duration)}</ThemedText>
        </View>
        
        <View style={styles.statCard}>
          <ThemedText style={styles.statLabel}>Pace</ThemedText>
          <ThemedText style={styles.statValue}>{formatPace(stats.pace)} /km</ThemedText>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          region={region}
          showsUserLocation
          followsUserLocation
        >
          {stats.coordinates.length > 1 && (
            <Polyline
              coordinates={stats.coordinates.map(coord => ({
                latitude: coord.coords.latitude,
                longitude: coord.coords.longitude,
              }))}
              strokeColor="#4CAF50"
              strokeWidth={3}
            />
          )}
        </MapView>
        {stats.isTracking && (
          <View style={styles.speedContainer}>
            <ThemedText style={styles.speedText}>
              Current Speed: {formatSpeed(stats.currentSpeed)} km/h
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.controlsContainer}>
        <CustomButton
          title={stats.isTracking ? "Stop Run" : "Start Run"}
          onPress={toggleTracking}
          style={{
            ...styles.controlButton,
            backgroundColor: stats.isTracking ? '#F44336' : '#4CAF50'
          }}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: BASE_SPACING,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: BASE_SPACING * 2,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    padding: BASE_SPACING,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: BASE_SPACING / 2,
  },
  statLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.7,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    marginBottom: BASE_SPACING * 2,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  speedContainer: {
    position: 'absolute',
    bottom: BASE_SPACING,
    left: BASE_SPACING,
    right: BASE_SPACING,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: BASE_SPACING,
    borderRadius: 8,
    alignItems: 'center',
  },
  speedText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  controlsContainer: {
    paddingBottom: BASE_SPACING * 2,
  },
  controlButton: {
    width: '100%',
    maxWidth: 280,
    alignSelf: 'center',
  },
}); 