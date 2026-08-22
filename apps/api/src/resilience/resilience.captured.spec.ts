import { isCapturedHour } from './resilience.captured';
import { normalizeHours } from './resilience.service';

describe('captured historical hour', () => {
  it('recognizes the captured FortyGuard observation hour', () => {
    expect(isCapturedHour('2024-07-15T14:00:00Z')).toBe(true);
    expect(isCapturedHour('2024-07-16T14:00:00Z')).toBe(false);
  });

  it('rejects minutes and future-invented hours', () => {
    expect(() => normalizeHours(['2024-07-15T14:30:00Z'])).toThrow(
      /whole UTC hour/,
    );
  });
});
