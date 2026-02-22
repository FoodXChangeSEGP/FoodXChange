import React from 'react';
import { FoodXScreen } from '../src/screens';
import { AnimatedTabWrapper } from '../src/components/ui';

export default function SearchTab() {
  return (
    <AnimatedTabWrapper key="search">
      <FoodXScreen />
    </AnimatedTabWrapper>
  );
}
