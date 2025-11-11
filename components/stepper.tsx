'use client'

interface Step {
  id: string
  label: string
}

interface StepperProps {
  steps: Step[]
  activeStepId: string
}

export function Stepper({ steps, activeStepId }: StepperProps) {
  const activeIndex = steps.findIndex(step => step.id === activeStepId)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center">
        {steps.map((step, index) => {
          const isActive = step.id === activeStepId
          const isCompleted = index < activeIndex

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-0.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : isCompleted
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-gray-300 bg-white text-gray-500'
                  }`}
                >
                  {index + 1}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive || isCompleted ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-2 hidden h-0.5 flex-1 rounded-full md:block ${
                    index < activeIndex ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
