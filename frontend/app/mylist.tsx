/**
 * My List Tab
 */

import React from 'react';
import { MyListScreen } from '../src/screens';
import { AnimatedTabWrapper } from '../src/components/ui';

export default function MyListTab() {
  return (
    <AnimatedTabWrapper>
      <MyListScreen />
    </AnimatedTabWrapper>
  );
}
