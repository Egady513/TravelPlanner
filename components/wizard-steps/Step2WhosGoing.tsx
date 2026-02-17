'use client';

import { useState } from 'react';

interface Step2Props {
  data: any;
  onUpdate: (data: any) => void;
}

export default function Step2WhosGoing({ data, onUpdate }: Step2Props) {
  const [formData, setFormData] = useState({
    peopleCount: data.peopleCount || 2,
    hasDog: data.hasDog || false,
  });

  const handleChange = (field: string, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);
  };

  return (
    <div className="space-y-8">
      {/* How many people */}
      <div>
        <label className="block text-base font-medium text-gray-900 mb-4">
          How many people?
        </label>
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => handleChange('peopleCount', count)}
              className={`flex-1 py-4 px-6 rounded-xl border-2 font-semibold transition-all ${
                formData.peopleCount === count
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Traveling with a dog */}
      <div>
        <label className="flex items-center gap-4 p-5 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-orange-300 transition-colors">
          <input
            type="checkbox"
            checked={formData.hasDog}
            onChange={(e) => handleChange('hasDog', e.target.checked)}
            className="w-6 h-6 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
          />
          <div className="flex items-center gap-3">
            <span className="text-2xl">🐕</span>
            <span className="text-base font-medium text-gray-900">
              Traveling with a dog
            </span>
          </div>
        </label>
        {formData.hasDog && (
          <p className="mt-3 pl-1 text-sm text-gray-600">
            We&apos;ll highlight dog-friendly spots, suggest lodging when trails don&apos;t allow dogs, and help you balance camping vs hotel nights for your pup.
          </p>
        )}
      </div>
    </div>
  );
}
