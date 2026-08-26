# Meeting Relay

## Current backend integration

The frontend now uses the real Relay API for signup, login, refresh-cookie session restoration,
logout, project listing/creation, project members, custom Kanban columns, task CRUD, drag-and-drop
movement, task activity, transcript meeting creation/listing, parsed transcript detail, linked meeting
tasks, and failed-meeting retry. Review, notification, and account-edit screens still use demonstration
data until their API adapters are implemented. Audio upload remains intentionally unavailable until v0.7.

Copy `.env.example` to `.env` when you need a non-default API URL. The local default is
`http://localhost:5000/api`. Set the same Google OAuth web client ID as
`VITE_GOOGLE_CLIENT_ID` in the frontend and `GOOGLE_CLIENT_ID` in the backend to enable Google login.

Build Relay

Design and build the complete frontend UI for Relay, a multi-agent meeting-to-task web application.

Relay takes meeting recordings or transcripts, uses AI agents to extract actionable tasks, lets a human review those tasks, and then tracks approved work on a project Kanban board. Later meetings can update existing tasks instead of blindly creating duplicates.

The remaining mock screens should be replaced incrementally with the existing backend contracts.

1. Product Concept

Relay's workflow is:

Meeting → Transcription → AI Task Extraction → Human Review → Project Board → Ongoing Tracking

Example:

A meeting contains:

"Naveed will finish the authentication API by Friday."

Relay extracts:

Task: Finish authentication API

Assignee: Naveed

Due date: Friday

Priority: High

Source: Weekly Product Sync

Timestamp: 18:32

The user reviews this information before approving it.

Once approved, the task appears on the project's Kanban board.

Tasks always maintain traceability back to the meeting where they originated.

Eventually, Relay will use multiple agents for extraction, duplicate detection, cross-meeting task updates, deadline monitoring, and notifications.

2. Overall Design Direction

Relay should look like a serious modern productivity application, not an AI landing-page template.

Take visual inspiration from products such as Linear, Notion, Raycast, Slack, Height, and modern project-management software, but DO NOT directly copy any product.

The application should feel:

focused

calm

professional

information-dense without feeling crowded

modern without looking futuristic

suitable for daily work

clearly designed rather than AI-generated

The actual application experience is more important than the marketing landing page.

3. Avoid Vibe-Coded UI Patterns

This is extremely important.

Do NOT produce the stereotypical AI-generated SaaS website.

Colors

Do NOT use:

purple/blue AI gradients

rainbow gradients

neon colors

excessive glassmorphism

glowing cards

glowing buttons

giant blurred background blobs

random gradient text

excessive shadows

Use a restrained neutral palette.

Suggested direction:

warm/off-white application background

white or slightly elevated surfaces

charcoal primary text

muted gray secondary text

subtle borders

one restrained brand accent

A muted blue, slate, dark teal, or similar professional accent is acceptable, but keep it restrained.

Use semantic colors only when necessary:

red for overdue/destructive

amber for warnings

green for completed/success

muted accent for informational states

Do not turn status colors into the entire visual identity.

4. Typography

Use a clean modern sans-serif such as Inter or a similar professional UI font.

Create and consistently follow a type scale.

Suggested hierarchy:

Page title: 28–32px / semibold

Section title: 18–20px / semibold

Card title: 14–16px / medium or semibold

Main body: 14–15px / regular

Secondary text: 13–14px

Metadata / labels: 12–13px

Avoid:

enormous 60–80px dashboard headings

ultra-thin body text

random font sizes

excessive uppercase text

excessive bold text

Maintain consistent line heights and paragraph spacing.

5. Spacing and Layout System

Use a consistent spacing scale such as:

4 / 8 / 12 / 16 / 24 / 32 / 48

Do not randomly choose padding values for every component.

The desktop application should use:

Left sidebar + main workspace

Keep component placement consistent between pages.

Use only 2–3 border radius values:

6px for small controls

8px for cards/inputs

12px for larger surfaces/modals

Do not make everything extremely rounded.

Avoid excessive floating cards.

Related information should often live directly within the page structure rather than every section being placed inside its own card.

6. Interaction Design

Interactions should feel deliberate.

Hover effects:

subtle background changes

border changes

maximum 2–4px lift when appropriate

no glowing effects

Animations:

Use purposeful animations only.

Use easing such as:

cubic-bezier(0.4, 0, 0.2, 1)

Typical duration:

150–250ms

Longer transitions can be used for page-level changes.

Stagger animations only when introducing groups of information.

Do not animate everything.

7. Application Navigation

Create a persistent desktop sidebar.

Top:

