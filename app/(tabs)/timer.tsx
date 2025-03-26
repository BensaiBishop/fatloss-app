import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Pressable, ViewStyle, ScrollView, SafeAreaView, Animated, Dimensions } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import CustomButton from '@/components/ui/CustomButton';
import { LinearGradient } from 'expo-linear-gradient';

interface Split {
  time: number;
  splitTime: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_SPACING = SCREEN_WIDTH * 0.04; // 4% of screen width
const BASE_FONT_SIZE = SCREEN_WIDTH * 0.035; // 3.5% of screen width

export default function TimerScreen() {
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [splits, setSplits] = useState<Split[]>([]);
  const [lastSplitTime, setLastSplitTime] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [isScrollable, setIsScrollable] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const topGradientOpacity = useRef(new Animated.Value(0)).current;
  const bottomGradientOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setTime(prevTime => prevTime + 10); // Update every 10ms for smooth display
      }, 10);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleScroll = (event: any) => {
    const offset = event.nativeEvent.contentOffset.y;
    setScrollOffset(offset);
  };

  const showTopGradient = scrollOffset > 0;
  const showBottomGradient = scrollOffset < contentHeight - 240;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(topGradientOpacity, {
        toValue: showTopGradient ? 1 : 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(bottomGradientOpacity, {
        toValue: showBottomGradient ? 1 : 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [showTopGradient, showBottomGradient, topGradientOpacity, bottomGradientOpacity]);

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(2, '0')}`;
  };

  const handleStartStop = () => {
    setIsRunning(!isRunning);
  };

  const handleSplitReset = () => {
    if (isRunning) {
      // Split functionality
      const splitTime = time - lastSplitTime;
      setSplits(prev => [...prev, { time, splitTime }]);
      setLastSplitTime(time);
    } else {
      // Reset functionality
      setIsRunning(false);
      setTime(0);
      setSplits([]);
      setLastSplitTime(0);
    }
  };

  const handleContentSizeChange = (width: number, height: number) => {
    setContentHeight(height);
    setIsScrollable(height > 240);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <View style={styles.contentWrapper}>
          <View style={styles.mainContent}>
            <View style={styles.clockFace}>
              <View style={styles.clockBorder}>
                <ThemedText style={styles.timerText}>
                  {formatTime(time)}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.splitsContainer}>
            <View style={styles.splitsHeader}>
              <ThemedText style={[styles.headerText, styles.splitNumber]}>#</ThemedText>
              <ThemedText style={[styles.headerText, styles.splitTime]}>Split</ThemedText>
              <ThemedText style={[styles.headerText, styles.totalTime]}>Total</ThemedText>
            </View>
            <View style={styles.splitsListContainer}>
              <ScrollView 
                ref={scrollViewRef}
                style={styles.splitsList}
                showsVerticalScrollIndicator={false}
                bounces={true}
                decelerationRate="normal"
                snapToInterval={40}
                snapToAlignment="start"
                onContentSizeChange={handleContentSizeChange}
                onScroll={handleScroll}
                scrollEventThrottle={16}
              >
                {[...splits].reverse().map((split, index) => (
                  <View 
                    key={splits.length - 1 - index} 
                    style={[
                      styles.splitRow,
                      (splits.length - 1 - index) % 2 === 0 ? styles.splitRowEven : styles.splitRowOdd
                    ]}
                  >
                    <ThemedText style={styles.splitNumber}>{splits.length - index}</ThemedText>
                    <ThemedText style={styles.splitTime}>{formatTime(split.splitTime)}</ThemedText>
                    <ThemedText style={styles.totalTime}>{formatTime(split.time)}</ThemedText>
                  </View>
                ))}
              </ScrollView>
              {isScrollable && splits.length > 0 && (
                <>
                  <Animated.View style={[styles.fadeGradient, styles.topGradient, { opacity: topGradientOpacity }]}>
                    <LinearGradient
                      colors={['#121212', 'rgba(18, 18, 18, 0.8)', 'transparent']}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                  <Animated.View style={[styles.fadeGradient, styles.bottomGradient, { opacity: bottomGradientOpacity }]}>
                    <LinearGradient
                      colors={['transparent', 'rgba(18, 18, 18, 0.8)', '#121212']}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.buttonWrapper}>
          <View style={styles.buttonContainer}>
            <CustomButton
              title={isRunning ? "Split" : "Reset"}
              onPress={handleSplitReset}
              style={[styles.button, isRunning ? styles.splitButton : styles.resetButton] as unknown as ViewStyle}
              textStyle={styles.buttonText}
            />
            <CustomButton
              title={isRunning ? "Stop" : "Start"}
              onPress={handleStartStop}
              style={[styles.button, isRunning ? styles.stopButton : styles.startButton] as unknown as ViewStyle}
              textStyle={styles.buttonText}
            />
          </View>
        </View>
      </ThemedView>
    </SafeAreaView>
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
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'flex-start',
    maxWidth: SCREEN_WIDTH * 0.95,
    alignSelf: 'center',
    width: '100%',
    paddingTop: SCREEN_HEIGHT * 0.02,
  },
  mainContent: {
    alignItems: 'center',
    marginBottom: BASE_SPACING * 2,
  },
  clockFace: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clockBorder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: BASE_SPACING,
  },
  timerText: {
    fontSize: BASE_FONT_SIZE * 5,
    fontWeight: '300',
    includeFontPadding: false,
    textAlignVertical: 'center',
    color: '#FFFFFF',
    lineHeight: SCREEN_HEIGHT * 0.15,
  },
  splitsContainer: {
    flex: 1,
    backgroundColor: '#121212',
    borderRadius: BASE_SPACING * 0.8,
    overflow: 'hidden',
    width: '100%',
  },
  splitsHeader: {
    flexDirection: 'row',
    paddingVertical: BASE_SPACING * 0.8,
    paddingHorizontal: BASE_SPACING,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
    backgroundColor: '#121212',
  },
  headerText: {
    fontSize: BASE_FONT_SIZE * 1,
    fontWeight: '400',
    opacity: 0.7,
  },
  splitsListContainer: {
    flex: 1,
  },
  splitsList: {
    flexGrow: 1,
  },
  splitRow: {
    flexDirection: 'row',
    paddingVertical: BASE_SPACING * 0.6,
    paddingHorizontal: BASE_SPACING,
    backgroundColor: '#121212',
  },
  splitRowEven: {
    backgroundColor: '#121212',
  },
  splitRowOdd: {
    backgroundColor: '#1A1A1A',
  },
  splitNumber: {
    width: SCREEN_WIDTH * 0.1,
    fontSize: BASE_FONT_SIZE * 1.1,
    textAlign: 'left',
  },
  splitTime: {
    flex: 1,
    fontSize: BASE_FONT_SIZE * 1.1,
    textAlign: 'center',
  },
  totalTime: {
    flex: 1,
    fontSize: BASE_FONT_SIZE * 1.1,
    textAlign: 'right',
  },
  buttonWrapper: {
    paddingVertical: BASE_SPACING,
    backgroundColor: '#121212',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: BASE_SPACING * 2,
    width: '100%',
    paddingHorizontal: BASE_SPACING,
    maxWidth: SCREEN_WIDTH * 0.9,
    alignSelf: 'center',
  },
  button: {
    flex: 1,
    minWidth: SCREEN_WIDTH * 0.4,
    height: SCREEN_HEIGHT * 0.065,
    borderRadius: SCREEN_HEIGHT * 0.0325,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: BASE_FONT_SIZE * 1.2,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  splitButton: {
    backgroundColor: '#2196F3',
  },
  resetButton: {
    backgroundColor: '#FF9800',
  },
  fadeGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.05, // 5% of screen height
    borderRadius: BASE_SPACING * 0.8,
    overflow: 'hidden',
  },
  topGradient: {
    top: 0,
  },
  bottomGradient: {
    bottom: 0,
  },
}); 