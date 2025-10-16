'use client'

import { useState } from "react"
import { Card } from "@/components/website/ui/card"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/website/ui/button"

const newsStories = [
  {
    date: "Oct 14, 2025",
    category: "AI Tools",
    title: "OpenAI Launches Specialized Accounting GPT Model",
    description:
      "New AI model trained specifically on GAAP standards and tax codes promises to revolutionize financial reporting accuracy.",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=450&fit=crop",
  },
  {
    date: "Oct 13, 2025",
    category: "Industry News",
    title: "Big Four Firms Report 40% Efficiency Gains with AI",
    description:
      "Major accounting firms reveal significant productivity improvements after implementing AI-powered audit tools across their practices.",
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=450&fit=crop",
  },
  {
    date: "Oct 12, 2025",
    category: "Regulation",
    title: "SEC Announces New Guidelines for AI in Financial Reporting",
    description:
      "Regulatory body releases comprehensive framework for using artificial intelligence in preparing and auditing financial statements.",
    image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&h=450&fit=crop",
  },
  {
    date: "Oct 11, 2025",
    category: "Technology",
    title: "Automated Tax Preparation Reaches 95% Accuracy Rate",
    description:
      "Latest AI tax software demonstrates near-perfect accuracy in complex corporate tax scenarios, reducing review time by 60%.",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&h=450&fit=crop",
  },
  {
    date: "Oct 10, 2025",
    category: "Case Study",
    title: "Mid-Size Firm Cuts Month-End Close Time in Half",
    description:
      "Regional accounting firm shares how AI-powered reconciliation tools transformed their financial close process.",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop",
  },
  {
    date: "Oct 9, 2025",
    category: "Expert Opinion",
    title: "Why Every Accountant Needs to Understand Machine Learning",
    description:
      "Industry leaders discuss the critical importance of AI literacy for finance professionals in the modern workplace.",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=450&fit=crop",
  },
]

export function Features() {
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = 8
  return (
    <section id="features" className="py-10 px-4 sm:px-6 lg:px-8 bg-[#F5F5F7]">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center space-y-2 mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1D1D1F] text-balance">Latest AI Accounting News</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {newsStories.map((story, index) => (
            <Card
              key={index}
              className="group cursor-pointer hover:shadow-lg transition-shadow overflow-hidden p-0 bg-white border-border"
            >
              <img
                src={story.image || "/placeholder.svg"}
                alt={story.title}
                className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300 rounded-t-lg"
              />

              <div className="px-4 pb-4">
                <div className="flex items-center gap-2 text-xs text-[#1D1D1F]/60 mb-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{story.date}</span>
                  <span className="text-[#a855f7] font-medium ml-auto">{story.category}</span>
                </div>
                <h3 className="text-base font-bold text-[#1D1D1F] mb-1.5 group-hover:text-[#a855f7] transition-colors leading-tight">
                  {story.title}
                </h3>
                <p className="text-xs text-[#1D1D1F]/70 leading-relaxed">{story.description}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 mt-10">
          <Button
            variant="ghost"
            size="sm"
            className="text-sm text-[#1D1D1F]/40 hover:text-[#1D1D1F]/60 hover:bg-transparent"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(1)}
          >
            First
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-sm text-[#1D1D1F]/40 hover:text-[#1D1D1F]/60 hover:bg-transparent"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "ghost"}
                size="sm"
                className={`w-10 h-10 rounded-lg ${
                  currentPage === page
                    ? "bg-[#1c293d] text-white hover:bg-[#1c293d]/90"
                    : "text-[#1D1D1F] hover:bg-white/50"
                }`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-sm text-[#1D1D1F] hover:text-[#1D1D1F]/80 hover:bg-transparent"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-sm text-[#1D1D1F] hover:text-[#1D1D1F]/80 hover:bg-transparent"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(totalPages)}
          >
            Last
          </Button>
        </div>
      </div>
    </section>
  )
}