Relay logo / wordmark

Below it, add a Project Switcher.

Example:

Atlas Web App
▾

Clicking it should open a dropdown showing:

Atlas Web App

Mobile Redesign

Research Project

Create new project

Primary navigation:

Overview

Board

Meetings

Review

Secondary section near bottom:

Settings

Bottom:

User profile area with:

avatar

name

email

menu

Keep icons consistent in style and approximately 16–18px.

Use Lucide icons or another consistent icon library.

Do not mix icon styles.

8. Landing Page

Create a restrained product landing page.

Do NOT make it look like an AI startup cliché.

Header

Left:

Relay

Navigation:

Product

How it works

Features

Right:

Sign in

Get started

Hero

Use a concise headline such as:

Turn meetings into work that gets done.

Supporting copy:

Relay extracts action items from meetings, lets your team review them, and keeps every task connected to the conversation that created it.

Primary CTA:

Get started

Secondary CTA:

See how it works

Do NOT add:

sparkles

"Powered by AI" pills

gradient text

fake company-logo walls

fake testimonials

fake user statistics

meaningless claims such as "10x productivity"

Under the hero, show an actual product preview rather than decorative abstract graphics.

The preview could show:

Meeting transcript on the left → extracted tasks → Kanban board.

This should immediately communicate what Relay does.

9. Authentication

Create:

Login

Signup

Keep these screens simple.

Centered authentication panel with restrained branding.

Login:

Email

Password

Sign in

Create account link

Signup:

Name

Email

Password

Confirm password

Create account

Include proper:

validation states

loading button state

error state

disabled state

Do not clutter authentication with unnecessary marketing content.

10. Project Creation

When a new user has no projects, show a purposeful empty state.

Title:

Create your first project

Description:

Projects keep meetings, tasks and team members organized in one workspace.

CTA:

Create project

Project creation modal:

Project name

Description optional

Create project

After creation, take the user to the Overview.

11. Overview Dashboard

The dashboard should provide a quick understanding of project status.

Header:

Atlas Web App

Below:

Overview of tasks and recent meeting activity.

Right side:

Upload meeting

Summary

Show four compact statistics:

12 Open tasks

4 In progress

3 Due this week

2 Overdue

Do not make these giant analytics cards.

Keep them compact and information-focused.

Upcoming Deadlines

Display a clean list/table:

TaskAssigneeDuePriorityFinalize authentication flowNaveedAug 26HighReview onboarding UIAbdullahAug 28MediumPrepare API documentationHuzaifaAug 30Low

Overdue items should be clearly identifiable without aggressive red backgrounds.

Recent Meetings

Show recent meetings with:

meeting title

date

duration

number of extracted tasks

processing/review status

Example:

Weekly Product Sync
Aug 22 · 42 min · 5 tasks extracted

Backend Planning
Aug 19 · 28 min · 3 tasks extracted

Clicking opens the meeting detail.

Recent Activity

Examples:

Naveed moved "Authentication API" to In Progress.

3 tasks were approved from Weekly Product Sync.

Deadline changed for "Dashboard redesign."

Use small avatars/icons and timestamps.

12. Kanban Board

This is one of the main screens.

Header:

Board

Actions:

Search

Filter

Assignee filter

Priority filter

Add task

Columns:

Todo

In Progress

Done

Show the number of tasks beside each column title.

Task cards should display only useful information:

title

assignee avatar/name

due date

priority

meeting-source indicator when applicable

Example:

Finalize authentication flow

Naveed

Due Aug 26 · High

Source: Weekly Product Sync

Do not overload cards.

Implement functional drag-and-drop between columns.

Movement should update task status.

Add subtle drag feedback.

Provide loading/persistence feedback after a move.

13. Manual Task Creation

"Add task" opens a modal or side sheet.

Fields:

Title

Description

Assignee

Due date

Priority

Status

Buttons:

Cancel

Create task

Create button should display progress while saving.

Example:

Creating...

After success, update the board without a full page reload.

14. Task Detail

Clicking a task should open a right-side detail panel rather than navigating away from the board.

Display:

Finalize authentication flow

Then editable properties:

Status

Assignee

Priority

Due date

Project

Description section.

Source Meeting

If generated from a meeting:

Weekly Product Sync

Aug 22, 2026

18:32

Transcript excerpt:

"Naveed will finish the authentication API by Friday."

Button:

View in transcript

Clicking it should open the meeting and jump/highlight the relevant timestamp.

Activity

Show task history:

Task extracted from Weekly Product Sync

Naveed approved task

Status changed from Todo → In Progress

Deadline changed Aug 25 → Aug 26

