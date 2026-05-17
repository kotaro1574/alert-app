import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { WeekdayToggle } from '@/components/WeekdayToggle';
import type { Weekday } from '@/domain/types';

describe('WeekdayToggle', () => {
  it('renders 7 day pills', () => {
    const { getAllByRole } = render(<WeekdayToggle value={[]} onChange={jest.fn()} />);
    expect(getAllByRole('button')).toHaveLength(7);
  });

  it('displays Japanese day labels', () => {
    const { getByText } = render(<WeekdayToggle value={[]} onChange={jest.fn()} />);
    expect(getByText('月')).toBeTruthy();
    expect(getByText('日')).toBeTruthy();
  });

  it('calls onChange with added weekday when inactive pill is tapped', () => {
    const onChange = jest.fn();
    const { getByText } = render(<WeekdayToggle value={[]} onChange={onChange} />);
    fireEvent.press(getByText('月'));
    expect(onChange).toHaveBeenCalledWith(['mon'] as Weekday[]);
  });

  it('calls onChange with removed weekday when active pill is tapped', () => {
    const onChange = jest.fn();
    const { getByText } = render(<WeekdayToggle value={['mon', 'tue']} onChange={onChange} />);
    fireEvent.press(getByText('月'));
    expect(onChange).toHaveBeenCalledWith(['tue'] as Weekday[]);
  });

  it('does not call onChange for already active pill that stays active (no double toggle)', () => {
    const onChange = jest.fn();
    const { getByText } = render(<WeekdayToggle value={['mon']} onChange={onChange} />);
    fireEvent.press(getByText('月'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
