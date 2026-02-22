import React from 'react';
import { CompareScreen } from '../src/screens';
import { AnimatedTabWrapper } from '../src/components/ui';

export default function CompareTab() {
  return (
    <AnimatedTabWrapper key="compare">
      <CompareScreen />
    </AnimatedTabWrapper>
  );
}
