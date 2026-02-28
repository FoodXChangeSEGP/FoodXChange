import React, { useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

interface Props {
  children: React.ReactNode;
}

export function AnimatedTabWrapper({ children }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useFocusEffect(
    useCallback(() => {
      // Reset to initial values before animating
      opacity.setValue(0);
      translateY.setValue(14);

      const animation = Animated.parallel([
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
      ]);

      animation.start();

      return () => {
        animation.stop();
      };
    }, [opacity, translateY])
  );

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

export default AnimatedTabWrapper;
