import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeRangeSelector } from './TimeRangeSelector';
import type { TimeRange } from '../types';

describe('TimeRangeSelector', () => {
  const mockOnRangeChange = vi.fn();
  const mockOnCustomClick = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render all time range buttons', () => {
    render(
      <TimeRangeSelector
        selectedRange="24h"
        onRangeChange={mockOnRangeChange}
      />
    );

    expect(screen.getByText('24 Hours')).toBeInTheDocument();
    expect(screen.getByText('7 Days')).toBeInTheDocument();
    expect(screen.getByText('30 Days')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('should highlight the selected range', () => {
    render(
      <TimeRangeSelector
        selectedRange="7d"
        onRangeChange={mockOnRangeChange}
      />
    );

    const sevenDaysButton = screen.getByText('7 Days');
    expect(sevenDaysButton).toHaveClass('bg-blue-600', 'text-white');
  });

  it('should not highlight non-selected ranges', () => {
    render(
      <TimeRangeSelector
        selectedRange="24h"
        onRangeChange={mockOnRangeChange}
      />
    );

    const sevenDaysButton = screen.getByText('7 Days');
    expect(sevenDaysButton).not.toHaveClass('bg-blue-600');
  });

  it('should call onRangeChange when a range button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TimeRangeSelector
        selectedRange="24h"
        onRangeChange={mockOnRangeChange}
      />
    );

    const sevenDaysButton = screen.getByText('7 Days');
    await user.click(sevenDaysButton);

    expect(mockOnRangeChange).toHaveBeenCalledWith('7d');
    expect(mockOnRangeChange).toHaveBeenCalledTimes(1);
  });

  it('should call onCustomClick when custom button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TimeRangeSelector
        selectedRange="24h"
        onRangeChange={mockOnRangeChange}
        onCustomClick={mockOnCustomClick}
      />
    );

    const customButton = screen.getByText('Custom');
    await user.click(customButton);

    expect(mockOnCustomClick).toHaveBeenCalledTimes(1);
    expect(mockOnRangeChange).not.toHaveBeenCalled();
  });

  it('should call onRangeChange when custom button is clicked without onCustomClick handler', async () => {
    const user = userEvent.setup();

    render(
      <TimeRangeSelector
        selectedRange="24h"
        onRangeChange={mockOnRangeChange}
      />
    );

    const customButton = screen.getByText('Custom');
    await user.click(customButton);

    expect(mockOnRangeChange).toHaveBeenCalledWith('custom');
  });

  it('should handle multiple range changes', async () => {
    const user = userEvent.setup();

    render(
      <TimeRangeSelector
        selectedRange="24h"
        onRangeChange={mockOnRangeChange}
      />
    );

    await user.click(screen.getByText('7 Days'));
    await user.click(screen.getByText('30 Days'));
    await user.click(screen.getByText('24 Hours'));

    expect(mockOnRangeChange).toHaveBeenCalledTimes(3);
    expect(mockOnRangeChange).toHaveBeenNthCalledWith(1, '7d');
    expect(mockOnRangeChange).toHaveBeenNthCalledWith(2, '30d');
    expect(mockOnRangeChange).toHaveBeenNthCalledWith(3, '24h');
  });

  it('should work with all range options', async () => {
    const user = userEvent.setup();
    const ranges: TimeRange[] = ['24h', '7d', '30d', 'custom'];

    render(
      <TimeRangeSelector
        selectedRange="24h"
        onRangeChange={mockOnRangeChange}
        onCustomClick={mockOnCustomClick}
      />
    );

    for (const range of ranges) {
      const button = screen.getByText(
        range === '24h' ? '24 Hours' :
        range === '7d' ? '7 Days' :
        range === '30d' ? '30 Days' : 'Custom'
      );
      await user.click(button);
    }

    // Custom calls onCustomClick, others call onRangeChange
    expect(mockOnRangeChange).toHaveBeenCalledTimes(3);
    expect(mockOnCustomClick).toHaveBeenCalledTimes(1);
  });

  it('should highlight custom range when selected', () => {
    render(
      <TimeRangeSelector
        selectedRange="custom"
        onRangeChange={mockOnRangeChange}
      />
    );

    const customButton = screen.getByText('Custom');
    expect(customButton).toHaveClass('bg-blue-600', 'text-white');
  });
});
