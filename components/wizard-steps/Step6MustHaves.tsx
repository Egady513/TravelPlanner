'use client';

import { useState } from 'react';

interface Step6Props {
  data: any;
  onUpdate: (data: any) => void;
}

export default function Step6MustHaves({ data, onUpdate }: Step6Props) {
  const [formData, setFormData] = useState({
    mustHaves: data.mustHaves || [
      { id: '1', text: 'Camping by the lake with mountains in the background for an epic photo with my dog', type: 'experience' },
      { id: '2', text: 'Offroading in my 4runner', type: 'experience' },
    ],
  });

  const [newItemText, setNewItemText] = useState('');
  const [selectedType, setSelectedType] = useState<'place' | 'experience' | 'feeling'>('place');

  const addMustHave = () => {
    if (!newItemText.trim()) return;

    const newItem = {
      id: Date.now().toString(),
      text: newItemText.trim(),
      type: selectedType,
    };

    const updated = {
      mustHaves: [...formData.mustHaves, newItem],
    };

    setFormData(updated);
    onUpdate(updated);
    setNewItemText('');
  };

  const removeMustHave = (id: string) => {
    const updated = {
      mustHaves: formData.mustHaves.filter((item: any) => item.id !== id),
    };
    setFormData(updated);
    onUpdate(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <label className="block text-base font-semibold text-gray-900 mb-2">
          Non-Negotiables
        </label>
        <p className="text-sm text-gray-600">
          What must this trip include? Can be places, experiences, or feelings.
        </p>
      </div>

      {/* Existing Must-Haves */}
      {formData.mustHaves.length > 0 && (
        <div className="space-y-2">
          {formData.mustHaves.map((item: any) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg group"
            >
              <div className="flex-1">
                <span className="inline-block px-2 py-1 text-xs font-medium bg-white border border-gray-200 rounded capitalize mb-2">
                  {item.type}
                </span>
                <p className="text-gray-900">{item.text}</p>
              </div>
              <button
                onClick={() => removeMustHave(item.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 p-1"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add New */}
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 space-y-4">
        {/* Type selector */}
        <div className="flex gap-2">
          {['place', 'experience', 'feeling'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedType(type as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === type
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addMustHave()}
            placeholder="e.g., Grand Canyon"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={addMustHave}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
