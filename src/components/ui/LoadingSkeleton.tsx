import React from 'react'

export interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height
}) => {
  const baseClasses = 'animate-pulse bg-gray-200'

  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded',
  }

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
      aria-live="polite"
      aria-busy="true"
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

export const CampaignCardSkeleton: React.FC = () => {
  return (
    <div className="p-6 space-y-3">
      <Skeleton variant="text" width="60%" height={20} />
      <Skeleton variant="text" width="40%" height={16} />
      <Skeleton variant="rectangular" width={80} height={24} className="mt-2" />
    </div>
  )
}

export const StatCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-lg shadow space-y-2">
      <Skeleton variant="text" width="50%" height={32} />
      <Skeleton variant="text" width="70%" height={14} />
    </div>
  )
}
