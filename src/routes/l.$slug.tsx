import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/l/$slug')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/l/$slug"!</div>
}
