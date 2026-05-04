'use client';

import { Footprints, Building2, UtensilsCrossed, Tent, Trees, Car, Star, Mountain, MapPin } from 'lucide-react';
import { ActivityType } from '@/types';

interface ActivityIconProps {
  type: ActivityType;
  size?: number;
  className?: string;
}

const iconMap: Record<ActivityType, React.ElementType> = {
  trail: Footprints,
  hotel: Building2,
  restaurant: UtensilsCrossed,
  camping: Tent,
  park: Trees,
  driving: Car,
  activity: Star,
  scenic: Mountain,
};

const colorMap: Record<ActivityType, string> = {
  trail: 'text-green-600',
  hotel: 'text-blue-600',
  restaurant: 'text-orange-500',
  camping: 'text-amber-700',
  park: 'text-emerald-700',
  driving: 'text-gray-500',
  activity: 'text-purple-600',
  scenic: 'text-cyan-600',
};

export function getActivityColor(type: ActivityType): string {
  return colorMap[type] ?? 'text-gray-500';
}

export default function ActivityIcon({ type, size = 16, className }: ActivityIconProps) {
  const Icon = iconMap[type] ?? MapPin;
  const color = colorMap[type] ?? 'text-gray-500';
  return <Icon size={size} className={className ?? color} strokeWidth={1.75} />;
}
