/**
 * Home Tab - Entry Point
 */

import React from 'react';
import { HomeScreen } from '../src/screens';
import { AnimatedTabWrapper } from '../src/components/ui';

export default function HomeTab() {
  return (
    <AnimatedTabWrapper key="index">
      <HomeScreen />
    </AnimatedTabWrapper>
  );
}