Include timestamps.

15. Upload Meeting

This screen is central to Relay.

Header:

Upload meeting

Description:

Upload a recording or paste a transcript. Relay will identify actionable work for you to review.

Provide two tabs:

Audio

Transcript

Audio

Large but restrained upload zone.

Support:

MP3

WAV

M4A

Display file-size limitation.

After selection show:

filename

size

duration if available

remove button

CTA:

Process meeting

Transcript

Provide:

Meeting title

Date

Transcript textarea

CTA:

Analyze transcript

16. Meeting Processing

Do NOT show an indefinite spinner.

Show actual pipeline progress.

Example:

Processing Weekly Product Sync

Uploading recording ✓

Transcribing audio ✓

Identifying speakers ✓

Extracting action items

Preparing review

Show the currently active step.

Use restrained progress animation.

If processing fails, clearly explain what failed and provide:

Try again

Do not lose the uploaded meeting unnecessarily.

17. Extraction Review

This is one of the most important interfaces.

Header:

Review extracted tasks

Supporting text:

Relay found 5 possible action items. Review them before they're added to the board.

Each candidate task should have a structured review card.

Example:

Finalize authentication API

Assignee
Naveed

Deadline
Aug 26

Priority
High

Source

Weekly Product Sync · 18:32

"Naveed will finish the authentication API by Friday."

Actions:

Approve

Edit

Reject

Allow multi-select.

Top actions:

Approve selected

Reject selected

Show:

3 of 5 selected

Approved tasks should visibly transition into an approved state without disappearing confusingly.

Rejected tasks should remain recoverable during the current review session.

18. Duplicate Detection UI

Design the interface for the future duplicate agent even if the backend is mocked initially.

When Relay detects a candidate similar to an existing task, do NOT silently merge it.

Show:

Possible existing task

Candidate:

Finish authentication API

Existing task:

Complete authentication backend

Similarity:

High confidence

Show useful differences:

Existing deadline: Aug 25
Meeting suggests: Aug 26

Actions:

Update existing

Create separate task

Ignore candidate

Avoid exposing raw embedding scores like 0.89372 to normal users.

19. Meeting Library

Page title:

Meetings

Primary action:

Upload meeting

Provide search.

Optional filters:

All

Needs review

Processed

Display meetings in a clean list/table rather than giant cards.

Columns:

Meeting

Date

Duration

Tasks

Status

Participants

Example:

Weekly Product Sync
Aug 22
42 min
5 tasks
Reviewed

Click a meeting to open its detail.

20. Meeting Detail

Header:

Weekly Product Sync

Metadata:

Aug 22, 2026 · 42 minutes

Actions:

Reprocess

More menu

Create two primary tabs:

Transcript

Tasks

Transcript

Display timestamped transcript blocks.

Example:

18:28 — Abdullah

We should finish authentication before starting account settings.

18:32 — Naveed

I'll finish the authentication API by Friday.

The 18:32 segment should have a subtle task indicator.

Clicking it reveals:

Linked task: Finalize authentication API

Avoid chat-bubble styling unless it genuinely improves readability.

Treat this more like a professional transcript viewer.

Tasks

Show all tasks originating from this meeting and their current statuses.

21. Natural Language Task Command

Add a small command interface accessible from the application header or through a keyboard shortcut.

Placeholder:

Ask Relay to update your project...

Examples:

Move authentication to Done.

Assign dashboard redesign to Abdullah.

What tasks are overdue?

When submitted, show what Relay intends to do before destructive or ambiguous actions.

Example:

Move "Finalize authentication flow" from In Progress → Done?

Buttons:

Confirm

Cancel

Do not design this as a giant chatbot taking over the application.

It should feel like a productivity command bar.

22. Notifications

Create an in-app notification panel.

Examples:

Deadline tomorrow

Finalize authentication flow is due tomorrow.

Task overdue

Prepare API documentation was due yesterday.

Meeting ready for review

5 action items were extracted from Weekly Product Sync.

Provide read/unread states.

23. Settings

Sections:

Profile

Name

Email

Project

Project name

Members

Invite member

Notifications

Toggles:

Upcoming deadlines

Overdue tasks

Meeting processing completed

Tasks requiring review

Telegram

Status:

Not connected

CTA:

Connect Telegram

After connection:

Connected

Provide:

Disconnect

Every toggle must actually change state in the prototype.

24. Empty States

Design proper empty states.

Do not simply display "No data."

No meetings

No meetings yet

Upload a recording or transcript and Relay will turn actionable discussion into tasks for your review.

Upload meeting

Empty board

No tasks yet

Create a task manually or process your first meeting.

