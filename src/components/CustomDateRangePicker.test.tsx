import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomDateRangePicker } from './CustomDateRangePicker';

describe('CustomDateRangePicker', () => {
  // Any zone away from UTC exposes UTC/local mix-ups in datetime-local fields
  const originalTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'Europe/Stockholm';
  });
  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  // Built per test: dates created while the describe block is collected would use the
  // machine's zone, not the one set in beforeAll
  const makeRange = () => ({ startDate: new Date(2026, 9, 1, 12, 0), endDate: new Date(2026, 9, 2, 12, 0) });

  it('shows the current range in local time', () => {
    const range = makeRange();
    render(<CustomDateRangePicker isOpen onClose={() => {}} onApply={() => {}} currentRange={range} />);

    expect(screen.getByLabelText(/start date/i)).toHaveValue('2026-10-01T12:00');
    expect(screen.getByLabelText(/end date/i)).toHaveValue('2026-10-02T12:00');
  });

  it('applies an unchanged range without shifting it', () => {
    const range = makeRange();
    const onApply = vi.fn();
    render(<CustomDateRangePicker isOpen onClose={() => {}} onApply={onApply} currentRange={range} />);

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledWith(range);
  });

  it('rejects an empty date', () => {
    const range = makeRange();
    const onApply = vi.fn();
    render(<CustomDateRangePicker isOpen onClose={() => {}} onApply={onApply} currentRange={range} />);

    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByText(/enter both a start and an end date/i)).toBeInTheDocument();
  });

  it('discards unapplied edits when reopened', () => {
    const range = makeRange();
    const { rerender } = render(<CustomDateRangePicker isOpen onClose={() => {}} onApply={() => {}} currentRange={range} />);
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-09-01T08:00' } });

    rerender(<CustomDateRangePicker isOpen={false} onClose={() => {}} onApply={() => {}} currentRange={range} />);
    rerender(<CustomDateRangePicker isOpen onClose={() => {}} onApply={() => {}} currentRange={range} />);

    expect(screen.getByLabelText(/start date/i)).toHaveValue('2026-10-01T12:00');
  });
});
