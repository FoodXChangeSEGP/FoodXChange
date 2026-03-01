import React from 'react';
import { CookScreen } from '../src/screens';
import { AnimatedTabWrapper } from '../src/components/ui';

export default function CookTab() {
  return (
    <AnimatedTabWrapper key="cook">
      <CookScreen />
    </AnimatedTabWrapper>
  );
}
