import React, { useCallback, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { usePathname } from 'expo-router';

interface Props {
  children: React.ReactNode;
}

export function AnimatedTabWrapper({ children }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const pathname = usePathname();

  const runAnimation = useCallback(() => {
    opacity.setValue(0);
    translateY.setValue(14);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 230,
        useNativeDriver: false,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 230,
        useNativeDriver: false,
      }),
    ]).start();
  }, [opacity, translateY]);

  // Runs on mount + every time the active route changes (i.e. tab switch)
  useEffect(() => {
    runAnimation();
  }, [pathname, runAnimation]);

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

export default AnimatedTabWrapper;
