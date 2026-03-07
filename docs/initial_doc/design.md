## Core Design Philosophy: "Words Over Faces"

The central UI metaphor is a **chat log or prompt window** — familiar to any AI user, but reimagined as a romantic artifact. Instead of a profile photo grid, users see **excerpts of their AI memory summaries** as the first impression. The face comes later, after the context connects.

***

## Typography as Identity

Since text is the hero, font choices carry emotional weight:

- **Headlines**: [**Syne**](https://fonts.google.com/specimen/Syne) or **Space Grotesk** — geometric, slightly quirky, techy but warm
- **Memory Excerpts / Profile Text**: **iA Writer Quattro** or **Lora** — a serif that feels like a personal journal entry, intimate and thoughtful
- **UI Labels \& Tags**: **Inter** — clean, neutral, lets the content breathe

The contrast between a **geometric headline font** and a **humanist serif for content** visually communicates the duality of *AI processing → human feeling*.

***

## Palette: Refined for Text-Centric UI

| Layer | Color | Hex | Purpose |
| :-- | :-- | :-- | :-- |
| **Base** | Warm Charcoal | `#1C1A24` | Background — dark but not cold |
| **Surface** | Elevated Mist | `#26233A` | Card backgrounds, input fields |
| **Primary Accent** | Soft Violet | `#7C5CFC` | CTAs, active states, links |
| **Warm Accent** | Peach Glow | `#FFB997` | Match highlights, warmth indicators |
| **Text Primary** | Off-White | `#F0EEF8` | Main readable content |
| **Text Secondary** | Muted Lavender | `#9E97C0` | Timestamps, labels, metadata |
| **AI Memory Tint** | Phosphor Green | `#A8FF78` (subtle, 20% opacity) | A faint glow behind memory excerpt blocks — nods to terminal/AI output |


***

## The "AI Memory Hint" Visual Language

This is where **Contexted** gets its personality. Memory excerpts on profile cards should feel like they came straight out of an AI context window:

- **Blinking cursor `|`** at the end of memory snippets — signals this is live, AI-generated, real
- **Faint monospace font** for the raw memory block, like a `<code>` tag — then the matched summary renders in the warm serif below it, as if it was "translated" for the heart
- **Token highlight effect**: Key personality words in a memory excerpt gently highlight in peach/violet on hover, like attention weights visualised — subtle nod to transformer attention mechanisms
- **"Last updated by [AI provider]"** metadata tag in muted lavender beneath each memory block — shows Claude, ChatGPT, Gemini etc. as the source, small and non-intrusive

***


The background behind this copy could be a **slowly scrolling, heavily blurred wall of AI chat text** — unreadable but evocative, like a memory fading in and out of focus. It signals depth without revealing anything private.

***

## What Makes This Stand Out

Unlike Hinge or Bumble where the photo does the work, on Contexted **the writing does the work** — which naturally attracts a more thoughtful, literate, tech-curious user base. That is a niche worth owning, and the design should make that positioning feel intentional and premium, not accidental.

