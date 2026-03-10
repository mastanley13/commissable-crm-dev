import { redirect } from "next/navigation"

export default function DataSettingsTemplateDetailPage({
  params,
}: {
  params: { templateId: string }
}) {
  redirect(`/admin/data-settings?section=templates&templateId=${encodeURIComponent(params.templateId)}`)
}
