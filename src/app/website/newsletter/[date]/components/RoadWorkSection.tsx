interface RoadWorkSectionProps {
  sectionId: string
  sectionName: string
  roadWork: {
    items?: Array<{
      title: string
      description: string
    }>
  }
}

export default function RoadWorkSection({ sectionId, sectionName, roadWork }: RoadWorkSectionProps) {
  return (
    <div key={sectionId} className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
      <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-slate-800 text-white">{sectionName}</h2>
      <div className="p-6 sm:p-8">
        <div className="space-y-3">
          {roadWork.items && roadWork.items.map((item, index: number) => (
            <div key={index} className="border-b border-slate-200 last:border-0 pb-3 last:pb-0">
              <div className="font-bold text-slate-900">{item.title}</div>
              <div className="text-slate-900/80 text-sm mt-1">{item.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
