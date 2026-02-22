import React from 'react';
import { PantryScreen } from '../src/screens';
import { AnimatedTabWrapper } from '../src/components/ui';

export default function CartTab() {
  return (
    <AnimatedTabWrapper key="cart">
      <PantryScreen />
    </AnimatedTabWrapper>
  );
}
