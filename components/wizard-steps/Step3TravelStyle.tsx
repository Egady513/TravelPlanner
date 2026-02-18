'use client';

import { useState } from 'react';

interface Step3Props {
  data: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
}

export default function Step3TravelStyle({ data, onUpdate }: Step3Props) {
  const [formData, setFormData] = useState<{
    tripPace: string;
    maxDrivingHours: number;
    drivingPreference?: 'early' | 'late' | 'flexible';
    planningStyle: string;
  }>({
    tripPace: (data.tripPace as string) || 'balanced',
    maxDrivingHours: (data.maxDrivingHours as number) || 6,
    drivingPreference: (data.drivingPreference as 'early' | 'late' | 'flexible' | undefined) ?? undefined,
    planningStyle: (data.planningStyle as string) || 'help',
  });

  const handleChange = (field: string, value: string | number) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);
  };

  const paceOptions = [
    {
      value: 'relaxed',
      label: 'Relaxed',
      description: 'Fewer stops, more time in each place',
    },
    {
      value: 'balanced',
      label: 'Balanced',
      description: 'Mix of exploring and unwinding',
    },
    {
      value: 'adventure',
      label: 'Adventure Mode',
      description: 'See as much as possible',
    },
  ];

  const drivingOptions: { value: 'early' | 'late' | 'flexible'; label: string; message: string }[] = [
    { value: 'early', label: 'Early starts', message: "We'll suggest hitting the road early and prioritize morning activities." },
    { value: 'late', label: 'Late arrivals OK', message: "We'll allow for later departures and evening arrivals at stops." },
    { value: 'flexible', label: 'Flexible', message: "We'll balance drive times with your pace; you can adjust day by day." },
  ];

  const planningOptions = [
    {
      value: 'help',
      label: 'Help me plan',
      description: "Let's build this together from scratch",
    },
    {
      value: 'existing',
      label: 'I have a plan',
      description: 'Review and improve my existing itinerary',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Trip Pace */}
      <div>
        <label className="block text-base font-semibold text-gray-900 mb-4">
          Trip Pace
        </label>
        <div className="space-y-3">
          {paceOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleChange('tripPace', option.value)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                formData.tripPace === option.value
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-gray-900">{option.label}</div>
              <div className="text-sm text-gray-600 mt-1">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Max Driving Hours */}
      <div>
        <label className="block text-base font-semibold text-gray-900 mb-2">
          Max Driving Hours Per Day
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="2"
            max="10"
            value={formData.maxDrivingHours}
            onChange={(e) => handleChange('maxDrivingHours', parseInt(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
          <div className="w-24 text-center">
            <span className="text-2xl font-bold text-orange-600">{formData.maxDrivingHours}h</span>
            <div className="text-xs text-gray-500">preferred</div>
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>2h</span>
          <span>10h</span>
        </div>
      </div>

      {/* Driving Preference */}
      <div>
        <label className="block text-base font-semibold text-gray-900 mb-4">
          Driving Preference
        </label>
        <div className="flex gap-3">
          {drivingOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleChange('drivingPreference', option.value)}
              className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                formData.drivingPreference === option.value
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {formData.drivingPreference && (
          <p className="mt-3 text-sm text-gray-600">
            {drivingOptions.find((o) => o.value === formData.drivingPreference)?.message}
          </p>
        )}
      </div>

      {/* Planning Style */}
      <div>
        <label className="block text-base font-semibold text-gray-900 mb-4">
          Planning Style
        </label>
        <div className="space-y-3">
          {planningOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleChange('planningStyle', option.value)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                formData.planningStyle === option.value
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-gray-900">{option.label}</div>
              <div className="text-sm text-gray-600 mt-1">{option.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
