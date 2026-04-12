import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import BriefingPage from '@/app/briefing/page'

// Mocks useIdentity hook
vi.mock('@/hooks/use-identity', () => ({
  useIdentity: () => {},
}))

// Mocks ChatLayout component
vi.mock('@/components/chat-layout', () => ({
  ChatLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('BriefingPage meetings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Displaying Proposed Meetings from Briefing Payload
  it('renders proposed meetings from briefing payload', async () => {
    // Mimics briefing payload
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        briefing: '',
        summary: '',
        drafts: [],
        meetings: [
          {
            meeting_id: 'm1',
            title: 'Team Catchup',
            date: '2026-04-10',
            start_time: '18:00',
            end_time: '19:00',
            location: 'Zoom',
            attendees: 'a@x.com,b@x.com',
          },
        ],
      }),
    } as any)

    render(<BriefingPage />)

    // Waits until meeting appears then verifies formatting
    expect(await screen.findByText('Team Catchup')).toBeInTheDocument()
    expect(screen.getByText(/Date: 2026-04-10/)).toBeInTheDocument()
    expect(screen.getByText(/Time: 18:00 - 19:00/)).toBeInTheDocument()
  })

  // Posting to schedule-meeting and showing Added on success
  it('posts to schedule-meeting and shows Added on success', async () => {
    // Mimics briefing payload
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          briefing: '',
          summary: '',
          drafts: [],
          meetings: [
            {
              meeting_id: 'm1',
              title: 'Dinner',
              date: '2026-04-10',
              start_time: '18:00',
              end_time: '19:00',
            },
          ],
        }),
      } as any)
      // Mimics schedule request
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, message: 'Added to calendar.' }),
      } as any)

    render(<BriefingPage />)

    // Waits until add button appears then clicks it
    const addBtn = await screen.findByRole('button', { name: /add to calendar/i })
    fireEvent.click(addBtn)

    // Waits until schedule request is made then checks object
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/automation/schedule-meeting',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
    // Waits until added button appears and checks text
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /added/i })).toBeInTheDocument()
    })
  })

  // Testing showing Backend Error Message when Scheduling Fails
  it('shows backend error message when scheduling fails', async () => {
    // Mimics briefing payload
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          briefing: '',
          summary: '',
          drafts: [],
          meetings: [
            {
              meeting_id: 'm1',
              title: 'Dinner',
              date: '2026-04-10',
              start_time: '18:00',
              end_time: '19:00',
            },
          ],
        }),
      } as any)
      // Mimics backend error
      .mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Gateway',
        json: async () => ({ ok: false, error: 'Python scheduling failed' }),
      } as any)

    render(<BriefingPage />)

    // Waits until add button appears then clicks it
    fireEvent.click(await screen.findByRole('button', { name: /add to calendar/i }))
    
    // Waits until error message appears and checks text
    await waitFor(() => {
      expect(screen.getByText(/Python scheduling failed/i)).toBeInTheDocument()
    })
  })
})