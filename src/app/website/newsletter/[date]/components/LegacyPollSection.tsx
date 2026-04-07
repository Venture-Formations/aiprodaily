interface LegacyPollSectionProps {
  sectionId: string
  sectionName: string
  poll: {
    question: string
  }
}

export default function LegacyPollSection({ sectionId, sectionName, poll }: LegacyPollSectionProps) {
  return (
    <div key={sectionId} className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
      <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-slate-800 text-white">{sectionName}</h2>
      <div className="p-6 sm:p-8">
        <div className="text-xl font-bold text-center text-slate-900 mb-4">{poll.question}</div>
        <p className="text-slate-900/60 text-sm text-center">
          This poll was available in the email newsletter.
        </p>
      </div>
    </div>
  )
}
