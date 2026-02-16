'use client';

import { useState } from 'react';

interface Step4Props {
  data: any;
  onUpdate: (data: any) => void;
}

export default function Step4WhereYouSleep({ data, onUpdate }: Step4Props) {
  const [formData, setFormData] = useState({
    lodgingPreferences: data.lodgingPreferences || [],
    isNewCamper: data.isNewCamper || false,
  });

  const toggleLodging = (type: string) => {
    const current = formData.lodgingPreferences;
    const updated = current.includes(type)
      ? current.filter((t: string) => t !== type)
      : [...current, type];

    const newData = { ...formData, lodgingPreferences: updated };
    setFormData(newData);
    onUpdate(newData);
  };

  const handleNewCamper = (value: boolean) => {
    const newData = { ...formData, isNewCamper: value };
    setFormData(newData);
    onUpdate(newData);
  };

  const lodgingOptions = [
    {
      value: 'camping',
      icon: '⛺',
      label: 'Camping',
      description: 'Campgrounds, dispersed camping',
    },
    {
      value: 'hotels',
      icon: '🏨',
      label: 'Hotels',
      description: 'Hotels, motels, lodges',
    },
    {
      value: 'airbnb',
      icon: '🏠',
      label: 'Airbnb / Rentals',
      description: 'Vacation rentals, cabins',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Lodging options */}
      <div>
        <label className="block text-base font-semibold text-gray-900 mb-4">
          Where are you open to sleeping?
        </label>
        <div className="space-y-3">
          {lodgingOptions.map((option) => {
            const isSelected = formData.lodgingPreferences.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleLodging(option.value)}
                className={`w-full p-5 rounded-xl border-2 text-left transition-all flex items-start gap-4 ${
                  isSelected
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-3xl">{option.icon}</span>
                  <div>
                    <div className="font-semibold text-gray-900">{option.label}</div>
                    <div className="text-sm text-gray-600">{option.description}</div>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                  isSelected
                    ? 'border-orange-500 bg-orange-500'
                    : 'border-gray-300'
                }`}>
                  {isSelected && <span className="text-white text-sm">✓</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* New to camping */}
      <div className="bg-teal-50 border-2 border-teal-200 rounded-xl p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isNewCamper}
            onChange={(e) => handleNewCamper(e.target.checked)}
            className="w-5 h-5 mt-0.5 rounded border-teal-300 text-teal-600 focus:ring-teal-500"
          />
          <div>
            <div className="font-medium text-teal-900">
              I'm new to camping (we'll give extra tips and conservative estimates)
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}
