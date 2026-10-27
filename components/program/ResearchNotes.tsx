"use client"

import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"
import { api } from "@/components/coach/types"

export type Note = {
  id: string
  question: string
  summary: string
  applicationToClient: string
  confidence: "low" | "moderate" | "high"
  sources: string // JSON {title,url}[]
  createdAt: string
}

type Props = {
  notes: Note[]
}

export default function ResearchNotes({ notes }: Props) {
  const router = useRouter()
  const [question, setQuestion] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!question.trim()) return

    setLoading(true)
    setError("")

    try {
      await api("/api/research", { question })
      setQuestion("")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit question")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div id="research" className="scroll-mt-20">
      <label className="label">Research notes</label>

      <form onSubmit={handleSubmit} className="card mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ask the coach to look something up…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-accent min-h-[44px]"
          >
            {loading ? "Researching…" : "Ask"}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </form>

      {notes.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">No research notes yet.</p>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note.id} className="card">
              <h3 className="font-bold mb-2">{note.question}</h3>
              <p className="mb-3">{note.summary}</p>

              <p className="mb-3">
                <strong>For you:</strong> {note.applicationToClient}
              </p>

              <div className="flex items-center gap-2 mb-3">
                <span className="border border-[var(--color-border)] rounded px-2 py-1 text-sm">
                  confidence: {note.confidence}
                </span>
              </div>

              <p className="text-xs text-[var(--color-text-muted)] mb-3">
                {note.createdAt.slice(0, 10)}
              </p>

              <div>
                {(() => {
                  try {
                    const sources = JSON.parse(note.sources) as Array<{ title?: string; url?: string }>
                    return sources.length > 0 ? (
                      <ul className="text-sm space-y-1">
                        {sources.map((source, idx) => {
                          if (source.url && (source.url.startsWith("http://") || source.url.startsWith("https://"))) {
                            return (
                              <li key={idx}>
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline text-[var(--color-accent)]"
                                >
                                  {source.title || source.url}
                                </a>
                              </li>
                            )
                          }
                          return null
                        })}
                      </ul>
                    ) : null
                  } catch {
                    return null
                  }
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
