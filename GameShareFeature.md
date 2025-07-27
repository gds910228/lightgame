# Game Share Feature

## Core Features

- Click-to-copy share button on game detail pages

- Copies the game's URL to the user's clipboard

- Displays a temporary notification to confirm the copy action

## Tech Stack

{
  "Web": {
    "arch": "react",
    "component": null,
    "details": "Implemented using React with TypeScript. Utilizes the browser's native `navigator.clipboard` API for copying text, ensuring a modern and secure approach without external dependencies."
  }
}

## Design

The feature includes a minimalist share icon button. Upon a successful copy, a sleek, semi-transparent 'Glassmorphism' style toast notification briefly appears to provide user feedback, ensuring a modern and polished user experience.

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[X] Create a new `ShareButton` React component with TypeScript props.

[X] Implement the `onClick` handler within the component to fetch the current URL using `window.location.href` and copy it to the clipboard via `navigator.clipboard.writeText()`.

[X] Develop a reusable `ToastNotification` component to display feedback messages.

[X] Integrate the `ShareButton` into the game detail page and manage the state to display the `ToastNotification` upon a successful copy action.

[X] Apply CSS styling to the button and notification to match the design specifications and ensure responsiveness.
