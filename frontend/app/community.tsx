import React from 'react';
import { CommunityScreen } from '../src/screens';
import { AnimatedTabWrapper } from '../src/components/ui';

export default function CommunityTab() {
  return (
    <AnimatedTabWrapper key="community">
      <CommunityScreen />
    </AnimatedTabWrapper>
  );
}
