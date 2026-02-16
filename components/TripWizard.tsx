'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Step1TripBasics from './wizard-steps/Step1TripBasics';
import Step2WhosGoing from './wizard-steps/Step2WhosGoing';
import Step3TravelStyle from './wizard-steps/Step3TravelStyle';
import Step4WhereYouSleep from './wizard-steps/Step4WhereYouSleep';
import Step5Budget from './wizard-steps/Step5Budget';
import Step6MustHaves from './wizard-steps/Step6MustHaves';

interface TripWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (tripData: any) => void;
}

export default function TripWizard({ isOpen, onClose, onComplete }: TripWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<any>({});

  const totalSteps = 6;

  const stepIcons = [
    '📍', // Trip Basics
    '👥', // Who's Going
    '🧭', // Travel Style
    '🌙', // Where You Sleep
    '💰', // Budget
    '💛', // Must-Haves
  ];

  const stepTitles = [
    'Trip Basics',
    "Who's Going",
    'Travel Style',
    'Where You Sleep',
    'Budget',
    'Must-Haves',
  ];

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final step - create trip
      onComplete(formData);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateFormData = (stepData: any) => {
    setFormData({ ...formData, ...stepData });
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Step Indicator */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {stepIcons.map((icon, index) => {
              const stepNum = index + 1;
              const isActive = stepNum === currentStep;
              const isCompleted = stepNum < currentStep;

              return (
                <div key={stepNum} className="flex items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${
                      isActive
                        ? 'bg-orange-500 text-white scale-110'
                        : isCompleted
                        ? 'bg-orange-100 text-orange-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {icon}
                  </div>
                  {stepNum < totalSteps && (
                    <div
                      className={`w-12 h-1 mx-1 ${
                        isCompleted ? 'bg-orange-400' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{stepIcons[currentStep - 1]}</span>
              <h2 className="text-2xl font-bold text-gray-900">
                {stepTitles[currentStep - 1]}
              </h2>
            </div>
            <p className="text-sm text-gray-500">Step {currentStep} of {totalSteps}</p>
          </div>

          {/* Step forms */}
          <div className="mb-6">
            {currentStep === 1 && <Step1TripBasics data={formData} onUpdate={updateFormData} />}
            {currentStep === 2 && <Step2WhosGoing data={formData} onUpdate={updateFormData} />}
            {currentStep === 3 && <Step3TravelStyle data={formData} onUpdate={updateFormData} />}
            {currentStep === 4 && <Step4WhereYouSleep data={formData} onUpdate={updateFormData} />}
            {currentStep === 5 && <Step5Budget data={formData} onUpdate={updateFormData} />}
            {currentStep === 6 && <Step6MustHaves data={formData} onUpdate={updateFormData} />}
          </div>
        </div>

        {/* Navigation */}
        <div className="px-8 py-6 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={currentStep === 1 ? onClose : handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium"
          >
            <span>←</span>
            <span>{currentStep === 1 ? 'Cancel' : 'Back'}</span>
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
          >
            <span>{currentStep === totalSteps ? 'Create Trip' : 'Continue'}</span>
            {currentStep < totalSteps && <span>→</span>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
