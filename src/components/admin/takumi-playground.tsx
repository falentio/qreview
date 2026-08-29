"use client"

import { useEffect, useState } from "react"
import { Check, CodeXml, RotateCcw, TriangleAlert } from "lucide-react"
import { renderSvg } from "takumi-js"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

const CANVAS = { width: 1240, height: 1748 } as const
const DEBOUNCE_MS = 450

const DEFAULT_MARKUP = `<div tw="w-full h-full flex items-center justify-center bg-[#162235] p-20">
  <div tw="max-w-4xl">
    <p tw="text-cyan-300 text-2xl font-bold tracking-[0.3em]">TAKUMI JS</p>
    <h1 tw="mt-5 text-white text-7xl font-bold leading-tight">Build image ideas in the browser.</h1>
    <p tw="mt-6 text-slate-300 text-2xl">Edit this HTML and the preview will follow.</p>
  </div>
</div>`

type RenderStatus = "waiting" | "rendering" | "ready" | "error"

function statusCopy(status: RenderStatus) {
  switch (status) {
    case "rendering":
      return "Rendering preview..."
    case "ready":
      return "Preview up to date"
    case "error":
      return "Could not render preview"
    default:
      return "Waiting to render"
  }
}

export function TakumiPlayground() {
  const [markup, setMarkup] = useState(DEFAULT_MARKUP)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<RenderStatus>("waiting")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true
    setStatus("waiting")
    setError(null)

    const timeoutId = window.setTimeout(() => {
      setStatus("rendering")

      void renderSvg(markup, CANVAS)
        .then((svg) => {
          if (!isCurrent) return

          setPreviewUrl((previousUrl) => {
            if (previousUrl) URL.revokeObjectURL(previousUrl)
            return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
          })
          setStatus("ready")
        })
        .catch((renderError: unknown) => {
          if (!isCurrent) return

          setStatus("error")
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Check the markup and try rendering again.",
          )
        })
    }, DEBOUNCE_MS)

    return () => {
      isCurrent = false
      window.clearTimeout(timeoutId)
    }
  }, [markup])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CodeXml className="size-4 text-primary" aria-hidden="true" />
              Takumi playground
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Write HTML with Tailwind classes and see Takumi render it as an SVG image. Scripts are
              not executed.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMarkup(DEFAULT_MARKUP)}
            disabled={markup === DEFAULT_MARKUP}
          >
            <RotateCcw aria-hidden="true" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 pt-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="takumi-markup" className="text-sm font-medium">
            Markup
          </label>
          <Textarea
            id="takumi-markup"
            value={markup}
            onChange={(event) => setMarkup(event.target.value)}
            spellCheck={false}
            className="min-h-80 resize-y font-mono text-xs leading-relaxed sm:min-h-96"
            aria-describedby="takumi-markup-help"
          />
          <p id="takumi-markup-help" className="text-xs text-muted-foreground">
            Preview updates {DEBOUNCE_MS} ms after you stop typing. Canvas: A6 at 300 DPI (
            {CANVAS.width} x {CANVAS.height} px).
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Preview</p>
            <p
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              aria-live="polite"
            >
              {status === "ready" && (
                <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
              )}
              {status === "error" && (
                <TriangleAlert className="size-3.5 text-destructive" aria-hidden="true" />
              )}
              {statusCopy(status)}
            </p>
          </div>
          <div className="flex min-h-80 items-center justify-center overflow-hidden rounded-lg border bg-muted/30 p-3 sm:min-h-96">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Takumi rendered preview"
                className="max-h-[30rem] w-full object-contain"
              />
            ) : (
              <p className="px-6 text-center text-sm text-muted-foreground">
                Your rendered SVG preview will appear here.
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
