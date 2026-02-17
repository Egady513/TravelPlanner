'use client';

import { useState } from 'react';

interface Step1Props {
  data: any;
  onUpdate: (data: any) => void;
}

export default function Step1TripBasics({ data, onUpdate }: Step1Props) {
  const [formData, setFormData] = useState({
    name: data.name || '',
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    startingLocation: data.startingLocation?.address || '',
    endingLocation: data.endingLocation?.address || '',
    isLoopTrip: data.isLoopTrip || false,
  });

  const handleChange = (field: string, value: any) => {
    let updated = { ...formData, [field]: value };
    // If start date is after end date, clear end date so the range stays valid
    if (field === 'startDate' && value && formData.endDate && value > formData.endDate) {
      updated = { ...updated, endDate: '' };
    }
    setFormData(updated);
    onUpdate(updated);
  };

  return (
    <div className="space-y-6">
      {/* Trip Name */}
      <div>
        <label htmlFor="tripName" className="block text-sm font-medium text-gray-700 mb-2">
          What should we call this trip?
        </label>
        <input
          type="text"
          id="tripName"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g., Southwest Adventure 2024"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
            Start Date
          </label>
          <input
            type="date"
            id="startDate"
            value={formData.startDate}
            onChange={(e) => handleChange('startDate', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
            End Date
          </label>
          <input
            type="date"
            id="endDate"
            min={formData.startDate || undefined}
            value={formData.endDate}
            onChange={(e) => handleChange('endDate', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Starting From */}
      <div>
        <label htmlFor="startingLocation" className="block text-sm font-medium text-gray-700 mb-2">
          Starting From
        </label>
        <input
          type="text"
          id="startingLocation"
          value={formData.startingLocation}
          onChange={(e) => handleChange('startingLocation', e.target.value)}
          placeholder="e.g., San Francisco, CA"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* Loop Trip Checkbox */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isLoopTrip}
            onChange={(e) => handleChange('isLoopTrip', e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
          />
          <span className="text-sm font-medium text-gray-700">
            This is a loop trip (returning to start)
          </span>
        </label>
      </div>

      {/* Ending At (only show if not loop trip) */}
      {!formData.isLoopTrip && (
        <div>
          <label htmlFor="endingLocation" className="block text-sm font-medium text-gray-700 mb-2">
            Ending At
          </label>
          <input
            type="text"
            id="endingLocation"
            value={formData.endingLocation}
            onChange={(e) => handleChange('endingLocation', e.target.value)}
            placeholder="e.g., Los Angeles, CA"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      )}
    </div>
  );
}