Add task

Upload meeting

No review items

You're all caught up

There are no extracted tasks waiting for review.

Keep illustrations minimal or omit them entirely.

25. Loading and Error States

Every async interaction must have a state.

Examples:

Project loading → skeleton.

Board loading → skeleton task cards.

Meeting library loading → skeleton rows.

Task creation → button progress.

Audio upload → upload progress.

Meeting processing → pipeline progress.

Task approval → localized progress.

Do not use a full-page spinner for everything.

Errors should explain:

what failed

whether user data was preserved

what the user can do next

26. Responsive Behaviour

Relay is desktop-first web software, but should remain usable on tablets and smaller screens.

Desktop:

Persistent sidebar.

Tablet:

Collapsible sidebar.

Mobile:

Basic responsive layout is sufficient. Do not spend excessive effort building a native-feeling mobile experience because mobile is outside the product scope.

Kanban columns may horizontally scroll on narrow screens.

27. Copywriting Rules

Avoid generic AI/SaaS copy.

Never use phrases such as:

"Supercharge your productivity"

"Unlock your potential"

"Revolutionize your workflow"

"Work smarter, not harder"

"Powered by cutting-edge AI"

"Seamlessly transform"

"The future of meetings"

"10x your productivity"

Avoid excessive em dashes.

Write copy based on specific actions.

Bad:

Unlock smarter meetings with powerful AI.

Good:

Upload a meeting and review the tasks Relay finds.

Bad:

Never let important insights slip through the cracks.

Good:

Keep tasks linked to the meeting where they were assigned.

Use concise product language.

28. AI Presentation

Do not plaster "AI" everywhere.

The intelligence should be visible through behavior.

For example, use:

5 tasks found

instead of:

AI generated 5 intelligent action items

Use:

Possible existing task

instead of:

AI Semantic Duplicate Detection

Use:

Relay is checking existing tasks...

instead of technical agent terminology in the normal user interface.

Technical architecture belongs in documentation, not every UI component.

29. Realistic Mock Data

Populate the prototype with realistic project data.

Project:

Atlas Web App

Members:

Naveed

Abdullah

Huzaifa

Meetings:

Weekly Product Sync

Backend Planning

UI Review

Sprint Planning

Tasks:

Finalize authentication flow

Implement password reset endpoint

Review dashboard navigation

Prepare API documentation

Fix onboarding validation

Connect user profile API

Update database schema

Mix:

Todo

In Progress

Done

overdue

upcoming

low/medium/high priority

Do not use John Doe, Jane Smith, Task 1, Project Alpha, or lorem ipsum.

30. Component Consistency

Create reusable components for:

Sidebar

ProjectSwitcher

PageHeader

Button

Input

Select

Avatar

Badge

TaskCard

TaskDetailPanel

MeetingRow

ReviewTaskCard

EmptyState

Skeleton

Modal

Dropdown

CommandBar

NotificationPanel

Do not independently redesign the same component on different pages.

Buttons must have consistent:

height

radius

typography

padding

icon sizing

Inputs must follow the same rule.

31. Accessibility

Maintain:

keyboard navigation

visible focus states

proper form labels

accessible contrast

semantic HTML

button labels

keyboard-accessible menus

sufficient touch targets

Do not communicate status exclusively through color.

32. Pages to Build

Build a coherent navigation flow between:

Landing

Login

Signup

Project creation / empty workspace

Overview

Kanban Board

Task Detail

Upload Meeting

Meeting Processing

Extraction Review

Duplicate Resolution

Meeting Library

Meeting Detail / Transcript

Notifications

Settings

These should feel like one application built from one design system, not 15 individually generated pages.

33. Priority

Spend the most design effort on:

1. Kanban Board
2. Extraction Review
3. Meeting Detail + Transcript
4. Upload/Processing flow
5. Task Detail

These screens demonstrate what makes Relay different.

The landing page is secondary.

Final Design Principle

Relay should feel like a tool someone could actually leave open during their workday.

The visual hierarchy should come from spacing, typography, borders and information architecture, not gradients, giant text, excessive cards, glowing effects or decorative animations.

The core experience should make this workflow obvious without explanation:

Upload meeting → Relay finds work → Human reviews it → Tasks enter the board → Relay keeps track of them.
Color System and Theme Requirements

Relay must support both Light Mode and Dark Mode.

Add a theme switcher in the application navigation, preferably near the bottom of the sidebar or in the top-right utility area.

Use a simple:

Sun icon / Moon icon

The selected theme should persist when the user refreshes the page.

Use system theme as the initial default when possible.

