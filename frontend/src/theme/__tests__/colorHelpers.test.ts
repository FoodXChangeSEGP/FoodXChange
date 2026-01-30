/**
 * Tests for theme color helper functions.
 * 
 * These functions provide consistent color mapping for health scores
 * across all components.
 */

import { 
  getNovaColor, 
  getNutriScoreColor, 
  getTrafficLightColor, 
  colors,
  trafficLightColors 
} from '../index';

describe('getNovaColor', () => {
  it('returns green for NOVA 1 (unprocessed)', () => {
    expect(getNovaColor(1)).toBe(colors.nova[1]);
  });

  it('returns yellow for NOVA 2 (processed ingredients)', () => {
    expect(getNovaColor(2)).toBe(colors.nova[2]);
  });

  it('returns orange for NOVA 3 (processed)', () => {
    expect(getNovaColor(3)).toBe(colors.nova[3]);
  });

  it('returns red for NOVA 4 (ultra-processed)', () => {
    expect(getNovaColor(4)).toBe(colors.nova[4]);
  });

  it('returns gray for null', () => {
    expect(getNovaColor(null)).toBe(colors.neutral.gray);
  });

  it('returns gray for invalid score', () => {
    expect(getNovaColor(5)).toBe(colors.neutral.gray);
    expect(getNovaColor(0)).toBe(colors.neutral.gray);
  });
});

describe('getNutriScoreColor', () => {
  it('returns dark green for Nutri-Score A', () => {
    expect(getNutriScoreColor('A')).toBe(colors.nutriScore.A);
    expect(getNutriScoreColor('a')).toBe(colors.nutriScore.A);
  });

  it('returns light green for Nutri-Score B', () => {
    expect(getNutriScoreColor('B')).toBe(colors.nutriScore.B);
    expect(getNutriScoreColor('b')).toBe(colors.nutriScore.B);
  });

  it('returns yellow for Nutri-Score C', () => {
    expect(getNutriScoreColor('C')).toBe(colors.nutriScore.C);
    expect(getNutriScoreColor('c')).toBe(colors.nutriScore.C);
  });

  it('returns orange for Nutri-Score D', () => {
    expect(getNutriScoreColor('D')).toBe(colors.nutriScore.D);
    expect(getNutriScoreColor('d')).toBe(colors.nutriScore.D);
  });

  it('returns red for Nutri-Score E', () => {
    expect(getNutriScoreColor('E')).toBe(colors.nutriScore.E);
    expect(getNutriScoreColor('e')).toBe(colors.nutriScore.E);
  });

  it('returns gray for null', () => {
    expect(getNutriScoreColor(null)).toBe(colors.neutral.gray);
  });

  it('returns gray for empty string', () => {
    expect(getNutriScoreColor('')).toBe(colors.neutral.gray);
  });

  it('returns gray for unknown grade', () => {
    expect(getNutriScoreColor('unknown')).toBe(colors.neutral.gray);
    expect(getNutriScoreColor('X')).toBe(colors.neutral.gray);
  });
});

describe('getTrafficLightColor', () => {
  it('returns green color for green level', () => {
    expect(getTrafficLightColor('green')).toBe(trafficLightColors.green);
  });

  it('returns amber color for amber level', () => {
    expect(getTrafficLightColor('amber')).toBe(trafficLightColors.amber);
  });

  it('returns red color for red level', () => {
    expect(getTrafficLightColor('red')).toBe(trafficLightColors.red);
  });

  it('returns unknown (lightGray) color for unknown level', () => {
    expect(getTrafficLightColor('unknown')).toBe(trafficLightColors.unknown);
  });

  it('returns unknown color for invalid level', () => {
    expect(getTrafficLightColor('invalid')).toBe(trafficLightColors.unknown);
    expect(getTrafficLightColor('')).toBe(trafficLightColors.unknown);
  });
});
