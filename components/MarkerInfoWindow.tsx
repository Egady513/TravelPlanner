'use client';

import { Activity, CampingSpot, DrivingActivity } from '@/types';
import { useTrip } from '@/lib/store';

interface MarkerInfoWindowProps {
  activity: Activity;
  onClose: () => void;
}

const activityIcons: Record<string, string> = {
  trail: '🥾',
  hotel: '🏨',
  restaurant: '🍽️',
  camping: '⛺',
  park: '🏞️',
  driving: '🚗',
};

export default function MarkerInfoWindow({ activity, onClose }: MarkerInfoWindowProps) {
  const { removeActivity } = useTrip();

  const handleDelete = () => {
    if (confirm(`Delete ${activity.name}?`)) {
      removeActivity(activity.id);
      onClose();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 min-w-[250px] max-w-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{activityIcons[activity.type]}</span>
          <div>
            <h3 className="font-semibold text-gray-900">{activity.name}</h3>
            <p className="text-xs text-gray-500 capitalize">{activity.type}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2">
        <div className="text-sm">
          <span className="text-gray-600">Day:</span>{' '}
          <span className="font-medium">Day {activity.dayNumber}</span>
        </div>

        {activity.isDogFriendly && (
          <div className="text-sm text-green-600 font-medium">
            🐕 Dog-friendly
          </div>
        )}

        {activity.type === 'driving' && (() => {
          const driving = activity as DrivingActivity;
          return (
            <div className="text-sm">
              <span className="text-gray-600">Route:</span>
              <div className="mt-1 space-y-0.5">
                <p className="text-gray-900">📍 {driving.startLocation.name}</p>
                <p className="text-gray-400 text-xs pl-2">↓ drive</p>
                <p className="text-gray-900">📍 {driving.endLocation.name}</p>
              </div>
            </div>
          );
        })()}

        {activity.notes && (
          <div className="text-sm">
            <span className="text-gray-600">Notes:</span>
            <p className="text-gray-900 mt-1">{activity.notes}</p>
          </div>
        )}

        {activity.type === 'camping' && (() => {
          const camping = activity as CampingSpot;
          return (
            <>
              {camping.amenities && (
                <div className="text-sm">
                  <span className="text-gray-600">Amenities:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {camping.amenities.free && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Free</span>
                    )}
                    {camping.amenities.fireRing && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">Fire Ring</span>
                    )}
                    {camping.amenities.cellCoverage && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">Cell Coverage</span>
                    )}
                    {camping.amenities.water && (
                      <span className="px-2 py-1 bg-cyan-100 text-cyan-700 rounded text-xs">Water</span>
                    )}
                  </div>
                </div>
              )}
              {camping.sourceLink && (
                <div className="text-sm">
                  <a
                    href={camping.sourceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 underline"
                  >
                    View Source
                  </a>
                </div>
              )}
            </>
          );
        })()}

        <div className="text-xs text-gray-500">
          {activity.coordinates.lat.toFixed(4)}, {activity.coordinates.lng.toFixed(4)}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200">
        <button
          onClick={handleDelete}
          className="text-sm text-red-600 hover:text-red-700 font-medium"
        >
          Delete Activity
        </button>
      </div>
    </div>
  );
}