Do not build separate-looking designs for light and dark mode. They should use the same layout, spacing, hierarchy, components, and brand identity.

Brand Color

Use the following as Relay's primary brand color:

Primary Coral: #FF4F47

This color should give Relay a recognizable identity, but it must be used intentionally.

Use it for:

primary CTA buttons

selected navigation indicators

active controls

important links

focus accents

small branded indicators

active tabs where appropriate

progress states

Do NOT use large coral backgrounds throughout the application.

Do NOT make every button coral.

Secondary actions should remain neutral.

Avoid using the primary coral color to represent errors because coral is already the brand color.

Use a separate darker red for destructive/error states.

Light Mode Palette

Use approximately:

Background: #F7F7F5
Surface: #FFFFFF
Secondary Surface: #F1F1EE

Primary: #FF4F47
Primary Hover: #E94640
Primary Soft: #FFF0EE

Primary Text: #20211F
Secondary Text: #6F716D
Muted Text: #969892

Border: #E2E3DF
Border Strong: #D3D5D0

Light mode should feel slightly warm rather than bright sterile white.

The main workspace can use #F7F7F5 while cards, modals, task panels and important surfaces use white.

Dark Mode Palette

Use approximately:

Background: #151615
Surface: #1C1E1C
Secondary Surface: #232523

Primary: #FF5C55
Primary Hover: #FF6B64
Primary Soft: #382321

Primary Text: #F2F3F0
Secondary Text: #A5A9A3
Muted Text: #797D78

Border: #303330
Border Strong: #3C403C

Do not use pure black backgrounds.

Dark mode should use slightly warm charcoal tones.

The coral brand color should remain recognizable in dark mode, but may be slightly brighter to maintain contrast.

Semantic Colors

Keep semantic colors separate from the Relay brand color.

Use restrained tones.

Success / Completed

Light:

#3F7D59

Dark:

#62A779

Use for:

completed tasks

successful saves

connected integrations

Warning / Upcoming Deadline

Light:

#A66A24

Dark:

#D69A4B

Use for:

deadlines approaching

warnings

medium-risk states

Error / Overdue / Destructive

Light:

#B83D3D

Dark:

#E05A5A

Use for:

overdue tasks

failed processing

destructive actions

validation errors

Do not use #FF4F47 as the standard error color simply because it is red-adjacent.

Priority Colors

Keep priority indicators subtle.

Do not give entire cards colored backgrounds.

Example:

High
Small muted red indicator.

Medium
Small amber indicator.

Low
Neutral gray indicator.

Priority should be communicated through a small badge, dot, icon or text treatment.

Kanban Status Styling

Do not make entire Kanban columns bright colors.

Columns should remain neutral.

For example:

Todo

Neutral gray indicator.

In Progress

Restrained coral/accent indicator.

Done

Muted green indicator.

Task cards themselves should remain mostly neutral in both themes.

Buttons

Primary button:

Coral background with high-contrast text.

Example light mode:

Background: #FF4F47
Hover: #E94640
Text: #FFFFFF

Secondary buttons:

Neutral surface with border.

Ghost buttons:

Transparent with subtle hover background.

Destructive buttons:

Use the semantic destructive red, NOT the brand coral.

Navigation

Sidebar should remain largely neutral.

The active page should not use a huge colored block.

Prefer something subtle such as:

slightly tinted background

coral icon or small left indicator

stronger text weight

Example active state:

Background: #FFF0EE
Icon: #FF4F47
Text: #20211F

Dark mode:

Background: #382321
Icon: #FF5C55
Text: #F2F3F0

Theme Toggle

Include a functional Light/Dark theme switcher.

Suggested placement:

At the bottom of the left sidebar near Settings and the user profile.

Alternatively, use a compact utility control in the top-right navigation area.

Use Lucide icons:

Sun

Moon

Keep it understated.

Do NOT create a large theme-selector card.

Switching themes should animate smoothly using approximately:

150–200ms cubic-bezier(0.4, 0, 0.2, 1)

Only animate relevant color/background/border transitions.

Do not animate every element individually.

Persist the selected theme using local storage or the project's existing theme mechanism.

Important Color Principle

Relay's visual identity should come from:

warm neutrals + charcoal typography + controlled coral accents

not from filling the interface with coral.

Aim for approximately:

85–90% neutral surfaces

10–15% brand/semantic color

The coral should draw attention to actions and important states rather than becoming visual noise.

Avoid:

coral gradients

coral glow effects

giant coral hero sections

excessive colored badges

colored borders on every card

gradient buttons

neon versions of the brand color

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
cd D:\Relay\frontend
npm install
npm run dev
```
