import { useNavigate } from 'react-router-dom'
import { ErrorLayout } from '../../shared/layouts'
import { Button } from '../../shared/components'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <ErrorLayout
      title="This page doesn't exist"
      description="The link may be outdated, or the page hasn't been built yet."
      action={<Button onClick={() => navigate('/')}>Back to Dashboard</Button>}
    />
  )
}
