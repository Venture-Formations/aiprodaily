export function SubscribeProgressBar({ step }: { step: number }) {
  const widthPercent = step * 25

  return (
    <div className="w-full mb-6" role="progressbar" aria-valuenow={widthPercent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-[3px] w-full rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500 ease-out"
          style={{ width: `${widthPercent}%` }}
        />
      </div>
    </div>
  )
}
