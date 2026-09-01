import { useState } from "react"
import { useForm } from "@tanstack/react-form"
import { navigate } from "astro:transitions/client"

import { authClient } from "@/lib/auth-client"
import { cn, getErrorMessage } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const base32Alphabet = "abcdefghijklmnopqrstuvwxyz234567"

function createBusinessSlug(name: string) {
  const base = name
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)

  const randomBytes = new Uint8Array(4)
  globalThis.crypto.getRandomValues(randomBytes)

  let entropy =
    (randomBytes[0] | (randomBytes[1] << 8) | (randomBytes[2] << 16) | (randomBytes[3] << 24)) >>> 0
  const suffix = Array.from({ length: 6 }, () => {
    const character = base32Alphabet[entropy & 31]
    entropy >>>= 5
    return character
  }).join("")

  return `${base || "business"}-${suffix}`
}

function validateName(value: string) {
  const name = value.trim()

  if (!name) {
    return "Nama bisnis wajib diisi"
  }

  return name.length > 100 ? "Nama bisnis maksimal 100 karakter" : undefined
}

export function OrganizationOnboardingForm({ className, ...props }: React.ComponentProps<"div">) {
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: "",
    },
    onSubmit: async ({ value }) => {
      setError(null)

      try {
        const result = await authClient.organization.create({
          name: value.name.trim(),
          slug: createBusinessSlug(value.name),
        })

        if (result.error) {
          setError(getErrorMessage(result.error, "Bisnis Anda tidak dapat dibuat"))
          return
        }

        const organizationId = result.data?.id
        if (!organizationId) {
          setError("Bisnis Anda tidak dapat dibuat")
          return
        }

        const activeResult = await authClient.organization.setActive({ organizationId })
        if (activeResult.error) {
          setError(getErrorMessage(activeResult.error, "Bisnis Anda tidak dapat diaktifkan"))
          return
        }

        await navigate("/app")
      } catch {
        setError("Terjadi kesalahan. Silakan coba lagi.")
      }
    },
  })

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardContent className="p-6 md:p-8">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <FieldGroup>
              <div className="flex flex-col gap-2 text-center">
                <h1 className="text-2xl font-bold">Buat bisnis Anda</h1>
                <p className="text-balance text-muted-foreground">
                  Siapkan bisnis untuk kode QR dan tim Anda.
                </p>
              </div>

              <form.Field
                name="name"
                validators={{
                  onBlur: ({ value }) => validateName(value),
                  onSubmit: ({ value }) => validateName(value),
                }}
              >
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Nama bisnis</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="text"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="Acme Inc."
                        autoComplete="organization"
                        autoFocus
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && (
                        <FieldError>
                          {field.state.meta.errors.filter(Boolean).join(", ")}
                        </FieldError>
                      )}
                    </Field>
                  )
                }}
              </form.Field>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Field>
                <form.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <Button type="submit" disabled={isSubmitting} className="w-full">
                      {isSubmitting ? "Membuat bisnis..." : "Buat bisnis"}
                    </Button>
                  )}
                </form.Subscribe>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <FieldDescription className="px-6 text-center">
        Anda dapat mengundang anggota tim dan mengelola bisnis setelah penyiapan selesai.
      </FieldDescription>
    </div>
  )
}
