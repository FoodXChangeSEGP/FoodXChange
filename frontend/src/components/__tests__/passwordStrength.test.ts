// Tests for the password strength logic used in PasswordStrengthIndicator.

interface StrengthCheck {
  label: string;
  met: boolean;
}

type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

function getStrengthChecks(password: string): StrengthCheck[] {
  return [
    { label: 'At least 8 characters',     met: password.length >= 8 },
    { label: 'Contains uppercase letter',  met: /[A-Z]/.test(password) },
    { label: 'Contains lowercase letter',  met: /[a-z]/.test(password) },
    { label: 'Contains a number',          met: /\d/.test(password) },
    { label: 'Contains special character', met: /[^A-Za-z0-9]/.test(password) },
  ];
}

function getStrengthLevel(checks: StrengthCheck[]): StrengthLevel {
  const metCount = checks.filter((c) => c.met).length;
  if (metCount <= 1) return 'weak';
  if (metCount <= 2) return 'fair';
  if (metCount <= 3) return 'good';
  return 'strong';
}

describe('getStrengthChecks', () => {
  it('returns 5 checks', () => {
    expect(getStrengthChecks('Password1!')).toHaveLength(5);
  });

  it('length check: passes at 8 chars', () => {
    expect(getStrengthChecks('aaaaaaaa')[0].met).toBe(true);
    expect(getStrengthChecks('aaaaaaa')[0].met).toBe(false);
  });

  it('uppercase check', () => {
    expect(getStrengthChecks('Password')[1].met).toBe(true);
    expect(getStrengthChecks('password')[1].met).toBe(false);
  });

  it('lowercase check', () => {
    expect(getStrengthChecks('password')[2].met).toBe(true);
    expect(getStrengthChecks('PASSWORD')[2].met).toBe(false);
  });

  it('number check', () => {
    expect(getStrengthChecks('pass1')[3].met).toBe(true);
    expect(getStrengthChecks('password')[3].met).toBe(false);
  });

  it('special character check', () => {
    expect(getStrengthChecks('pass!')[4].met).toBe(true);
    expect(getStrengthChecks('pass@')[4].met).toBe(true);
    expect(getStrengthChecks('pass#')[4].met).toBe(true);
    expect(getStrengthChecks('password')[4].met).toBe(false);
    expect(getStrengthChecks('password1')[4].met).toBe(false);
  });

  it('all checks pass for strong password', () => {
    const checks = getStrengthChecks('StrongPass1!');
    expect(checks.every((c) => c.met)).toBe(true);
  });

  it('no checks pass for empty string', () => {
    const checks = getStrengthChecks('');
    expect(checks.every((c) => !c.met)).toBe(true);
  });
});

describe('getStrengthLevel', () => {
  it('0 criteria met → weak', () => {
    expect(getStrengthLevel(getStrengthChecks(''))).toBe('weak');
  });

  it('1 criterion met → weak', () => {
    // Only lowercase letters
    expect(getStrengthLevel(getStrengthChecks('a'))).toBe('weak');
  });

  it('2 criteria met → fair', () => {
    // lowercase + uppercase, short, no number, no special
    expect(getStrengthLevel(getStrengthChecks('Aa'))).toBe('fair');
  });

  it('3 criteria met → good', () => {
    // lowercase + uppercase + length ≥ 8
    expect(getStrengthLevel(getStrengthChecks('Aaaaaaaa'))).toBe('good');
  });

  it('4 criteria met → strong', () => {
    // lowercase + uppercase + number + length ≥ 8
    expect(getStrengthLevel(getStrengthChecks('Aaaaaaaa1'))).toBe('strong');
  });

  it('all 5 criteria met → strong', () => {
    expect(getStrengthLevel(getStrengthChecks('StrongPass1!'))).toBe('strong');
  });
});

describe('strength level edge cases', () => {
  it('exactly 8 chars passes length check', () => {
    const checks = getStrengthChecks('aaaaaaaa');
    expect(checks[0].met).toBe(true);
  });

  it('7 chars fails length check', () => {
    const checks = getStrengthChecks('aaaaaaa');
    expect(checks[0].met).toBe(false);
  });

  it('spaces count as special characters', () => {
    const checks = getStrengthChecks('pass word');
    expect(checks[4].met).toBe(true);
  });

  it('unicode special chars count', () => {
    const checks = getStrengthChecks('passé');
    expect(checks[4].met).toBe(true);
  });

  it('digits in special char check do not count', () => {
    const checks = getStrengthChecks('12345678');
    expect(checks[4].met).toBe(false);
  });
});
