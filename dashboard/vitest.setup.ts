import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL does not auto-cleanup under Vitest globals; do it explicitly.
afterEach(() => {
  cleanup()
})
