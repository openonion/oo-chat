import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// Relative path: assumes frontend and agent repos are in the same parent folder
// Override with AGENT_PROJECT_PATH env var if needed
const AGENT_PROJECT_PATH = process.env.AGENT_PROJECT_PATH || join(process.cwd(), '..', 'capstone-project-26t1-3900-w18a-date')
const SUBSCRIPTIONS_FILE = join(AGENT_PROJECT_PATH, 'data', 'subscriptions.json')

export async function GET() {
  try {
    console.log('Looking for file at:', SUBSCRIPTIONS_FILE)
    console.log('File exists:', existsSync(SUBSCRIPTIONS_FILE))
    console.log('cwd:', process.cwd())
    if (!existsSync(SUBSCRIPTIONS_FILE)) {
      return NextResponse.json(
        { error: 'No subscription data found. Run "check subscriptions" in the chat first.' },
        { status: 404 }
      )
    }

    const content = readFileSync(SUBSCRIPTIONS_FILE, 'utf-8')
    const parsed = JSON.parse(content)

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Error reading subscription data:', error)
    return NextResponse.json(
      { error: 'Failed to read subscription data.' },
      { status: 500 }
    )
  }
}