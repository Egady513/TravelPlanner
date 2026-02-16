'use client';

import { useState } from 'react';

interface Step5Props {
  data: any;
  onUpdate: (data: any) => void;
}

export default function Step5Budget({ data, onUpdate }: Step5Props) {
  const [formData, setFormData] = useState({
    budgetStyle: data.budgetStyle || 'midrange',
    splurgeNights: data.splurgeNights || 2,
  });

  const handleChange = (field: string, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);
  };

  const budgetOptions = [
    {
      value: 'budget',
      label: 'Budget-Friendly',
      description: 'Prioritize value, camping, cheaper eats',
    },
    {
      value: 'midrange',
      label: 'Mid-Range',
      description: 'Mix of comfort and value',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Budget Style */}
      <div>
        <label className="block text-base font-semibold text-gray-900 mb-4">
          Overall Budget Style
        </label>
        <div className="space-y-3">
          {budgetOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleChange('budgetStyle', option.value)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                formData.budgetStyle === option.value
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

      {/* Splurge Nights */}
      <div>
        <label className="block text-base font-semibold text-gray-900 mb-2">
          Splurge Nights
        </label>
        <p className="text-sm text-gray-600 mb-4">
          Special nights where you go all out on accommodation
        </p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0"
            max="5"
            value={formData.splurgeNights}
            onChange={(e) => handleChange('splurgeNights', parseInt(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
          <div className="w-24 text-center">
            <span className="text-2xl font-bold text-orange-600">
              {formData.splurgeNights === 0 ? 'None' : formData.splurgeNights}
            </span>
            <div className="text-xs text-gray-500">
              {formData.splurgeNights === 1 ? 'night' : 'nights'}
            </div>
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>None</span>
          <span>5</span>
        </div>
      </div>
    </div>
  );
}
