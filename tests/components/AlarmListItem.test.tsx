import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AlarmListItem } from '@/components/AlarmListItem';
import type { Alarm } from '@/domain/types';

const alarm: Alarm = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  label: 'Morning',
  hour: 7,
  minute: 5,
  weekdays: ['mon', 'tue'],
  enabled: true,
  snoozeEnabled: false,
  soundId: 'default',
  createdAt: 1000,
  updatedAt: 1000,
};

describe('AlarmListItem', () => {
  it('renders time as HH:MM with zero-padding', () => {
    const { getByText } = render(
      <AlarmListItem alarm={alarm} onToggle={jest.fn()} onPress={jest.fn()} />,
    );
    expect(getByText('07:05')).toBeTruthy();
  });

  it('renders the alarm label', () => {
    const { getByText } = render(
      <AlarmListItem alarm={alarm} onToggle={jest.fn()} onPress={jest.fn()} />,
    );
    expect(getByText('Morning')).toBeTruthy();
  });

  it('renders weekday abbreviations', () => {
    const { getByText } = render(
      <AlarmListItem alarm={alarm} onToggle={jest.fn()} onPress={jest.fn()} />,
    );
    expect(getByText('月 火')).toBeTruthy();
  });

  it('calls onToggle with new value when switch is pressed', () => {
    const onToggle = jest.fn();
    const { getByRole } = render(
      <AlarmListItem alarm={alarm} onToggle={onToggle} onPress={jest.fn()} />,
    );
    fireEvent(getByRole('switch'), 'valueChange', false);
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('calls onPress when row is pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <AlarmListItem alarm={alarm} onToggle={jest.fn()} onPress={onPress} />,
    );
    fireEvent.press(getByTestId('alarm-list-item'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
