import { describe, it, expect, test } from 'vitest';
import type { SUniversalPColumnId } from '@platforma-sdk/model';
import {
  SingleColumnFilters,
  DoubleColumnFilters,
  IsNAUI,
  IsNotNAUI,
  LessThenUI,
  LessThenOrEqualUI,
  GreaterThenUI,
  GreaterThenOrEqualUI,
  TopNUI,
  TopCumulativeShareUI,
  BetweenUI,
  CompareColumnsUI,
} from './__filters_ui';

const dummyColumnId = 'dummy_column' as SUniversalPColumnId;
const dummyColumnId2 = 'dummy_column_2' as SUniversalPColumnId;

describe.skip('Filter UI Helpers', () => {
  test.each(SingleColumnFilters)('$name filter creation and guard', ({ create, guard }) => {
    const filter = create(dummyColumnId);
    expect(guard(filter)).toBe(true);
  });

  describe('IsNAUI', () => {
    it('should handle column getter', () => {
      const filter = IsNAUI.create(dummyColumnId);
      expect(IsNAUI.column.get(filter)).toBe(dummyColumnId);
      expect(IsNAUI.guard(filter)).toBe(true);
    });
  });

  describe('IsNotNAUI', () => {
    it('should handle column getter', () => {
      const filter = IsNotNAUI.create(dummyColumnId);
      expect(IsNotNAUI.column.get(filter)).toBe(dummyColumnId);
      expect(IsNotNAUI.guard(filter)).toBe(true);
    });
  });

  describe('LessThenUI', () => {
    it('should handle column/threshold getters/setters', () => {
      let filter = LessThenUI.create(dummyColumnId, 10);
      expect(LessThenUI.column.get(filter)).toBe(dummyColumnId);
      expect(LessThenUI.threshold.get(filter)).toBe(10);
      expect(LessThenUI.guard(filter)).toBe(true);

      filter = LessThenUI.threshold.set(filter, 20);
      expect(LessThenUI.threshold.get(filter)).toBe(20);
    });
  });

  describe('LessThenOrEqualUI', () => {
    it('should handle column/threshold getters/setters', () => {
      let filter = LessThenOrEqualUI.create(dummyColumnId, 15);
      expect(LessThenOrEqualUI.column.get(filter)).toBe(dummyColumnId);
      expect(LessThenOrEqualUI.threshold.get(filter)).toBe(15);
      expect(LessThenOrEqualUI.guard(filter)).toBe(true);

      filter = LessThenOrEqualUI.threshold.set(filter, 25);
      expect(LessThenOrEqualUI.threshold.get(filter)).toBe(25);
    });
  });

  describe('GreaterThenUI', () => {
    it('should handle column/threshold getters/setters', () => {
      let filter = GreaterThenUI.create(dummyColumnId, 5);
      expect(GreaterThenUI.column.get(filter)).toBe(dummyColumnId);
      expect(GreaterThenUI.threshold.get(filter)).toBe(5);
      expect(GreaterThenUI.guard(filter)).toBe(true);

      filter = GreaterThenUI.threshold.set(filter, 8);
      expect(GreaterThenUI.threshold.get(filter)).toBe(8);
    });
  });

  describe('GreaterThenOrEqualUI', () => {
    it('should handle column/threshold getters/setters', () => {
      let filter = GreaterThenOrEqualUI.create(dummyColumnId, 12);
      expect(GreaterThenOrEqualUI.column.get(filter)).toBe(dummyColumnId);
      expect(GreaterThenOrEqualUI.threshold.get(filter)).toBe(12);
      expect(GreaterThenOrEqualUI.guard(filter)).toBe(true);

      filter = GreaterThenOrEqualUI.threshold.set(filter, 18);
      expect(GreaterThenOrEqualUI.threshold.get(filter)).toBe(18);
    });
  });

  describe('TopNUI', () => {
    it('should handle column/n getters/setters', () => {
      let filter = TopNUI.create(dummyColumnId, 50);
      expect(TopNUI.column.get(filter)).toBe(dummyColumnId);
      expect(TopNUI.n.get(filter)).toBe(50);
      expect(TopNUI.guard(filter)).toBe(true);

      filter = TopNUI.n.set(filter, 100);
      expect(TopNUI.n.get(filter)).toBe(100);
    });
  });

  describe('TopCumulativeShareUI', () => {
    it('should handle column/share getters/setters', () => {
      let filter = TopCumulativeShareUI.create(dummyColumnId, 0.8);
      expect(TopCumulativeShareUI.column.get(filter)).toBe(dummyColumnId);
      expect(TopCumulativeShareUI.share.get(filter)).toBe(0.8);
      expect(TopCumulativeShareUI.guard(filter)).toBe(true);

      filter = TopCumulativeShareUI.share.set(filter, 0.95);
      expect(TopCumulativeShareUI.share.get(filter)).toBe(0.95);
    });
  });

  describe('BetweenUI', () => {
    it('should handle column/min/max/inclusive getters/setters', () => {
      let filter = BetweenUI.create(dummyColumnId, 10, 20, true, true);
      expect(BetweenUI.guard(filter)).toBe(true);
      expect(BetweenUI.column.get(filter)).toBe(dummyColumnId);
      expect(BetweenUI.min.get(filter)).toBe(10);
      expect(BetweenUI.max.get(filter)).toBe(20);
      expect(BetweenUI.minInclusive.get(filter)).toBe(true);
      expect(BetweenUI.maxInclusive.get(filter)).toBe(true);

      // Test setters
      filter = BetweenUI.min.set(filter, 12);
      expect(BetweenUI.min.get(filter)).toBe(12);

      filter = BetweenUI.max.set(filter, 25);
      expect(BetweenUI.max.get(filter)).toBe(25);

      filter = BetweenUI.minInclusive.set(filter, false);
      expect(BetweenUI.minInclusive.get(filter)).toBe(false);
      // Guard should still hold after modification via setters that recreate the object
      expect(BetweenUI.guard(filter)).toBe(true);

      filter = BetweenUI.maxInclusive.set(filter, false);
      expect(BetweenUI.maxInclusive.get(filter)).toBe(false);
      // Guard should still hold after modification via setters that recreate the object
      expect(BetweenUI.guard(filter)).toBe(true);

      // Test creation with different inclusivity
      filter = BetweenUI.create(dummyColumnId, 5, 15, false, false);
      expect(BetweenUI.guard(filter)).toBe(true);
      expect(BetweenUI.minInclusive.get(filter)).toBe(false);
      expect(BetweenUI.maxInclusive.get(filter)).toBe(false);
    });

    it('should return false for guard with invalid structure', () => {
      const invalidFilter1 = { type: 'and', filters: [GreaterThenUI.create(dummyColumnId, 10)] }; // Only one filter
      const invalidFilter2 = { type: 'and', filters: [GreaterThenUI.create(dummyColumnId, 10), LessThenUI.create('other_column' as SUniversalPColumnId, 20)] }; // Different columns
      const invalidFilter3 = { type: 'or', filters: [GreaterThenOrEqualUI.create(dummyColumnId, 10), LessThenOrEqualUI.create(dummyColumnId, 20)] }; // Wrong type
      const invalidFilter4 = { type: 'and', filters: [IsNAUI.create(dummyColumnId), LessThenUI.create(dummyColumnId, 20)] }; // Wrong filter types

      expect(BetweenUI.guard(invalidFilter1)).toBe(false);
      expect(BetweenUI.guard(invalidFilter2)).toBe(false);
      expect(BetweenUI.guard(invalidFilter3)).toBe(false);
      expect(BetweenUI.guard(invalidFilter4)).toBe(false);
      expect(BetweenUI.guard({})).toBe(false);
      expect(BetweenUI.guard(null)).toBe(false);
      expect(BetweenUI.guard(undefined)).toBe(false);
    });
  });

  test.each(DoubleColumnFilters)('$name filter creation and guard', ({ create, guard }) => {
    const filter = create(dummyColumnId, dummyColumnId2);
    expect(guard(filter)).toBe(true);
  });

  describe('CompareColumnsUI', () => {
    it('should handle creation, column getters, allowEqual, and minDiff', () => {
      // Default creation
      let filter = CompareColumnsUI.create(dummyColumnId, dummyColumnId2);
      expect(CompareColumnsUI.guard(filter)).toBe(true);
      expect(CompareColumnsUI.column1.get(filter)).toBe(dummyColumnId);
      expect(CompareColumnsUI.column2.get(filter)).toBe(dummyColumnId2);
      expect(CompareColumnsUI.allowEqual.get(filter)).toBe(false);
      expect(CompareColumnsUI.minDiff.get(filter)).toBeUndefined();

      // Creation with allowEqual and minDiff
      filter = CompareColumnsUI.create(dummyColumnId, dummyColumnId2, true, 5);
      expect(CompareColumnsUI.guard(filter)).toBe(true);
      expect(CompareColumnsUI.allowEqual.get(filter)).toBe(true);
      expect(CompareColumnsUI.minDiff.get(filter)).toBe(5);
    });

    it('should handle allowEqual setter', () => {
      let filter = CompareColumnsUI.create(dummyColumnId, dummyColumnId2);
      expect(CompareColumnsUI.allowEqual.get(filter)).toBe(false);

      filter = CompareColumnsUI.allowEqual.set(filter, true);
      expect(CompareColumnsUI.allowEqual.get(filter)).toBe(true);
      expect(CompareColumnsUI.guard(filter)).toBe(true); // Guard should still hold

      filter = CompareColumnsUI.allowEqual.set(filter, false);
      expect(CompareColumnsUI.allowEqual.get(filter)).toBe(false);
      expect(CompareColumnsUI.guard(filter)).toBe(true); // Guard should still hold
    });

    it('should handle minDiff setter', () => {
      let filter = CompareColumnsUI.create(dummyColumnId, dummyColumnId2);
      expect(CompareColumnsUI.minDiff.get(filter)).toBeUndefined();

      filter = CompareColumnsUI.minDiff.set(filter, 10);
      expect(CompareColumnsUI.minDiff.get(filter)).toBe(10);
      expect(CompareColumnsUI.guard(filter)).toBe(true); // Guard should still hold

      filter = CompareColumnsUI.minDiff.set(filter, undefined);
      expect(CompareColumnsUI.minDiff.get(filter)).toBeUndefined();
      expect(CompareColumnsUI.guard(filter)).toBe(true); // Guard should still hold
    });

    it('should return false for guard with invalid structure', () => {
      const invalidFilter1 = { type: 'numericalComparison', lhs: dummyColumnId, rhs: 5 }; // rhs is number
      const invalidFilter2 = { type: 'numericalComparison', lhs: 5, rhs: dummyColumnId2 }; // lhs is number
      const invalidFilter3 = { type: 'and', filters: [] }; // Wrong type
      const invalidFilter5 = LessThenUI.create(dummyColumnId, 10); // Completely different type

      expect(CompareColumnsUI.guard(invalidFilter1)).toBe(false);
      expect(CompareColumnsUI.guard(invalidFilter2)).toBe(false);
      expect(CompareColumnsUI.guard(invalidFilter3)).toBe(false);
      expect(CompareColumnsUI.guard(invalidFilter5)).toBe(false);
      expect(CompareColumnsUI.guard({})).toBe(false);
      expect(CompareColumnsUI.guard(null)).toBe(false);
      expect(CompareColumnsUI.guard(undefined)).toBe(false);
    });
  });
});
