'use client';

import { useState } from 'react';
import { useTrip } from '@/lib/store';

interface DashboardModalProps {
  onClose: () => void;
}

export default function DashboardModal({ onClose }: DashboardModalProps) {
  const { trip, updateVehicleSettings } = useTrip();

  if (!trip) return null;

  const mpg = trip.vehicleMpg ?? 25;
  const gasPrice = trip.gasPricePerGallon ?? 3.50;
  const tankRange = trip.vehicleRangeMiles ?? 300;

  const totalMiles = trip.totalDistance ?? 0;
  const estimatedGallons = totalMiles > 0 ? totalMiles / mpg : 0;
  const estimatedCost = estimatedGallons * gasPrice;

  const totalDays = trip.days.length;
  const drivingDays = trip.days.filter(d => d.activities.some(a => a.type === 'driving')).length;
  const campingNights = trip.days.flatMap(d => d.activities)
    .filter(a => a.type === 'camping' && !a.isContinuingStay)
    .reduce((sum, a) => sum + ((a as { nights?: number }).nights ?? 1), 0);
  const hotelNights = trip.days.flatMap(d => d.activities)
    .filter(a => a.type === 'hotel' && !a.isContinuingStay)
    .reduce((sum, a) => sum + ((a as { nights?: number }).nights ?? 1), 0);
  const dogFriendlyDays = trip.days.filter(d => d.activities.every(a => a.isDogFriendly !== false)).length;

  const lodgingCost = trip.days.flatMap(d => d.activities)
    .filter(a => (a.type === 'hotel' || a.type === 'camping') && !a.isContinuingStay)
    .reduce((sum, a) => {
      const act = a as { pricePerNight?: number; nights?: number };
      return sum + (act.pricePerNight ?? 0) * (act.nights ?? 1);
    }, 0);

  const ticketActivities = trip.days.flatMap(d =>
    d.activities
      .filter(a => a.requiresTickets === true && !a.isContinuingStay)
      .map(a => ({ activity: a, dayNumber: d.dayNumber }))
  );

  const validationErrors = trip.days.flatMap(d => d.validationStatus.messages.filter(m => m.level === 'error'));
  const validationWarnings = trip.days.flatMap(d => d.validationStatus.messages.filter(m => m.level === 'warning'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-lg">📊 Trip Dashboard</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Trip overview */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{totalDays}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total Days</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{drivingDays}</p>
              <p className="text-xs text-gray-500 mt-0.5">Driving Days</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{totalMiles > 0 ? Math.round(totalMiles).toLocaleString() : '—'}</p>
              <p className="text-xs text-gray-500 mt-0.5">Est. Miles</p>
            </div>
          </div>

          {/* Gas cost estimator */}
          <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
            <p className="font-semibold text-orange-900 mb-3">⛽ Gas Cost Estimator</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Vehicle MPG</label>
                <input
                  type="number"
                  min={1}
                  max={150}
                  value={mpg}
                  onChange={e => updateVehicleSettings({ vehicleMpg: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Gas Price ($/gal)</label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={gasPrice}
                  onChange={e => updateVehicleSettings({ gasPricePerGallon: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Tank Range (miles)</label>
                <input
                  type="number"
                  min={50}
                  max={1000}
                  step={10}
                  value={tankRange}
                  onChange={e => updateVehicleSettings({ vehicleRangeMiles: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            {totalMiles > 0 ? (
              <div className="bg-white rounded-md p-3 text-center">
                <p className="text-3xl font-bold text-orange-600">${estimatedCost.toFixed(0)}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {Math.round(totalMiles).toLocaleString()} mi ÷ {mpg} MPG × ${gasPrice.toFixed(2)}/gal
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 text-center py-2">Total distance not yet calculated. Add activities with real road routes to estimate.</p>
            )}
          </div>

          {/* Lodging summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border rounded-lg p-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">🏨 Lodging</p>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between"><span>Hotel nights</span><span className="font-medium">{hotelNights}</span></div>
                <div className="flex justify-between"><span>Camping nights</span><span className="font-medium">{campingNights}</span></div>
                {lodgingCost > 0 && (
                  <div className="flex justify-between pt-1 border-t border-gray-100 mt-1">
                    <span>Est. lodging</span>
                    <span className="font-medium text-gray-900">${lodgingCost.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
            {trip.hasDog && (
              <div className="border rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">🐕 Dog Status</p>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between"><span>Dog-friendly days</span><span className="font-medium">{dogFriendlyDays}/{totalDays}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Tickets summary */}
          {ticketActivities.length > 0 && (
            <div className="border rounded-lg p-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">🎟️ Tickets</p>
              <div className="space-y-1">
                {ticketActivities.map(({ activity, dayNumber }) => (
                  <div key={activity.id} className="flex items-center justify-between text-sm text-gray-600">
                    <span className="truncate mr-2">{activity.name} <span className="text-xs text-gray-400">(Day {dayNumber})</span></span>
                    <span className={`flex-shrink-0 font-medium ${activity.ticketsPurchased ? 'text-green-600' : 'text-red-500'}`}>
                      {activity.ticketsPurchased ? '✓' : '✗'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation summary */}
          {(validationErrors.length > 0 || validationWarnings.length > 0) && (
            <div className="border rounded-lg p-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">⚠️ Validation</p>
              <div className="space-y-1">
                {validationErrors.map((m, i) => (
                  <p key={i} className="text-xs text-red-600">🔴 {m.message}</p>
                ))}
                {validationWarnings.map((m, i) => (
                  <p key={i} className="text-xs text-yellow-700">🟡 {m.message}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
