export function SubscribeProgressBar({ step }: { step: number }) {
  const widthPercent = step * 25

  return (
    <div className="w-full mb-6" role="progressbar" aria-valuenow={widthPercent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-5 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
          style={{
            width: `${widthPercent}%`,
            background: 'linear-gradient(to right, #005a8c, #0088a8)',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)',
              backgroundSize: '20px 20px',
              animation: 'progress-stripes 0.6s linear infinite',
            }}
          />
        </div>
      </div>
    </div>
  )
}
